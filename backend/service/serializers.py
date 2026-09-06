from rest_framework import serializers
from .models import Ticket, TicketStatusHistory, TicketPart
from clients.serializers import ClientMinimalSerializer
from accounts.serializers import UserReadSerializer
from inventory.serializers import PartSerializer

class TicketStatusHistorySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display',read_only=True)
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketStatusHistory
        fields = ['id','status','status_display','changed_at','changed_by_name','comment']

    def get_changed_by_name(self,obj) -> str:
        return obj.changed_by.get_full_name() if obj.changed_by else "System"

class TicketPartReadSerializer(serializers.ModelSerializer):
    part = PartSerializer(read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = TicketPart
        fields = ['id','part','quantity','price_at_use','total_price']

    def get_total_price(self,obj) -> float:
        return obj.quantity*obj.price_at_use

class TicketPartWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketPart
        fields = ['id','ticket','part','quantity','price_at_use']
        extra_kwargs = {'price_at_use': {'required':False}}

    def validate_quantity(self,value):
        if value<=0:
            raise serializers.ValidationError("Wartość musi być większa od zera")
        return value

    def create(self,validated_data):
        if 'price_at_use' not in validated_data:
            validated_data['price_at_use'] = validated_data['part'].sell_price_gross
        return super().create(validated_data)

class TicketReadSerializer(serializers.ModelSerializer):
    client = ClientMinimalSerializer(read_only=True)
    assigned_worker = UserReadSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_history = TicketStatusHistorySerializer(many=True, read_only=True)
    used_parts = TicketPartReadSerializer(many=True, read_only=True)
    total_parts_cost = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_code', 'client', 'location', 'assigned_worker',
            'device_name', 'serial_number', 'device_passcode', 
            'problem_description', 'diagnosis_note', 'status', 'status_display',
            'estimated_cost', 'final_cost', 'total_parts_cost',
            'used_parts', 'status_history', 'created_at', 'updated_at'
        ]

    def get_total_parts_cost(self, obj) -> float:
        total_parts_cost = 0
        for part in obj.used_parts.all():
            total_parts_cost += part.quantity * part.price_at_use
        return total_parts_cost


class TicketWriteSerializer(serializers.ModelSerializer):
    comment = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'client', 'location', 'assigned_worker',
            'device_name', 'serial_number', 'device_passcode',
            'problem_description', 'diagnosis_note', 'status',
            'estimated_cost', 'final_cost', 'comment'
        ]

    def validate(self, attrs):
        parts_cost = 0
        final_cost = attrs.get('final_cost')
        if final_cost is not None and self.instance:
            for part in self.instance.used_parts.all():
                parts_cost += part.quantity * part.price_at_use
            if final_cost < parts_cost:
                raise serializers.ValidationError({
                    "final_cost": f"Koszt końcowy ({final_cost}) nie może być niższy niż suma użytych części ({parts_cost})."
                })
        return attrs    


class PublicTicketStatusSerializer(serializers.Serializer):
    ticket_code = serializers.CharField()
    device_name = serializers.CharField()
    status = serializers.CharField()
    location_name = serializers.CharField()
    estimated_cost = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    final_cost = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    updated_at = serializers.DateTimeField()
    history = TicketStatusHistorySerializer(many=True)