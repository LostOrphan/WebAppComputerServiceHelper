from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TicketView,
    TicketPartView,
    TicketServiceView,
    PublicTicketStatusView,
    PublicEmailCodeRequestView,
    PublicEmailCodeVerifyView,
    PublicTicketListView,
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
    path('public-track/request-code/', PublicEmailCodeRequestView.as_view(), name='public-track-request-code'),
    path('public-track/verify-code/', PublicEmailCodeVerifyView.as_view(), name='public-track-verify-code'),
    path('public-track/tickets/', PublicTicketListView.as_view(), name='public-track-tickets'),
    path('', include(router.urls)),
]