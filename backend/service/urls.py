from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TicketViewSet, TicketPartViewSet, PublicTicketStatusView

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='ticket')
router.register(r'ticket-parts', TicketPartViewSet, basename='ticket-part')

urlpatterns = [
    # Dedykowany endpoint publiczny (musi być przed include(router.urls))
    path('public-status/', PublicTicketStatusView.as_view(), name='public-ticket-status'),
    path('', include(router.urls)),
]