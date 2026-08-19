import uuid
from django.db import models
from django.conf import settings


class Ticket(models.Model):
    class Status(models.TextChoices):
        NEW = 'NEW', 'Nowe (Przyjęte)'
        DIAGNOSIS = 'DIAGNOSIS', 'W trakcie diagnozy'
        WAITING_FOR_PARTS = 'PARTS', 'Oczekiwanie na części'
        IN_PROGRESS = 'IN_PROGRESS', 'W trakcie naprawy'
        READY = 'READY', 'Gotowe do odbioru'
        CLOSED = 'CLOSED', 'Zakończone / Odebrane'
        REJECTED = 'REJECTED', 'Odrzucone / Rezygnacja'

    client = models.ForeignKey('clients.Client', on_delete=models.PROTECT, related_name='tickets')
    location = models.ForeignKey('accounts.Location', on_delete=models.PROTECT, related_name='tickets')
    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='assigned_tickets'
    )

    ticket_code = models.CharField(max_length=10, unique=True, editable=False)
    device_name = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=50, blank=True)
    device_passcode = models.CharField(max_length=50, blank=True)
    problem_description = models.TextField()
    diagnosis_note = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    estimated_cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    final_cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, user=None, comment="", **kwargs):
        is_new = self.pk is None
        status_changed = False

        # Generowanie unikalnego kodu zgłoszenia
        if not self.ticket_code:
            self.ticket_code = f"TCK-{uuid.uuid4().hex[:6].upper()}"  # Dopisano wywołanie () przy .upper()

        # Wykrycie zmiany statusu dla istniejącego obiektu
        if not is_new:
            old_status = Ticket.objects.get(pk=self.pk).status
            if old_status != self.status:
                status_changed = True
        else:
            status_changed = True  # Zapisujemy pierwszy status po utworzeniu zgłoszenia

        # Fizyczny zapis obiektu Ticket w bazie
        super().save(*args, **kwargs)

        # Tworzenie wpisu w historii jeśli status uległ zmianie lub zgłoszenie jest nowe
        if status_changed:
            TicketStatusHistory.objects.create(
                ticket=self,
                status=self.status,
                changed_by=user,
                comment=comment
            )

    def __str__(self):
        return f"{self.ticket_code} - {self.device_name} ({self.get_status_display()})"


class TicketStatusHistory(models.Model):
    """Śledzenie historii zmian statusu wraz ze znacznikiem czasu i operatorem."""
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=20, choices=Ticket.Status.choices)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ['changed_at'] 

    def __str__(self):
        return f"{self.ticket.ticket_code} -> {self.get_status_display()} ({self.changed_at.strftime('%Y-%m-%d %H:%M')})"


class TicketPart(models.Model):
    """Części wykorzystywane w danej naprawie."""
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='used_parts')
    part = models.ForeignKey('inventory.Part', on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    price_at_use = models.DecimalField(max_digits=8, decimal_places=2)