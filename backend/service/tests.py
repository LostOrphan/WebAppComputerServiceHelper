from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location, Voivodeship
from clients.models import Client
from inventory.models import Part, PartCategory, Stock
from .models import Ticket, TicketPart, TicketService, TicketStatusHistory

User = get_user_model()


class ServiceApiTests(APITestCase):
    def setUp(self):
        voivodeship = Voivodeship.objects.create(code='PM', name='Pomorskie')
        city = City.objects.create(
            name='Gdansk', simc_code='2261011', locality_type='96',
            voivodeship=voivodeship, county_code='101',
            municipality_code='01', municipality_type='1',
        )
        self.location = Location.objects.create(
            name='Centrum', address='Dluga 1', postal_code='80-001', city=city,
        )
        self.other_location = Location.objects.create(
            name='Wrzeszcz', address='Grunwaldzka 2', postal_code='80-002', city=city,
        )
        self.owner = User.objects.create_user('owner', password='pass', role=User.Role.OWNER)
        self.manager = User.objects.create_user(
            'manager', password='pass', role=User.Role.MANAGER, location=self.location,
        )
        self.worker = User.objects.create_user(
            'worker', password='pass', role=User.Role.TECHNICIAN, location=self.location,
        )
        self.other_worker = User.objects.create_user(
            'other-worker', password='pass', role=User.Role.TECHNICIAN, location=self.location,
        )
        self.client_record = Client.objects.create(
            first_name='Jan', last_name='Kowalski', email='jan@example.com',
            phone_number='+48500100100', location=self.location,
        )
        self.category = PartCategory.objects.create(name='Dyski')
        self.part = Part.objects.create(
            name='SSD', sku='SSD-001', category=self.category,
            default_buy_price_net=Decimal('100'), sell_price_gross=Decimal('150'),
        )
        self.stock = Stock.objects.create(part=self.part, location=self.location, quantity=5)

    def ticket(self, status=Ticket.Status.NEW, assigned_worker=None):
        return Ticket.objects.create(
            client=self.client_record, location=self.location,
            assigned_worker=assigned_worker, created_by=self.worker,
            device_name='Laptop', serial_number='SN-1',
            device_passcode='secret', problem_description='Nie uruchamia się',
            status=status,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user or self.worker)

    def test_create_ticket_records_history_and_hides_passcode(self):
        self.authenticate()
        response = self.client.post(
            '/api/service/tickets/',
            {
                'client': self.client_record.id, 'location': self.location.id,
                'device_name': 'Laptop', 'device_passcode': 'secret',
                'problem_description': 'Awaria',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('device_passcode', response.data)
        self.assertEqual(TicketStatusHistory.objects.count(), 1)

    def test_ticket_list_is_scoped_and_paginated(self):
        self.ticket()
        self.authenticate()
        response = self.client.get('/api/service/tickets/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_claim_moves_new_ticket_to_diagnosis(self):
        ticket = self.ticket()
        self.authenticate()
        response = self.client.post(f'/api/service/tickets/{ticket.id}/claim/')
        self.assertEqual(response.status_code, 200)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, Ticket.Status.DIAGNOSIS)
        self.assertEqual(ticket.assigned_worker_id, self.worker.id)

    def test_unassigned_worker_cannot_reveal_passcode(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.other_worker)
        self.authenticate()
        response = self.client.get(f'/api/service/tickets/{ticket.id}/device-passcode/')
        self.assertEqual(response.status_code, 403)

    def test_assigned_worker_can_reveal_passcode_separately(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.worker)
        self.authenticate()
        detail = self.client.get(f'/api/service/tickets/{ticket.id}/')
        reveal = self.client.get(f'/api/service/tickets/{ticket.id}/device-passcode/')
        self.assertNotIn('device_passcode', detail.data)
        self.assertEqual(reveal.data['device_passcode'], 'secret')

    def test_wait_and_return_to_diagnosis(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.worker)
        self.authenticate()
        wait = self.client.post(f'/api/service/tickets/{ticket.id}/wait-for-parts/')
        self.assertEqual(wait.status_code, 200)
        self.assertEqual(wait.data['status'], Ticket.Status.WAITING_FOR_PARTS)
        back = self.client.post(f'/api/service/tickets/{ticket.id}/return-to-diagnosis/')
        self.assertEqual(back.status_code, 200)
        self.assertEqual(back.data['status'], Ticket.Status.DIAGNOSIS)

    def test_start_repair_reserves_stock(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.worker)
        TicketPart.objects.create(
            ticket=ticket, part=self.part, quantity=2, price_at_use=Decimal('150'),
        )
        self.authenticate()
        response = self.client.post(
            f'/api/service/tickets/{ticket.id}/change-status/',
            {'status': Ticket.Status.IN_PROGRESS},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 3)
        self.assertTrue(ticket.used_parts.get().stock_reserved)

    def test_start_repair_rejects_insufficient_stock(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.worker)
        TicketPart.objects.create(
            ticket=ticket, part=self.part, quantity=10, price_at_use=Decimal('150'),
        )
        self.authenticate()
        response = self.client.post(
            f'/api/service/tickets/{ticket.id}/change-status/',
            {'status': Ticket.Status.IN_PROGRESS},
            format='json',
        )
        self.assertEqual(response.status_code, 409)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, Ticket.Status.DIAGNOSIS)

    @patch('service.views.send_mail')
    def test_ready_status_sends_notification(self, send_mail):
        ticket = self.ticket(status=Ticket.Status.IN_PROGRESS, assigned_worker=self.worker)
        self.authenticate()
        response = self.client.post(
            f'/api/service/tickets/{ticket.id}/change-status/',
            {'status': Ticket.Status.READY},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        send_mail.assert_called_once()
        self.assertIn(self.location.name, send_mail.call_args.kwargs['message'])

    @patch('service.views.send_mail', side_effect=OSError('mail down'))
    def test_email_failure_does_not_block_ready_status(self, send_mail):
        ticket = self.ticket(status=Ticket.Status.IN_PROGRESS, assigned_worker=self.worker)
        self.authenticate()
        response = self.client.post(
            f'/api/service/tickets/{ticket.id}/change-status/',
            {'status': Ticket.Status.READY},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, Ticket.Status.READY)

    def test_resend_email_requires_ready_status(self):
        ticket = self.ticket(status=Ticket.Status.IN_PROGRESS, assigned_worker=self.worker)
        self.authenticate()
        response = self.client.post(f'/api/service/tickets/{ticket.id}/send-ready-email/')
        self.assertEqual(response.status_code, 409)

    @patch('service.views.send_mail')
    def test_public_email_tracking_flow(self, send_mail):
        self.ticket()
        request = self.client.post(
            '/api/service/public-track/request-code/',
            {'email': self.client_record.email},
            format='json',
        )
        self.assertEqual(request.status_code, 202)
        message = send_mail.call_args.kwargs['message']
        code = message.split(': ')[1].split('.')[0]
        verify = self.client.post(
            '/api/service/public-track/verify-code/',
            {'email': self.client_record.email, 'code': code},
            format='json',
        )
        self.assertEqual(verify.status_code, 200)
        tickets = self.client.post(
            '/api/service/public-track/tickets/',
            {'tracking_token': verify.data['tracking_token']},
            format='json',
        )
        self.assertEqual(tickets.status_code, 200)

    def test_negative_service_price_is_rejected(self):
        self.authenticate(self.owner)
        response = self.client.post(
            '/api/service/services/',
            {'name': 'Diagnoza', 'default_price': '-1'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_ticket_part_requires_positive_quantity(self):
        ticket = self.ticket(status=Ticket.Status.DIAGNOSIS, assigned_worker=self.worker)
        self.authenticate()
        response = self.client.post(
            '/api/service/ticket-parts/',
            {'ticket': ticket.id, 'part': self.part.id, 'quantity': 0},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
