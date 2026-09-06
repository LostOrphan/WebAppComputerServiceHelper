from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CityView, LocationView, UserView

router = DefaultRouter()
router.register(r'cities', CityView, basename='city')
router.register(r'locations', LocationView, basename='location')
router.register(r'users', UserView, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]