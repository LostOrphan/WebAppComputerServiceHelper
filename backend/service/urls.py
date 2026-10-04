from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TicketView,
    TicketPartView,
    TicketServiceView,
    PublicTicketStatusView,
    ServiceView,
    LocationServicePriceView,
)

router = DefaultRouter()
router.register(r'tickets', TicketView, basename='ticket')
router.register(r'ticket-parts', TicketPartView, basename='ticket-part')
router.register(r'ticket-services', TicketServiceView, basename='ticket-service')
router.register(r'services', ServiceView, basename='service')
router.register(r'location-service-prices', LocationServicePriceView, basename='location-service-price')

urlpatterns = [
    path('public-status/', PublicTicketStatusView.as_view(), name='public-ticket-status'),
    path('', include(router.urls)),
]