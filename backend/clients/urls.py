from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientView

router = DefaultRouter()
router.register(r'clients', ClientView, basename='client')

urlpatterns = [
    path('', include(router.urls)),
]