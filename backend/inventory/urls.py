from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PartCategoryView, PartView, StockView

router = DefaultRouter()
router.register(r'categories', PartCategoryView, basename='partcategory')
router.register(r'parts', PartView, basename='part')
router.register(r'stock', StockView, basename='stock')

urlpatterns = [
    path('', include(router.urls)),
]