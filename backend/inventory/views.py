from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from accounts.permissions import HasActiveLocation, IsOwner, IsOwnerOrManager
from .models import PartCategory, Part, Stock
from .serializers import PartCategorySerializer, PartSerializer, StockReadSerializer, StockWriteSerializer

class PartCategoryView(viewsets.ModelViewSet):
    queryset = PartCategory.objects.all().order_by('name')
    serializer_class = PartCategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated(), HasActiveLocation()]
        return [IsOwner()]

class PartView(viewsets.ModelViewSet):
    queryset = Part.objects.all().select_related('category').order_by('name')
    serializer_class = PartSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsOwnerOrManager(), HasActiveLocation()]
        return [permissions.IsAuthenticated(), HasActiveLocation()]

    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'sku', 'ean', 'brand', 'category__name']
    
    def perform_create(self, serializer):
        part = serializer.save()

        if self.request.user.location:
            Stock.objects.create(
                part=part,
                location=self.request.user.location,
                quantity=0,
                min_quantity=2,
            )

class StockView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasActiveLocation]
    filter_backends = [filters.SearchFilter]
    search_fields = ['part__name', 'part__sku', 'part__ean']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Stock.objects.none()

        user = self.request.user
        queryset = Stock.objects.all().select_related(
            'part', 'part__category', 'location', 'location__city'
        ).order_by('part__name', 'part_id', 'location_id', 'id')
        if getattr(user, 'role', None) == 'OWNER':
            visible_queryset = queryset
        elif user.location:
            visible_queryset = queryset.filter(location=user.location)
        else:
            return Stock.objects.none()

        category_id = self.request.query_params.get('category')
        if category_id:
            visible_queryset = visible_queryset.filter(part__category_id=category_id)

        location_id = self.request.query_params.get('location')
        if location_id and getattr(user, 'role', None) == 'OWNER':
            visible_queryset = visible_queryset.filter(location_id=location_id)

        return visible_queryset

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return StockReadSerializer
        return StockWriteSerializer

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        queryset = self.get_queryset()
        low_stock_items = [stock for stock in queryset if stock.is_low_stock]
        page = self.paginate_queryset(low_stock_items)
        serializer = StockReadSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['post'], url_path='receive-goods')
    def receive_goods(self, request):
        identifier = request.data.get('identifier')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Ilość musi być prawidłową liczbą całkowitą."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if quantity <= 0:
            return Response(
                {"detail": "Ilość musi być większa od zera."},
                status=status.HTTP_400_BAD_REQUEST
            )
        user_location = request.user.location

        if not user_location:
            return Response(
                {"detail": "Brak przypisanego oddziału. Zaloguj się jako pracownik oddziału."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not identifier:
            return Response(
                {"detail": "Brak identyfikatora części (SKU, EAN lub ID)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        lookup = Q(sku=identifier) | Q(ean=identifier)
        if str(identifier).isdigit() and len(str(identifier)) < 8:
            lookup |= Q(id=identifier)

        part = Part.objects.filter(lookup).first()

        if not part:
            return Response(
                {"detail": "Produkt nie istnieje. Otwórz formularz nowej części.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND
            )

        stock, created = Stock.objects.get_or_create(
            part=part,
            location=user_location,
            defaults={'quantity': 0, 'min_quantity': 2}
        )
        
        stock.add_quantity(quantity)

        return Response({
            "message": "Pomyślnie dodano sztuki do magazynu.",
            "part_name": part.name,
            "part_sku": part.sku,
            "new_quantity": stock.quantity
        }, status=status.HTTP_200_OK)