import uuid
from django.db import models
from django.conf import settings
from django.db.models import Q

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

    ALLOWED_STATUS_TRANSITIONS = {
        Status.NEW: {Status.DIAGNOSIS, Status.REJECTED},
        Status.DIAGNOSIS: {Status.IN_PROGRESS, Status.WAITING_FOR_PARTS, Status.REJECTED},
        Status.WAITING_FOR_PARTS: {Status.IN_PROGRESS, Status.REJECTED},
        Status.IN_PROGRESS: {Status.READY, Status.WAITING_FOR_PARTS, Status.REJECTED},
        Status.READY: {Status.CLOSED},
        Status.CLOSED: set(),
        Status.REJECTED: set(),
    }

    def can_transition_to(self, new_status):
        return new_status == self.status or new_status in self.ALLOWED_STATUS_TRANSITIONS.get(self.status, set())

    def save(self, *args, user=None, comment="", **kwargs):
        is_new = self.pk is None
        status_changed = False
        assignment_changed = False

        if not self.ticket_code:
            self.ticket_code = f"TCK-{uuid.uuid4().hex[:6].upper()}"

        if not is_new:
            old_ticket = Ticket.objects.get(pk=self.pk)
            old_status = old_ticket.status
            if old_status != self.status:
                status_changed = True
            if old_ticket.assigned_worker_id != self.assigned_worker_id:
                assignment_changed = True
        else:
            status_changed = True 
            assignment_changed = self.assigned_worker_id is not None

        super().save(*args, **kwargs)

        if status_changed:
            TicketStatusHistory.objects.create(
                ticket=self,
                status=self.status,
                changed_by=user,
                comment=comment
            )

        if assignment_changed:
            TicketAssignmentHistory.objects.create(
                ticket=self,
                worker=self.assigned_worker,
            )

    def __str__(self):
        return f"{self.ticket_code} - {self.device_name} ({self.get_status_display()})"


class TicketStatusHistory(models.Model):
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
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='used_parts')
    part = models.ForeignKey('inventory.Part', on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    price_at_use = models.DecimalField(max_digits=8, decimal_places=2)

class TicketAssignmentHistory(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="assignment_history",
    )
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ticket_assignment_history",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
class ServicePricing(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.TextField(blank=True)
# class TicketWorkSession(models.Model):
#     ticket = models.ForeignKey(
#         Ticket,
#         on_delete=models.CASCADE,
#         related_name="work_sessions",
#     )
#     worker = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.PROTECT,
#         related_name="ticket_work_sessions",
#     )
#     started_at = models.DateTimeField(auto_now_add=True)
#     ended_at = models.DateTimeField(null=True, blank=True)
#     last_seen_at = models.DateTimeField(auto_now=True)
#     class Meta:
#         constraints = [
#             models.UniqueConstraint(
#                 fields=["ticket"],
#                 condition=Q(ended_at__isnull=True),
#                 name="one_active_work_session_per_ticket",
#             )
#         ]