from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location, Voivodeship
from clients.models import Client
from inventory.models import PartCategory, Part, Stock
from .models import Ticket, TicketAssignmentHistory, TicketPart, TicketStatusHistory
from .serializers import TicketWriteSerializer


User = get_user_model()


class ServiceTests(APITestCase):
	def setUp(self):
		voivodeship = Voivodeship.objects.create(code='PM', name='Pomorskie')
		city = City.objects.create(name='Gdansk', voivodeship=voivodeship)
		self.location = Location.objects.create(
			name='Centrum', address='Dluga 1', postal_code='80-001', city=city
		)
		self.inactive_location = Location.objects.create(
			name='Nieaktywna', address='Krotka 2', postal_code='80-002', city=city,
			is_active=False,
		)
		self.user = User.objects.create_user(
			username='technician', password='password',
			role=User.Role.TECHNICIAN, location=self.location,
		)
		self.inactive_user = User.objects.create_user(
			username='inactive-technician', password='password',
			role=User.Role.TECHNICIAN, location=self.inactive_location,
		)
		self.client_record = Client.objects.create(
			first_name='Jan', last_name='Kowalski', phone_number='+48500100200'
		)
		category = PartCategory.objects.create(name='Laptopy')
		self.part = Part.objects.create(
			name='Dysk SSD', sku='SSD-001', category=category,
			default_buy_price_net=Decimal('100.00'), sell_price_gross=Decimal('150.00'),
		)

	def create_ticket(self):
		return Ticket.objects.create(
			client=self.client_record,
			location=self.location,
			assigned_worker=self.user,
			device_name='Laptop',
			problem_description='Nie uruchamia sie',
		)

	def test_ticket_generates_code_and_initial_history(self):
		ticket = self.create_ticket()

		self.assertRegex(ticket.ticket_code, r'^TCK-[A-F0-9]{6}$')
		history = ticket.status_history.get()
		self.assertEqual(history.status, Ticket.Status.NEW)

	def test_ticket_create_endpoint_saves_audit_metadata(self):
		self.client.force_authenticate(self.user)

		response = self.client.post('/api/service/tickets/', {
			'client': self.client_record.pk,
			'location': self.location.pk,
			'device_name': 'Telefon',
			'problem_description': 'Uszkodzony ekran',
			'comment': 'Przyjęto nowe zgłoszenie',
		}, format='json')

		self.assertEqual(response.status_code, 201)
		self.assertRegex(response.data['ticket_code'], r'^TCK-[A-F0-9]{6}$')
		ticket = Ticket.objects.get(pk=response.data['id'])
		history = ticket.status_history.get()
		self.assertEqual(history.changed_by, self.user)
		self.assertEqual(history.comment, 'Przyjęto nowe zgłoszenie')

	def test_status_endpoint_creates_history_with_comment(self):
		ticket = self.create_ticket()
		self.client.force_authenticate(self.user)

		response = self.client.post(
			f'/api/service/tickets/{ticket.pk}/change-status/',
			{'status': Ticket.Status.DIAGNOSIS, 'comment': 'Rozpoczeto diagnoze'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		history = ticket.status_history.order_by('-changed_at').first()
		self.assertEqual(history.status, Ticket.Status.DIAGNOSIS)
		self.assertEqual(history.comment, 'Rozpoczeto diagnoze')

	def test_claim_assigns_worker_and_starts_diagnosis(self):
		ticket = Ticket.objects.create(
			client=self.client_record,
			location=self.location,
			device_name='Laptop',
			problem_description='Nie uruchamia sie',
		)
		self.client.force_authenticate(self.user)

		response = self.client.post(
			f'/api/service/tickets/{ticket.pk}/claim/',
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		ticket.refresh_from_db()
		self.assertEqual(ticket.assigned_worker, self.user)
		self.assertEqual(ticket.status, Ticket.Status.DIAGNOSIS)
		assignment = TicketAssignmentHistory.objects.get(ticket=ticket)
		self.assertEqual(assignment.worker, self.user)

	def test_generic_update_cannot_change_status_or_assignment(self):
		ticket = self.create_ticket()

		serializer = TicketWriteSerializer(
			ticket,
			data={'status': Ticket.Status.IN_PROGRESS},
			partial=True,
		)

		self.assertFalse(serializer.is_valid())
		self.assertIn('status', serializer.errors)

		serializer = TicketWriteSerializer(
			ticket,
			data={'assigned_worker': None},
			partial=True,
		)

		self.assertFalse(serializer.is_valid())
		self.assertIn('assigned_worker', serializer.errors)

	def test_invalid_status_transition_is_rejected(self):
		ticket = self.create_ticket()
		self.client.force_authenticate(self.user)

		response = self.client.post(
			f'/api/service/tickets/{ticket.pk}/change-status/',
			{'status': Ticket.Status.CLOSED},
			format='json',
		)

		self.assertEqual(response.status_code, 409)

	def test_inactive_location_user_cannot_change_ticket_status(self):
		ticket = self.create_ticket()
		ticket.location = self.inactive_location
		ticket.assigned_worker = self.inactive_user
		ticket.save(update_fields=['location', 'assigned_worker'])
		self.client.force_authenticate(self.inactive_user)

		response = self.client.post(
			f'/api/service/tickets/{ticket.pk}/change-status/',
			{'status': Ticket.Status.DIAGNOSIS},
			format='json',
		)

		self.assertEqual(response.status_code, 403)

	def test_public_status_requires_matching_phone_number(self):
		ticket = self.create_ticket()

		response = self.client.post('/api/service/public-status/', {
			'ticket_code': ticket.ticket_code,
			'phone_number': '+48500100200',
		}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['ticket_code'], ticket.ticket_code)
		self.assertEqual(len(response.data['history']), 1)

		wrong_phone = self.client.post('/api/service/public-status/', {
			'ticket_code': ticket.ticket_code,
			'phone_number': '+48500100201',
		}, format='json')
		self.assertEqual(wrong_phone.status_code, 404)

	def test_final_cost_cannot_be_lower_than_used_parts(self):
		ticket = self.create_ticket()
		TicketPart.objects.create(
			ticket=ticket, part=self.part, quantity=2, price_at_use=Decimal('150.00')
		)

		serializer = TicketWriteSerializer(
			ticket, data={'final_cost': '200.00'}, partial=True
		)

		self.assertFalse(serializer.is_valid())
		self.assertIn('final_cost', serializer.errors)

	def test_ticket_part_creation_deducts_stock_and_snapshots_price(self):
		ticket = self.create_ticket()
		stock = Stock.objects.create(
			part=self.part, location=self.location, quantity=5, min_quantity=1
		)
		self.client.force_authenticate(self.user)

		response = self.client.post('/api/service/ticket-parts/', {
			'ticket': ticket.pk,
			'part': self.part.pk,
			'quantity': 2,
		}, format='json')

		self.assertEqual(response.status_code, 201)
		stock.refresh_from_db()
		self.assertEqual(stock.quantity, 3)
		ticket_part = TicketPart.objects.get(ticket=ticket)
		self.assertEqual(ticket_part.price_at_use, self.part.sell_price_gross)

	def test_ticket_part_creation_rolls_back_when_stock_is_insufficient(self):
		ticket = self.create_ticket()
		Stock.objects.create(
			part=self.part, location=self.location, quantity=1, min_quantity=1
		)
		self.client.force_authenticate(self.user)

		response = self.client.post('/api/service/ticket-parts/', {
			'ticket': ticket.pk,
			'part': self.part.pk,
			'quantity': 2,
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertFalse(TicketPart.objects.filter(ticket=ticket).exists())
