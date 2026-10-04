from rest_framework import serializers
from .models import PartCategory, Part, Stock
from accounts.serializers import LocationReadSerializer

class PartCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartCategory
        fields = ['id', 'name']

class PartSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    sku = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Part
        fields = [
            'id', 'name', 'brand', 'sku', 'ean', 'category', 'category_name',
            'default_buy_price_net', 'sell_price_gross', 'unit', 'specifications'
        ]

    def validate_default_buy_price_net(self, value):
        if value < 0:
            raise serializers.ValidationError("Wartość nie może być ujemna")
        return value

    def validate_sell_price_gross(self, value):
        if value < 0:
            raise serializers.ValidationError("Wartość nie może być ujemna")
        return value

class StockReadSerializer(serializers.ModelSerializer):
    part = PartSerializer(read_only=True)
    location = LocationReadSerializer(read_only=True)
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = Stock
        fields = ['id', 'part', 'location', 'quantity', 'min_quantity', 'is_low_stock']

class StockWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = ['id', 'part', 'location', 'quantity', 'min_quantity']

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Wartość nie może być mniejsza od 0")
        return value