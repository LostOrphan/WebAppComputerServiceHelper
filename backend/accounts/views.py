from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import City, Location
from .serializers import (
    CitySerializer,
    LocationReadSerializer,
    LocationWriteSerializer,
    UserReadSerializer,
    UserWriteSerializer,
    UserMeSerializer,
)

User = get_user_model()

class CityViewSet(viewsets.ModelViewSet):
    queryset = City.objects.all().order_by('name')
    serializer_class = CitySerializer
    permission_classes = [permissions.IsAuthenticated]

class LocationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Właściciel widzi wszystkei lokacje, pozostali tylko aktywne
        if getattr(user,'role',None) == 'OWNER':
            return Location.objects.all().select_related('city')
        return Location.objects.filter(is_active=True).select_related('city')

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return LocationReadSerializer
        return LocationWriteSerializer

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Właściciel widzi wszystkich pracowników
        if getattr(user,'role',None) == 'OWNER':
            return User.objects.all().select_related('location')
        # Kierownik i pracownik widzi tylko pracowników swojego oddziału
        if user.location:
            return User.objects.filter(localtion=user.location).select_related('location')
        # Brak przydzielonej lokacji -> widok tylko siebie
        return User.objects.filter(id=user.id)

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return UserReadSerializer
        return UserWriteSerializer

    @action(detail=False,methods=['get','patch'],url_path='me')
    def me(self,request):
        user = request.user

        if request.method == 'GET':
            serializer = UserMeSerializer(user)
            return Response(serializer.data)
        if request.method == 'PATCH':
            serializer = UserMeSerializer(user,data=request.data,partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save
            return Response(serializer.data)