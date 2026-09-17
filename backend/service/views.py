from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Ticket, TicketPart
from .serializers import TicketStatusHistorySerializer
from django.db import transaction
from .serializers import (
    TicketReadSerializer,
    TicketWriteSerializer,
    TicketPartReadSerializer,
    TicketPartWriteSerializer,
    PublicTicketStatusSerializer,
)
from inventory.models import Stock
from accounts.permissions import HasActiveLocation

class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]
    filter_backends = [filters.SearchFilter,filters.OrderingFilter]
    search_fields = ['ticket_code','device_name','serial_number','client__first_name','client__last_name','client__phone_number']
    ordering_fields = ['created_at','updated_at','status']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Ticket.objects.none()

        user = self.request.user
        queryset = Ticket.objects.select_related('client','location','assigned_worker').prefetch_related('status_history','used_parts__part')
        # Właściciel widzi wszystkie zgłoszenia
        if getattr(user,'role',None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(location=user.location)
        return Ticket.objects.none()

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return TicketReadSerializer
        return TicketWriteSerializer
    def perform_create(self, serializer):
        comment = serializer.validated_data.pop('comment','Utworzenie zgłoszenia w systemie')
        serializer.save(user=self.request.user,comment=comment)
    def perform_update(self, serializer):
        comment = serializer.validated_data.pop('comment','')
        serializer.save(user=self.request.user, comment=comment)

    @action(detail=True,methods=['post'],url_path='change-status')
    def change_status(self,request,pk=None):
        ticket = self.get_object()
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

        if ticket.assigned_worker_id:
            return Response(
                {"detail": "To zgłoszenie jest już przypisane do pracownika."},
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

class TicketPartViewSet(viewsets.ModelViewSet):
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