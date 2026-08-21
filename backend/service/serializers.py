from rest_framework import serializers
from .models import Ticket, TicketStatusHistory, TicketPart
from clients.serializers import ClientMinimalSerializer
from accounts.serializers import UserReadSerializer
from inventory.serializers import PartSerializer

class TicketStatusHistorySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display',read_only=True)
    change_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketStatusHistory
        fields = ['id','status','status_display','changed_at','changed_by_name','comment']

    def get_changed_by_name(self,obj):
        return obj.changed_by.get_full_name() if obj.changed_by else "System"

class TicketPartReadSerializer(serializers.ModelSerializer):
    """Odczyt wykorzystywanych części z szczegółami katalogu"""
    part = PartSerializer(read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = TicketPart
        fields = ['id','part','quantity','price_at_use','total_price']

    def get_total_price(self,obj):
        return obj.quantity*obj.price_at_use

class TicketPartWriteSerializer(serializers.ModelSerializer):
    """Dodawanie części do naprazy z zapamiętaniem aktualnej ceny"""
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
                validated_data['price_at_use'] = validated_data['part'].default_price
            return super().create(validated_data)

class TicketReadSerializer(serializers.ModelSerializer):
    """Pełen podgląd naprawy (GET)"""
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

    def get_total_parts_cost(self, obj):
        """Sumowanie kosztu wszystkich zużytych części."""
        return sum(part.quantity * part.price_at_use for part in obj.used_parts.all())


class TicketWriteSerializer(serializers.ModelSerializer):
    """Tworzenie i aktualizacja zgłoszenia (POST, PUT, PATCH)."""
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
        # Wycena końcowa nie powinna być niższa od kosztu części
        final_cost = attrs.get('final_cost')
        if final_cost is not None and self.instance:
            parts_cost = sum(p.quantity * p.price_at_use for p in self.instance.used_parts.all())
            if final_cost < parts_cost:
                raise serializers.ValidationError({
                    "final_cost": f"Koszt końcowy ({final_cost}) nie może być niższy niż suma użytych części ({parts_cost})."
                })
        return attrs    