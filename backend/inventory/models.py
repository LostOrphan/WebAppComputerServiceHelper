from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=50,unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

class Part(models.Model):
    class Unit(models.TextChoices):
        PCS = 'PCS', 'szt.'
        GRAMS = 'G', 'g'
        ML = 'ML', 'ml'
    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=50, unique=True) #kod kreskowy lub ID produktu
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='parts')
    buy_price_net = models.DecimalField(max_digits=8,decimal_places=2)
    sell_price_gross = models.DecimalField(max_digits=8,decimal_places=2)
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PCS)

    def __str__(self):
        return f"[{self.sku}] {self.name}"

class Stock(models.Model):
    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='stocks')
    location = models.ForeignKey('accounts.Location',on_delete=models.CASCADE, related_name='stocks')
    quantity = models.PositiveIntegerField(default=0)
    min_quantity = models.PositiveIntegerField(default=2) # próg ostrzegawczy o niskim stanie

    class Meta:
        unique_together = ('part','location')

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_quantity