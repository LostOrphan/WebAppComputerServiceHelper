from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasActiveLocation, IsOwnerOrManager
from .models import Client
from .serializers import ClientSerializer, ClientMinimalSerializer

class ClientView(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name','last_name','phone_number','email']
    ordering_fields = ['created_at','last_name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'create']:
            return [HasActiveLocation()]
        return [IsOwnerOrManager(), HasActiveLocation()]

    def get_queryset(self):
        queryset = Client.objects.all().order_by('-created_at')
        if self.request.user.role == 'OWNER':
            return queryset
        if not self.request.user.location:
            return queryset.none()
        return queryset.filter(
            Q(location=self.request.user.location)
            | Q(tickets__location=self.request.user.location),
        ).distinct()

    def perform_create(self, serializer):
        location = self.request.user.location
        serializer.save(location=location)

    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('minimal')=='true':
            return ClientMinimalSerializer
        return ClientSerializer

    @action(detail=True,methods=['post'],url_path="anonymize")
    def anonymize(self,request,pk=None):
        client = self.get_object()

        if client.is_anonymized:
            return Response({"detail":"Profil został już zanonimizowany"},status=status.HTTP_400_BAD_REQUEST)
        client.anonymize()

        serializer = self.get_serializer(client)
        return Response(
            {"detail": "Dane klienta zostały zanonimizowane.", "client": serializer.data},status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        if client.is_anonymized:
            return Response(
                {"detail": "Profil został już zanonimizowany."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        client.anonymize()
        return Response(status=status.HTTP_204_NO_CONTENT)