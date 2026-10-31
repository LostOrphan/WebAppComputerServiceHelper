from rest_framework import  serializers
from django.contrib.auth import get_user_model
from .models import City, Location, LocationOpeningHours

User = get_user_model()

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = [
            'id',
            'name',
            'simc_code',
            'locality_type',
            'voivodeship',
            'county_code',
            'municipality_code',
        ]

class LocationReadSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)
    opening_hours = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id','name','address','postal_code','city','phone_number','email','is_active','opening_hours']

    def get_opening_hours(self, obj):
        return LocationOpeningHoursSerializer(obj.opening_hours.all(), many=True).data


class LocationOpeningHoursSerializer(serializers.ModelSerializer):
    weekday_name = serializers.CharField(source='get_weekday_display', read_only=True)

    class Meta:
        model = LocationOpeningHours
        fields = ['id', 'location', 'weekday', 'weekday_name', 'opens_at', 'closes_at', 'is_closed']
        read_only_fields = ['id', 'location', 'weekday', 'weekday_name']

    def validate(self, attrs):
        is_closed = attrs.get('is_closed', self.instance.is_closed if self.instance else False)
        opens_at = attrs.get('opens_at', self.instance.opens_at if self.instance else None)
        closes_at = attrs.get('closes_at', self.instance.closes_at if self.instance else None)
        if not is_closed and (not opens_at or not closes_at or closes_at <= opens_at):
            raise serializers.ValidationError('Podaj poprawny przedział godzin albo oznacz dzień jako zamknięty.')
        return attrs

class LocationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id','name','address','postal_code','city','phone_number','email','is_active']

class UserReadSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display',read_only=True)
    location = LocationReadSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id','username','first_name','last_name','full_name','role','role_display','location','is_active','is_staff']

    def get_full_name(self,obj):
        return obj.get_full_name() or obj.username #funkcja AbstractUser

class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True,required=False,style={'input_type':'password'})

    class Meta:
        model = User
        fields = ['id','username','password','first_name','last_name','role','location','is_active']
    def validate(self,attrs):
        request = self.context.get('request')
        location = attrs.get('location')

        if location and not location.is_active:
            raise serializers.ValidationError({'location': 'Nie można przypisać pracownika do nieaktywnej lokalizacji.'})

        if request and request.user:
            current_user = request.user
            if current_user.role == 'MANAGER':
                if attrs.get('role') == 'OWNER':
                    raise serializers.ValidationError({"role":"Nie masz uprawnień do wykonania tej operacji."})
                attrs['location'] = current_user.location

                if current_user.location and not current_user.location.is_active:
                    raise serializers.ValidationError({'location': 'Nie można przypisać pracownika do nieaktywnej lokalizacji.'})
        return super().validate(attrs)

    def create(self,validated_data):
        password = validated_data.pop('password',None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self,instance,validated_data):
        password = validated_data.pop('password',None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

class UserMeSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display',read_only=True)
    location_name = serializers.CharField(source='location.name',read_only=True)

    class Meta:
        model = User
        fields = ['id','username','first_name','last_name','role','role_display','location','location_name']