from rest_framework import  serializers
from django.contrib.auth import get_user_model
from .models import City, Location

User = get_user_model()

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id','name']

class LocationReadSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)

    class Meta:
        model = Location
        fields = ['id','name','address','postal_code','city','phone_number','is_active']

class LocationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id','name','address','postal_code','city','phone_number','is_active']

class UserReadSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display',read_only=True)
    location = LocationReadSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id','username','first_name','last_name','full_name','role','role_display','location','is_active','is_staff']

    def get_full_name(self,obj) -> str:
        return obj.get_full_name() or obj.username #funkcja AbstractUser

class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True,required=False,style={'input_type':'password'})

    class Meta:
        model = User
        fields = ['id','username','password','first_name','last_name','role','location','is_active']

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