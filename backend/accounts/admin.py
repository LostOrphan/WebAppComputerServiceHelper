from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, City, Location

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    # Pola widoczne w głównej tabeli użytkowników
    list_display = ('username', 'first_name', 'last_name', 'role', 'location', 'is_staff')
    
    # Dodanie filtrów bocznych ułatwiających szukanie
    list_filter = ('role', 'location', 'is_staff', 'is_active')

    # Dodanie naszych customowych pól do widoku edycji profilu
    fieldsets = UserAdmin.fieldsets + (
        ('Informacje firmowe (Custom)', {'fields': ('role', 'location')}),
    )

    # Dodanie naszych customowych pól do widoku tworzenia nowego użytkownika
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informacje firmowe (Custom)', {'fields': ('role', 'location')}),
    )

# Przy okazji rejestrujemy Miasta i Lokalizacje, jeśli jeszcze tego nie zrobiłeś:
@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'address', 'email', 'is_active')
    list_filter = ('city', 'is_active')