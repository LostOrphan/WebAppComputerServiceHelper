from django.db import models
from django.contrib.auth.models import AbstractUser
from phonenumber_field.modelfields import PhoneNumberField

class Voivodeship(models.Model):
    code = models.CharField(max_length=2, unique=True)
    name = models.CharField(max_length=100)
    class Meta:
        verbose_name_plural = "Voivodeships"
        ordering = ['name']
    def __str__(self):
        return self.name
#imported from SIMC
class City(models.Model):
    name = models.CharField(max_length=150)
    simc_code = models.CharField(max_length=7, unique=True)
    simc_parent_code = models.CharField(max_length=7, blank=True)
    locality_type = models.CharField(max_length=3)
    voivodeship = models.ForeignKey(Voivodeship, on_delete=models.PROTECT)
    county_code = models.CharField(max_length=3)
    municipality_code = models.CharField(max_length=3)
    municipality_type = models.CharField(max_length=1)
    class Meta:
        verbose_name_plural = "Cities"
        ordering = ['name', 'voivodeship__name']
    def __str__(self):
        return self.name
    
class Location(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    postal_code = models.CharField(max_length=10)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name='locations')
    phone_number = PhoneNumberField(blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.city.name}"

class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Szef firmy'
        MANAGER = 'MANAGER', 'Kierownik serwisu'
        TECHNICIAN = 'TECHNICIAN', 'Serwisant'
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TECHNICIAN)
    location = models.ForeignKey(Location,on_delete=models.SET_NULL,null=True,blank=True,related_name='employees')

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    #Dane dziedziczone z AbstractUser:
    #username (taktowane rowniez login)
    #password
    #first_name
    #last_name
    #email [bedzie pomijane]
    #is_staff
    #is_active
    #date_joined
    #last_login