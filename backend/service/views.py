from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from .models import Ticket, TicketPart
from .serializers import (
    TicketReadSerializer,
    TicketWriteSerializer,
    TicketPartReadSerializer,
    TicketPartWriteSerializer,
)
from inventory.models import Stock

class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter,filters.OrderingFilter]
    search_fields = ['ticket_code','device_name','serial_number','client__first_name','client__last_name','client__phone_number']
    ordering_fields = ['created_at','updated_at','status']

    def get_queryset(self):
        user = self.request.user
        queryset = Ticket.objects.select_related('client','location','assigned_worker').prefetch_related('status_history','user_parts__part')
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
            new_status = request.data.get('status')
            comment = request.data.get('comment','')

            if not new_status or new_status not in Ticket.Status.values:
                return Response({"detail": "Wybrany status jest nieprawidłowy"},status=status.HTTP_400_BAD_REQUEST)
            ticket.status = new_status
            ticket.save(user=request.user, comment=comment)

            return Response(TicketReadSerializer(ticket).data, status=status.HTTP_200_OK)

class TicketPartViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = TicketPart.objects.select_related('ticket','part')

        if getattr(user,'role',None) == 'OWNER':
            return queryset
        if user.location:
            return queryset.filter(ticket__location=user.location)
        return TicketPart.objects.none()

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return TicketReadSerializer
        return TicketWriteSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        ticket_part = serializer.save()

        stock = Stock.objects.select_for_update().filter(location=ticket_part.ticket.location,part=ticket_part.part).firt()

        if not stock or stock.quantity <ticket_part.quantity:
            raise serializers.ValidationError({"quantity":"Brak wystarczającej liczby części w magazynie oddziału."})

        stock.quantity -= ticket_part.quantity
        stock.save()