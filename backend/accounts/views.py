from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import City, Location
from .permissions import IsOwner, IsOwnerOrManager, IsOwnerOrReadOnly
from .serializers import (
    CitySerializer,
    LocationReadSerializer,
    LocationWriteSerializer,
    UserReadSerializer,
    UserWriteSerializer,
    UserMeSerializer,
)

User = get_user_model()

class CityView(viewsets.ModelViewSet):
    queryset = City.objects.all().order_by('name')
    serializer_class = CitySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = City.objects.filter(
            locality_type='96'
        ).select_related('voivodeship').order_by('name')
        search = self.request.query_params.get('search', '').strip()

        if search:
            queryset = queryset.filter(name__istartswith=search)

        return queryset[:20]
class LocationView(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_permissions(self):
        if self.action == 'public':
            return [permissions.AllowAny()]
        return super().get_permissions()
    
    def get_queryset(self):
        user = self.request.user
        # Właściciel widzi wszystkei lokacje, pozostali tylko aktywne
        if getattr(user,'role',None) == 'OWNER':
            return Location.objects.all().select_related('city').order_by('-is_active', 'name')
        return Location.objects.filter(is_active=True).select_related('city').order_by('name')

    def get_serializer_class(self):
        if self.action in ['list','retrieve']:
            return LocationReadSerializer
        return LocationWriteSerializer

    @action(detail=False, methods=['get'], url_path='public')
    def public(self, request):
        locations = Location.objects.filter(is_active=True).select_related(
            'city', 'city__voivodeship'
        ).order_by('name')
        serializer = LocationReadSerializer(locations, many=True)
        return Response(serializer.data)

class UserView(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action == 'me':
            return [permissions.IsAuthenticated()]
        return [IsOwnerOrManager()]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return User.objects.none()

        user = self.request.user
        is_archived_view = self.action == 'archived'
        users = User.objects.filter(is_active=not is_archived_view).select_related('location')

        # Właściciel widzi wszystkich aktywnych albo zarchiwizowanych użytkowników
        if getattr(user,'role',None) == 'OWNER':
            return users
        # Kierownik i pracownik widzi tylko pracowników swojego oddziału
        if user.location:
            return users.filter(location=user.location)
        # Brak przydzielonej lokacji -> widok tylko siebie
        return users.filter(id=user.id)

    def get_serializer_class(self):
        if self.action in ['list','retrieve','archived']:
            return UserReadSerializer
        return UserWriteSerializer

    @action(detail=False, methods=['get'], url_path='archived')
    def archived(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=False,methods=['get','patch'],url_path='me')
    def me(self,request):
        user = request.user

        if request.method == 'GET':
            serializer = UserMeSerializer(user)
            return Response(serializer.data)
        if request.method == 'PATCH':
            serializer = UserMeSerializer(user,data=request.data,partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)