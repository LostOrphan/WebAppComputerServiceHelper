from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Ticket, TicketPart, TicketService, ServicePricing, LocationServicePrice
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
    PublicTicketStatusSerializer,
)
from inventory.models import Stock
from accounts.permissions import HasActiveLocation, IsOwner, IsOwnerOrManager

class TicketView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]
    filter_backends = [filters.SearchFilter,filters.OrderingFilter]
    search_fields = ['ticket_code','device_name','serial_number','client__first_name','client__last_name','client__phone_number']
    ordering_fields = ['created_at','updated_at','status']

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

        return location_queryset

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
        comment = serializer.validated_data.pop('comment','')
        serializer.save(user=self.request.user, comment=comment)

    @action(detail=True,methods=['post'],url_path='change-status')
    @transaction.atomic
    def change_status(self,request,pk=None):
        ticket = Ticket.objects.select_for_update().get(pk=self.get_object().pk)
        if request.user.role == 'TECHNICIAN' and ticket.assigned_worker_id != request.user.id:
            return Response({"detail": "Tylko przypisany pracownik może zmienić status."}, status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get('status')
        comment = request.data.get('comment','')
        if not new_status or new_status not in Ticket.Status.values:
            return Response({"detail": "Wybrany status jest nieprawidłowy"},status=status.HTTP_400_BAD_REQUEST)
        if not ticket.can_transition_to(new_status):
            return Response(
                {"detail": "Nie można wykonać tej zmiany statusu."},
                status=status.HTTP_409_CONFLICT,
            )
        ticket.status = new_status
        ticket.save(user=request.user, comment=comment)
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
        ticket.save(user=request.user, comment=request.data.get('comment', 'Pracownik przyjął zgłoszenie'))
        return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

class TicketPartView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return TicketPart.objects.none()

        user = self.request.user
        queryset = TicketPart.objects.select_related('ticket','part')

        if getattr(user,'role',None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(ticket__location=user.location)
        return TicketPart.objects.none()

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return TicketPartReadSerializer
        return TicketPartWriteSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        ticket = serializer.validated_data['ticket']
        if self.request.user.role != 'OWNER' and ticket.location_id != self.request.user.location_id:
            raise permissions.PermissionDenied('Nie możesz dodać części do zgłoszenia z innej lokalizacji.')
        ticket_part = serializer.save()

        stock = Stock.objects.select_for_update().filter(location=ticket_part.ticket.location,part=ticket_part.part).first()

        if not stock or stock.quantity <ticket_part.quantity:
            raise serializers.ValidationError({"quantity":"Brak wystarczającej liczby części w magazynie oddziału."})

        stock.quantity -= ticket_part.quantity
        stock.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        stock = Stock.objects.select_for_update().filter(
            location=instance.ticket.location,
            part=instance.part,
        ).first()
        if stock:
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
        queryset = TicketService.objects.select_related('ticket')
        if getattr(user, 'role', None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(ticket__location=user.location)
        return TicketService.objects.none()

    def perform_create(self, serializer):
        ticket = serializer.validated_data['ticket']
        if ticket.status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.WAITING_FOR_PARTS, Ticket.Status.IN_PROGRESS]:
            raise serializers.ValidationError('Usługi można dodawać tylko podczas realizacji zgłoszenia.')
        if self.request.user.role != 'OWNER' and ticket.location_id != self.request.user.location_id:
            raise permissions.PermissionDenied('Nie możesz dodać usługi do zgłoszenia z innej lokalizacji.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.ticket.status not in [Ticket.Status.DIAGNOSIS, Ticket.Status.WAITING_FOR_PARTS, Ticket.Status.IN_PROGRESS]:
            raise serializers.ValidationError('Usługi można usuwać tylko podczas realizacji zgłoszenia.')
        instance.delete()
class PublicTicketStatusView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicTicketStatusSerializer

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
        # Zwracamy aktywne usługi
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
        # Automatycznie przekazujemy lokację zalogowanego pracownika do serializera
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