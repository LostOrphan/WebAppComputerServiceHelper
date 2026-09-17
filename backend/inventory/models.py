from django.db import models, transaction


class PartCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Part(models.Model):
    class Unit(models.TextChoices):
        PCS = 'PCS', 'szt.'
        GRAMS = 'G', 'g'
        ML = 'ML', 'ml'

    name = models.CharField(max_length=150)
    brand = models.CharField(max_length=50, blank=True)
    
    # Identyfikatory
    sku = models.CharField(max_length=50, unique=True, blank=True, db_index=True)
    ean = models.CharField(max_length=13, blank=True, null=True, db_index=True)
    
    category = models.ForeignKey(PartCategory, on_delete=models.PROTECT, related_name='parts')
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PCS)
    
    # Ceny
    default_buy_price_net = models.DecimalField(
        max_digits=8, decimal_places=2, help_text="Ostatnia/domyślna cena zakupu netto"
    )
    sell_price_gross = models.DecimalField(max_digits=8, decimal_places=2)
    
    # Elastyczna specyfikacja (np. {"pojemnosc": "512GB", "interfejs": "NVMe"})
    specifications = models.JSONField(
        default=dict, blank=True, help_text="Parametry techniczne w formacie Key-Value"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Automatyczne generowanie unikalnego SKU (np. PRT-000001), jeśli brak
        if not self.sku:
            with transaction.atomic():
                last_id = Part.objects.select_for_update().aggregate(
                    models.Max('id')
                )['id__max'] or 0
                self.sku = f"PRT-{(last_id + 1):06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        brand_prefix = f"{self.brand} " if self.brand else ""
        return f"[{self.sku}] {brand_prefix}{self.name}"


class Stock(models.Model):
    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='stocks')
    location = models.ForeignKey('accounts.Location', on_delete=models.CASCADE, related_name='stocks')
    quantity = models.PositiveIntegerField(default=0)
    min_quantity = models.PositiveIntegerField(default=2)

    class Meta:
        unique_together = ('part', 'location')

    @property
    def is_low_stock(self) -> bool:
        return self.min_quantity > 0 and self.quantity <= self.min_quantity

    def add_quantity(self, amount: int):
        """Pomocnicza metoda do bezpiecznego zwiększania stanu"""
        self.quantity += amount
        self.save()

    def __str__(self):
        return f"{self.part.name} - {self.location.name}: {self.quantity} {self.part.get_unit_display()}"