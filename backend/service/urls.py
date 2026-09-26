from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TicketViewSet,
    TicketPartViewSet,
    TicketServiceViewSet,
    PublicTicketStatusView,
    ServiceViewSet,
    LocationServicePriceViewSet,
)

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='ticket')
router.register(r'ticket-parts', TicketPartViewSet, basename='ticket-part')
router.register(r'ticket-services', TicketServiceViewSet, basename='ticket-service')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'location-service-prices', LocationServicePriceViewSet, basename='location-service-price')

urlpatterns = [
    # Dedykowany endpoint publiczny (musi być przed include(router.urls))
    path('public-status/', PublicTicketStatusView.as_view(), name='public-ticket-status'),
    path('', include(router.urls)),
]