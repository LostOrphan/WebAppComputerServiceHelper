from rest_framework import serializers
from .models import PartCategory, Part, Stock
from accounts.serializers import LocationReadSerializer

class PartCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartCategory
        fields = ['id','name']

class PartSerializer(serializers.ModelSerializer):
    """Katalog części (dane ogólne)"""
    category_name = serializers.CharField(source='category.name',read_only=True)

    class Meta:
        model = Part
        fields = ['id','name','code','category','category_name','default_price','description']

    def validate_default_price(self,value):
        if value<0:
            raise serializers.ValidationError("Wartość nie może być ujemna")
        return value

class StockReadSerializer(serializers.ModelSerializer):
    """Podgląd części magazynowych (GET)"""
    part = PartSerializer(read_only=True)
    location = LocationReadSerializer(read_only=True)
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = Stock
        fields = ['id','part','location','quantity','min_quantity','is_low_stock']

class StockWriteSerializer(serializers.ModelSerializer):
    """Aktualizacja i dodawanie stanów magazynowych (POST,PUT,PATCH)"""
    class Meta:
        model = Stock
        fields = ['id','part','location','quantity','min_quantity']

    def validate_quantity(self,value):
        if value<0:
            raise serializers.ValidationError("Wartość nie może być mniejsza od 0")
        return value
    