from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Client
from .serializers import ClientSerializer, ClientMinimalSerializer

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    seraching_fields = ['first_name','last_name','phone_number','email']
    ordering_fields = ['created_at','last_name']

    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('minimal')=='true':
            return ClientMinimalSerializer
        return ClientSerializer

    @action(detail=True,methods=['post'],url_path="anonymize")
    def anonymize(self,request,pk=None):
        client = self.get_object()

        if client.is_anonymized:
            return Response({"detail":"Profil został już zanonimizowany"},status=status.HTTP_400_BAD_REQUEST)
        client.first_name = "Klient"
        client.last_name = f"Zanonimizowany #{client.id}"
        client.phone_number = ""
        client.email = None
        client.is_anonymized = True
        client.save()

        serializer = self.get_serializer(client)
        return Response(
            {"detail": "Dane klienta zostały zanonimizowane.", "client": serializer.data},status=status.HTTP_200_OK)