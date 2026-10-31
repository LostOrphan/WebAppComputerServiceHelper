from django.db import models
from phonenumber_field.modelfields import PhoneNumberField

class Client(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone_number = PhoneNumberField(unique=True,null=True,blank=True)
    # Aktualna implementacja pozwalająca na sprawdzanie stanu zgłoszeń wymaga istnienie adresu email, wprwowadzenie sprawdania po sms pozwala na zmianę na opcjonalny
    email = models.EmailField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_anonymized = models.BooleanField(default=False)

    def anonymize(self):
        self.first_name = "Klient"
        self.last_name = f"#{self.id}"
        self.phone_number = None
        self.email = None
        self.is_anonymized = True
        self.save()

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone_number})"