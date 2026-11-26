from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
import logging
from datetime import timedelta
import secrets
import smtplib
from .models import PublicEmailVerification, Ticket, TicketPart, TicketService, TicketStatusHistory, ServicePricing, LocationServicePrice
from .serializers import (
    TicketStatusHistorySerializer,
    ServiceReadSerializer,
    ServicePricingWriteSerializer,
    LocationServicePriceSerializer,
)
from django.db import transaction
from django.db.models import Prefetch
from .serializers import (
    TicketReadSerializer,
    TicketWriteSerializer,
    TicketPartReadSerializer,
    TicketPartWriteSerializer,
    TicketServiceSerializer,
    PublicEmailRequestSerializer,
    PublicEmailVerifySerializer,
    PublicTicketSummarySerializer,
    PublicTicketStatusSerializer,
)
from inventory.models import Stock
from accounts.permissions import HasActiveLocation, IsOwner, IsOwnerOrManager

logger = logging.getLogger(__name__)


def send_ready_notification(ticket):
    email = ticket.client.email
    if not email:
        logger.info('Ready notification skipped for %s: client has no email.', ticket.ticket_code)
        return

    send_mail(
        subject=f'Zgłoszenie {ticket.ticket_code} gotowe do odbioru',
        message=(
            f'Dzień dobry,\n'
            f'Informujemy, że przedmiot ze zgłoszenia {ticket.ticket_code} '
            f'jest gotowy do odbioru w {ticket.location.name}.\n'
            f'Adres oraz godziny otwarcia można znaleźć na naszej stronie internetowej.\n\n'
            f'Z poważaniem,\n'
            f'Serwis Komputerowy NAZWA'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def try_send_ready_notification(ticket):
    try:
        send_ready_notification(ticket)
    except Exception:
        logger.exception('Could not send ready notification for %s.', ticket.ticket_code)


def reserve_ticket_parts(ticket):
    parts = TicketPart.objects.select_for_update().filter(
        ticket=ticket,
        stock_reserved=False,
    ).select_related('part')
    for ticket_part in parts:
        stock = Stock.objects.select_for_update().filter(
            location=ticket.location,
            part=ticket_part.part,
        ).first()
        if not stock or stock.quantity < ticket_part.quantity:
            raise serializers.ValidationError({
                'parts': f'Brak wystarczającej liczby części: {ticket_part.part.name}.'
            })
        stock.quantity -= ticket_part.quantity
        stock.save(update_fields=['quantity'])
        ticket_part.stock_reserved = True
        ticket_part.save(update_fields=['stock_reserved'])


def technician_can_edit_ticket(user, ticket):
    return user.role != 'TECHNICIAN' or ticket.assigned_worker_id == user.id

class TicketView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]
    filter_backends = [filters.SearchFilter,filters.OrderingFilter]
    search_fields = [
        'ticket_code',
        'device_name',
        'serial_number',
        'client__first_name',
        'client__last_name',
        'client__phone_number',
        'client__email',
    ]
    ordering_fields = ['created_at','updated_at','status']

    def get_throttles(self):
        if self.action in ['device_passcode', 'send_ready_email']:
            self.throttle_scope = (
                'device_passcode' if self.action == 'device_passcode' else 'ready_email'
            )
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Ticket.objects.none()

        user = self.request.user
        queryset = Ticket.objects.select_related('client','location','assigned_worker','created_by').prefetch_related(
            'status_history', 'assignment_history', 'used_parts__part', 'used_services'
        )
        if getattr(user,'role',None) == 'OWNER':
            location_queryset = queryset
        elif user.location:
            location_queryset = queryset.filter(location=user.location)
        else:
            return Ticket.objects.none()

        requested_statuses = self.request.query_params.get('status')
        if requested_statuses:
            statuses = requested_statuses.split(',')
            valid_statuses = {status for status, _ in Ticket.Status.choices}
            location_queryset = location_queryset.filter(
                status__in=[status for status in statuses if status in valid_statuses]
            )

        return location_queryset.order_by('-updated_at', '-id')

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return TicketReadSerializer
        return TicketWriteSerializer

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)

        read_serializer = TicketReadSerializer(
            write_serializer.instance,
            context=self.get_serializer_context(),
        )
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_create(self, serializer):
        comment = serializer.validated_data.pop('comment','Utworzenie zgłoszenia w systemie')
        serializer.save(user=self.request.user, created_by=self.request.user, comment=comment)
    def perform_update(self, serializer):
        if not technician_can_edit_ticket(self.request.user, serializer.instance):
            raise PermissionDenied('Tylko przypisany pracownik może modyfikować to zgłoszenie.')
        comment = serializer.validated_data.pop('comment','')
        serializer.save(user=self.request.user, comment=comment)

    @action(detail=True,methods=['post'],url_path='change-status')
    @transaction.atomic
    def change_status(self,request,pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if not technician_can_edit_ticket(request.user, ticket):
            return Response({"detail": "Tylko przypisany pracownik może zmienić status."}, status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get('status')
        comment = request.data.get('comment','')
        if new_status == Ticket.Status.WAITING_FOR_PARTS or (
            ticket.status == Ticket.Status.WAITING_FOR_PARTS
            and new_status in [Ticket.Status.DIAGNOSIS, Ticket.Status.IN_PROGRESS]
        ):
            return Response(
                {"detail": "Użyj dedykowanej akcji oczekiwania lub wznowienia zgłoszenia."},
                status=status.HTTP_409_CONFLICT,
            )
        if not new_status or new_status not in Ticket.Status.values:
            return Response({"detail": "Wybrany status jest nieprawidłowy"},status=status.HTTP_400_BAD_REQUEST)
        if not ticket.can_transition_to(new_status):
            return Response(
                {"detail": "Nie można wykonać tej zmiany statusu."},
                status=status.HTTP_409_CONFLICT,
            )
        if new_status == Ticket.Status.IN_PROGRESS:
            try:
                reserve_ticket_parts(ticket)
            except serializers.ValidationError as error:
                return Response(error.detail, status=status.HTTP_409_CONFLICT)
        ticket.status = new_status
        ticket.save(user=request.user, comment=comment)
        if new_status == Ticket.Status.READY:
            try_send_ready_notification(ticket)
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='send-ready-email')
    def send_ready_email(self, request, pk=None):
        ticket = self.get_object()
        if not technician_can_edit_ticket(request.user, ticket):
            return Response(
                {"detail": "Tylko przypisany pracownik może wysłać powiadomienie."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if ticket.status != Ticket.Status.READY:
            return Response(
                {"detail": "Powiadomienie można wysłać tylko dla gotowego zgłoszenia."},
                status=status.HTTP_409_CONFLICT,
            )
        try_send_ready_notification(ticket)
        return Response({"detail": "Próba wysłania powiadomienia została wykonana."})

    @action(detail=True, methods=['get'], url_path='device-passcode')
    def device_passcode(self, request, pk=None):
        ticket = self.get_object()
        if not technician_can_edit_ticket(request.user, ticket):
            return Response(
                {"detail": "Tylko przypisany pracownik może ujawnić hasło urządzenia."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({"device_passcode": ticket.device_passcode})

    @action(detail=True, methods=['post'], url_path='wait-for-parts')
    @transaction.atomic
    def wait_for_parts(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if not technician_can_edit_ticket(request.user, ticket):
            return Response({"detail": "Tylko przypisany pracownik może zmienić status."}, status=status.HTTP_403_FORBIDDEN)
        if ticket.status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.IN_PROGRESS]:
            return Response(
                {"detail": "Na części można oczekiwać tylko podczas diagnozy lub naprawy."},
                status=status.HTTP_409_CONFLICT,
            )

        ticket.status_before_waiting_for_parts = ticket.status
        ticket.status = Ticket.Status.WAITING_FOR_PARTS
        ticket.save(user=request.user, comment=request.data.get('comment', 'Zgłoszenie oczekuje na części'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='resume-work')
    @transaction.atomic
    def resume_work(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if not technician_can_edit_ticket(request.user, ticket):
            return Response({"detail": "Tylko przypisany pracownik może wznowić zgłoszenie."}, status=status.HTTP_403_FORBIDDEN)
        if ticket.status != Ticket.Status.WAITING_FOR_PARTS:
            return Response(
                {"detail": "Wznowić można tylko zgłoszenie oczekujące na części."},
                status=status.HTTP_409_CONFLICT,
            )

        previous_status = ticket.status_before_waiting_for_parts
        if previous_status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.IN_PROGRESS]:
            previous_history = ticket.status_history.exclude(
                status=Ticket.Status.WAITING_FOR_PARTS,
            ).order_by('-changed_at').first()
            previous_status = previous_history.status if previous_history else None
        if previous_status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.IN_PROGRESS]:
            return Response(
                {"detail": "Nie można ustalić poprzedniego etapu zgłoszenia."},
                status=status.HTTP_409_CONFLICT,
            )

        ticket.status = previous_status
        if previous_status == Ticket.Status.IN_PROGRESS:
            try:
                reserve_ticket_parts(ticket)
            except serializers.ValidationError as error:
                return Response(error.detail, status=status.HTTP_409_CONFLICT)
        ticket.status_before_waiting_for_parts = None
        ticket.save(user=request.user, comment=request.data.get('comment', 'Wznowiono obsługę zgłoszenia'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='resume-repair')
    @transaction.atomic
    def resume_repair(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if not technician_can_edit_ticket(request.user, ticket):
            return Response({"detail": "Tylko przypisany pracownik może wznowić zgłoszenie."}, status=status.HTTP_403_FORBIDDEN)
        if ticket.status != Ticket.Status.WAITING_FOR_PARTS:
            return Response({"detail": "Naprawę można wznowić tylko dla zgłoszenia oczekującego na części."}, status=status.HTTP_409_CONFLICT)
        try:
            reserve_ticket_parts(ticket)
        except serializers.ValidationError as error:
            return Response(error.detail, status=status.HTTP_409_CONFLICT)

        ticket.status = Ticket.Status.IN_PROGRESS
        ticket.status_before_waiting_for_parts = None
        ticket.save(user=request.user, comment=request.data.get('comment', 'Wznowiono naprawę'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='return-to-diagnosis')
    @transaction.atomic
    def return_to_diagnosis(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if not technician_can_edit_ticket(request.user, ticket):
            return Response({"detail": "Tylko przypisany pracownik może zmienić zgłoszenie."}, status=status.HTTP_403_FORBIDDEN)
        if ticket.status != Ticket.Status.WAITING_FOR_PARTS:
            return Response({"detail": "Do diagnozy można wrócić tylko dla zgłoszenia oczekującego na części."}, status=status.HTTP_409_CONFLICT)

        ticket.status = Ticket.Status.DIAGNOSIS
        ticket.status_before_waiting_for_parts = None
        ticket.save(user=request.user, comment=request.data.get('comment', 'Wrócono do diagnozy'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def claim(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)

        if ticket.assigned_worker_id and ticket.assigned_worker_id != request.user.id:
            return Response(
                {"detail": "To zgłoszenie jest już przypisane do innego pracownika."},
                status=status.HTTP_409_CONFLICT,
            )
        if ticket.status != Ticket.Status.NEW:
            return Response(
                {"detail": "Można przyjąć tylko nowe zgłoszenie."},
                status=status.HTTP_409_CONFLICT,
            )

        ticket.assigned_worker = request.user
        ticket.status = Ticket.Status.DIAGNOSIS
        ticket.save(user=request.user, comment=request.data.get('comment', 'Pracownik przejął zgłoszenie'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='take-over')
    @transaction.atomic
    def take_over(self, request, pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if request.user.role != 'TECHNICIAN':
            return Response(
                {"detail": "Tylko serwisant może przejąć zgłoszenie."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if ticket.status in [Ticket.Status.CLOSED, Ticket.Status.REJECTED]:
            return Response(
                {"detail": "Nie można przejąć zakończonego zgłoszenia."},
                status=status.HTTP_409_CONFLICT,
            )

        ticket.assigned_worker = request.user
        actor_name = request.user.get_full_name() or request.user.username
        comment = f"{actor_name} przejął zgłoszenie"
        ticket.save(user=request.user, comment=comment)
        TicketStatusHistory.objects.create(
            ticket=ticket,
            status=ticket.status,
            changed_by=request.user,
            comment=comment,
        )
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

class TicketPartView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return TicketPart.objects.none()

        user = self.request.user
        queryset = TicketPart.objects.select_related('ticket','part').order_by('-id')

        if getattr(user,'role',None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(ticket__location=user.location)
        return TicketPart.objects.none()

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return TicketPartReadSerializer
        return TicketPartWriteSerializer

    def perform_update(self, serializer):
        if not technician_can_edit_ticket(self.request.user, serializer.instance.ticket):
            raise PermissionDenied('Tylko przypisany pracownik może modyfikować części.')
        serializer.save()

    @transaction.atomic
    def perform_create(self, serializer):
        ticket = serializer.validated_data['ticket']
        if not technician_can_edit_ticket(self.request.user, ticket):
            raise PermissionDenied('Tylko przypisany pracownik może dodawać części.')
        if self.request.user.role != 'OWNER' and ticket.location_id != self.request.user.location_id:
            raise PermissionDenied('Nie możesz dodać części do zgłoszenia z innej lokalizacji.')
        if ticket.status not in [
            Ticket.Status.DIAGNOSIS,
            Ticket.Status.WAITING_FOR_PARTS,
            Ticket.Status.IN_PROGRESS,
        ]:
            raise serializers.ValidationError(
                'Części można dodawać tylko podczas diagnozy, oczekiwania na części lub naprawy.'
            )
        ticket_part = serializer.save()

        stock = Stock.objects.select_for_update().filter(location=ticket_part.ticket.location,part=ticket_part.part).first()

        if not stock or stock.quantity < ticket_part.quantity:
            if ticket.status in [Ticket.Status.DIAGNOSIS, Ticket.Status.WAITING_FOR_PARTS]:
                return
            raise serializers.ValidationError({"quantity":"Brak wystarczającej liczby części w magazynie oddziału."})

        stock.quantity -= ticket_part.quantity
        stock.save()
        ticket_part.stock_reserved = True
        ticket_part.save(update_fields=['stock_reserved'])

    @transaction.atomic
    def perform_destroy(self, instance):
        if not technician_can_edit_ticket(self.request.user, instance.ticket):
            raise PermissionDenied('Tylko przypisany pracownik może usuwać części.')
        stock = Stock.objects.select_for_update().filter(
            location=instance.ticket.location,
            part=instance.part,
        ).first()
        if stock and instance.stock_reserved:
            stock.quantity += instance.quantity
            stock.save(update_fields=['quantity'])
        instance.delete()


class TicketServiceView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]
    serializer_class = TicketServiceSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return TicketService.objects.none()

        user = self.request.user
        queryset = TicketService.objects.select_related('ticket').order_by('-id')
        if getattr(user, 'role', None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(ticket__location=user.location)
        return TicketService.objects.none()

    def perform_update(self, serializer):
        if not technician_can_edit_ticket(self.request.user, serializer.instance.ticket):
            raise PermissionDenied('Tylko przypisany pracownik może modyfikować usługi.')
        serializer.save()

    def perform_create(self, serializer):
        ticket = serializer.validated_data['ticket']
        if not technician_can_edit_ticket(self.request.user, ticket):
            raise PermissionDenied('Tylko przypisany pracownik może dodawać usługi.')
        if ticket.status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.WAITING_FOR_PARTS, Ticket.Status.IN_PROGRESS]:
            raise serializers.ValidationError('Usługi można dodawać tylko podczas realizacji zgłoszenia.')
        if self.request.user.role != 'OWNER' and ticket.location_id != self.request.user.location_id:
            raise PermissionDenied('Nie możesz dodać usługi do zgłoszenia z innej lokalizacji.')
        serializer.save()

    def perform_destroy(self, instance):
        if not technician_can_edit_ticket(self.request.user, instance.ticket):
            raise PermissionDenied('Tylko przypisany pracownik może usuwać usługi.')
        if instance.ticket.status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.WAITING_FOR_PARTS, Ticket.Status.IN_PROGRESS]:
            raise serializers.ValidationError('Usługi można usuwać tylko podczas realizacji zgłoszenia.')
        instance.delete()
class PublicTicketStatusView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicTicketStatusSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_tracking'

    @extend_schema(responses=PublicTicketStatusSerializer)
    def post(self, request):
        ticket_code = request.data.get('ticket_code')
        phone_number = request.data.get('phone_number')

        if not ticket_code or not phone_number:
            return Response(
                {"detail": "Podaj kod zgłoszenia oraz numer telefonu."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ticket = Ticket.objects.filter(
            ticket_code=ticket_code,
            client__phone_number=phone_number
        ).select_related('location').prefetch_related('status_history').first()

        if not ticket:
            return Response(
                {"detail": "Nie znaleziono zgłoszenia o podanych danych."},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            "ticket_code": ticket.ticket_code,
            "device_name": ticket.device_name,
            "status": ticket.get_status_display(),
            "location_name": ticket.location.name,
            "estimated_cost": ticket.estimated_cost,
            "final_cost": ticket.final_cost,
            "updated_at": ticket.updated_at,
            "history": TicketStatusHistorySerializer(ticket.status_history.all(), many=True).data
        })


class PublicEmailCodeRequestView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicEmailRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_tracking'

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        now = timezone.now()
        request_ip = request.META.get('REMOTE_ADDR')
        generic_response = {
            'detail': 'Jeśli dla tego adresu istnieją zgłoszenia, wyślemy kod weryfikacyjny.'
        }

        recent_email_requests = PublicEmailVerification.objects.filter(
            email=email,
            created_at__gte=now - timedelta(hours=1),
        ).count()
        recent_ip_requests = PublicEmailVerification.objects.filter(
            request_ip=request_ip,
            created_at__gte=now - timedelta(hours=1),
        ).count()
        if recent_email_requests >= 5 or recent_ip_requests >= 20:
            return Response(generic_response, status=status.HTTP_202_ACCEPTED)

        if not Ticket.objects.filter(client__email__iexact=email).exists():
            return Response(generic_response, status=status.HTTP_202_ACCEPTED)

        code = f'{secrets.randbelow(1_000_000):06d}'
        verification = PublicEmailVerification.objects.create(
            email=email,
            code_hash=make_password(code),
            expires_at=now + timedelta(minutes=10),
            request_ip=request_ip,
        )
        try:
            send_mail(
                subject='Kod dostępu do zgłoszeń serwisowych',
                message=f'Twój kod weryfikacyjny to: {code}. Kod jest ważny przez 10 minut.',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                recipient_list=[email],
                fail_silently=False,
            )
        except (OSError, smtplib.SMTPException):
            verification.delete()
            return Response(
                {'detail': 'Nie udało się wysłać wiadomości e-mail. Spróbuj ponownie później.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(generic_response, status=status.HTTP_202_ACCEPTED)


class PublicEmailCodeVerifyView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicEmailVerifySerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'email_verify'

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        code = serializer.validated_data['code']
        now = timezone.now()

        verification = PublicEmailVerification.objects.filter(
            email=email,
            used_at__isnull=True,
            expires_at__gt=now,
        ).first()
        if not verification or verification.attempts >= 5:
            return Response({'detail': 'Nieprawidłowy lub wygasły kod.'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_password(code, verification.code_hash):
            verification.attempts += 1
            verification.save(update_fields=['attempts'])
            return Response({'detail': 'Nieprawidłowy lub wygasły kod.'}, status=status.HTTP_400_BAD_REQUEST)

        verification.used_at = now
        verification.save(update_fields=['used_at'])
        tracking_token = signing.dumps({'email': email}, salt='public-ticket-tracking')
        return Response({'tracking_token': tracking_token}, status=status.HTTP_200_OK)


class PublicTicketListView(GenericAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_tracking'

    def post(self, request):
        tracking_token = request.data.get('tracking_token')
        if not tracking_token:
            return Response({'detail': 'Brak tokenu śledzenia.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = signing.loads(
                tracking_token,
                salt='public-ticket-tracking',
                max_age=15 * 60,
            )
        except (signing.BadSignature, TypeError, ValueError):
            return Response({'detail': 'Token śledzenia jest nieprawidłowy lub wygasł.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not isinstance(payload, dict) or not payload.get('email'):
            return Response({'detail': 'Token śledzenia jest nieprawidłowy lub wygasł.'}, status=status.HTTP_401_UNAUTHORIZED)

        tickets = Ticket.objects.filter(
            client__email__iexact=payload['email'],
        ).select_related('location').order_by('-updated_at')
        page = self.paginate_queryset(tickets)
        serializer = PublicTicketSummarySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

class ServiceView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action not in ['list', 'retrieve']:
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ServiceReadSerializer
        return ServicePricingWriteSerializer

    def get_queryset(self):
        location = self.request.user.location
        location_prices = LocationServicePrice.objects.none()
        if location:
            location_prices = LocationServicePrice.objects.filter(location=location)
        queryset = ServicePricing.objects.all()
        if self.action == 'list' and self.request.user.role != 'OWNER':
            queryset = queryset.filter(is_active=True)
        return queryset.prefetch_related(
            Prefetch(
                'location_prices',
                queryset=location_prices,
                to_attr='requested_location_prices',
            )
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['location'] = self.request.user.location
        return context


class LocationServicePriceView(viewsets.ModelViewSet):
    serializer_class = LocationServicePriceSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsOwnerOrManager()]

    def get_queryset(self):
        user = self.request.user
        queryset = LocationServicePrice.objects.select_related('service', 'location')
        if getattr(user, 'role', None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(location=user.location)
        return queryset.none()