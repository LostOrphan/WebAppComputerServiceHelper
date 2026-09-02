from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PartCategory, Part, Stock
from .serializers import (
    PartCategorySerializer,
    PartSerializer,
    StockReadSerializer,
    StockWriteSerializer,
)

class PartCategoryViewSet(viewsets.ModelViewSet):
    queryset = PartCategory.objects.all().order_by('name')
    serializer_class = PartCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all().select_related('category').order_by('name')
    serializer_class = PartSerializer
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [filters.SearchFilter]
    search_fields = ['name','code','category__name']

class StockViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['part__name','part__code']

    def get_queryset(self):
        user = self.request.user
        queryset = Stock.objects.all().select_related('part','part__category','location','location__city')
        if getattr(user,'role',None) == 'OWNER':
            return queryset

        if user.location:
            return queryset.filter(location=user.location)

        return Stock.objects.none()

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return StockReadSerializer
        return StockWriteSerializer

    @action(detail=False,methods=['get'],url_path='low-stock')
    def low_stock(self,request):
        queryset = self.get_queryset()
        low_stock_items = [stock for stock in queryset if stock.is_low_stock]
        serializer = StockReadSerializer(low_stock_items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    