from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, City, Location

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'role', 'location', 'is_staff')
    list_filter = ('role', 'location', 'is_staff', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('Informacje firmowe (Custom)', {'fields': ('role', 'location')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informacje firmowe (Custom)', {'fields': ('role', 'location')}),
    )

@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'address', 'email', 'is_active')
    list_filter = ('city', 'is_active')