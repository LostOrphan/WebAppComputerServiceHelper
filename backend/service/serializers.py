from rest_framework import serializers
from .models import Ticket, TicketStatusHistory, TicketAssignmentHistory, TicketPart, TicketService, ServicePricing, LocationServicePrice
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

class TicketAssignmentHistorySerializer(serializers.ModelSerializer):
    worker = UserReadSerializer(read_only=True)

    class Meta:
        model = TicketAssignmentHistory
        fields = ['id', 'worker', 'assigned_at']

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


class TicketServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketService
        fields = ['id', 'ticket', 'name', 'price']

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Cena nie może być ujemna.')
        return value

class TicketReadSerializer(serializers.ModelSerializer):
    client = ClientMinimalSerializer(read_only=True)
    assigned_worker = UserReadSerializer(read_only=True)
    created_by = UserReadSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_history = TicketStatusHistorySerializer(many=True, read_only=True)
    assignment_history = TicketAssignmentHistorySerializer(many=True, read_only=True)
    used_parts = TicketPartReadSerializer(many=True, read_only=True)
    used_services = TicketServiceSerializer(many=True, read_only=True)
    total_parts_cost = serializers.SerializerMethodField()
    total_services_cost = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_code', 'client', 'location', 'assigned_worker', 'created_by',
            'device_name', 'serial_number', 'device_passcode', 
            'problem_description', 'diagnosis_note', 'status', 'status_display',
            'estimated_cost', 'final_cost', 'total_parts_cost',
            'total_services_cost', 'total_cost', 'used_parts', 'used_services',
            'status_before_waiting_for_parts',
            'status_history', 'assignment_history', 'created_at', 'updated_at'
        ]

    def get_total_parts_cost(self, obj) -> float:
        total_parts_cost = 0
        for part in obj.used_parts.all():
            total_parts_cost += part.quantity * part.price_at_use
        return total_parts_cost

    def get_total_services_cost(self, obj) -> float:
        return sum(service.price for service in obj.used_services.all())

    def get_total_cost(self, obj) -> float:
        return self.get_total_parts_cost(obj) + self.get_total_services_cost(obj)


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

    def create(self, validated_data):
        user = validated_data.pop('user', None)
        comment = validated_data.pop('comment', '')
        ticket = Ticket(**validated_data)
        ticket.save(user=user, comment=comment)
        return ticket

    def update(self, instance, validated_data):
        user = validated_data.pop('user', None)
        comment = validated_data.pop('comment', '')
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(user=user, comment=comment)
        return instance

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        location = attrs.get('location', self.instance.location if self.instance else None)
        if self.instance and 'status' in attrs:
            raise serializers.ValidationError({
                'status': 'Status należy zmieniać przez dedykowany endpoint.'
            })
        if self.instance and 'assigned_worker' in attrs:
            raise serializers.ValidationError({
                'assigned_worker': 'Przypisanie należy zmieniać przez dedykowany workflow.'
            })
        if user and getattr(user, 'role', None) != 'OWNER' and location != user.location:
            raise serializers.ValidationError({'location': 'Zgłoszenie musi należeć do aktywnej lokalizacji pracownika.'})

        assigned_worker = attrs.get('assigned_worker')
        if assigned_worker and assigned_worker.role not in ['MANAGER', 'TECHNICIAN']:
            raise serializers.ValidationError({'assigned_worker': 'Do zgłoszenia można przypisać tylko pracownika serwisu.'})
        if assigned_worker and assigned_worker.location_id != location.id:
            raise serializers.ValidationError({'assigned_worker': 'Pracownik musi należeć do lokalizacji zgłoszenia.'})

        parts_cost = 0
        final_cost = attrs.get('final_cost')
        if final_cost is not None and self.instance:
            for part in self.instance.used_parts.all():
                parts_cost += part.quantity * part.price_at_use
            services_cost = sum(service.price for service in self.instance.used_services.all())
            total_cost = parts_cost + services_cost
            if final_cost < total_cost:
                raise serializers.ValidationError({
                    "final_cost": f"Koszt końcowy ({final_cost}) nie może być niższy niż suma części i usług ({total_cost})."
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


class PublicEmailRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PublicEmailVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)


class PublicTicketSummarySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_code', 'device_name', 'status', 'status_display',
            'location_name', 'created_at', 'updated_at',
        ]

class ServiceReadSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = ServicePricing
        fields = ['id', 'name', 'description', 'default_price', 'price', 'is_active', 'is_available']
        read_only_fields = fields

    def get_price(self, obj):
        location = self.context.get('location')
        if not location:
            return str(obj.default_price)

        loc_prices = getattr(obj, 'requested_location_prices', None)
        loc_price = loc_prices[0] if loc_prices else None
        if loc_price and loc_price.custom_price is not None:
            return str(loc_price.custom_price)

        return str(obj.default_price)

    def get_is_available(self, obj):
        location = self.context.get('location')
        if not location:
            return True
            
        loc_prices = getattr(obj, 'requested_location_prices', None)
        loc_price = loc_prices[0] if loc_prices else None
        if loc_price:
            return loc_price.is_available
        return True


class ServicePricingWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServicePricing
        fields = ['id', 'name', 'description', 'default_price', 'is_active']


class LocationServicePriceSerializer(serializers.ModelSerializer):
    effective_price = serializers.SerializerMethodField()
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = LocationServicePrice
        fields = [
            'id', 'location', 'service', 'service_name', 'custom_price',
            'is_available', 'effective_price',
        ]

    def get_effective_price(self, obj):
        return str(obj.effective_price)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        location = attrs.get('location', self.instance.location if self.instance else None)
        if user and getattr(user, 'role', None) == 'MANAGER' and location != user.location:
            raise serializers.ValidationError({
                'location': 'Możesz zmieniać ceny tylko dla swojego oddziału.'
            })
        return attrs