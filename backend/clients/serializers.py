from rest_framework import serializers
from .models import Client

class ClientSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    active_tickets_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'first_name', 'last_name', 'full_name', 'phone_number', 'email', 'is_anonymized', 'active_tickets_count', 'created_at']
        read_only_fields = ['id','is_anonymized','created_at']
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
    def get_active_tickets_count(self,obj):
        return obj.tickets.exclude(status__in=['CLOSED','REJECTED']).count()
    def validate(self,attrs):
        if self.instance and self.instance.is_anonymized:
            raise serializers.ValidationError("Nie można edytować zanonimizowanego konta")
        return attrs
class ClientMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id','first_name','last_name','phone_number','email']