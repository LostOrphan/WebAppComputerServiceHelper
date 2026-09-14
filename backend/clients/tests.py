from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location
from .models import Client
from .serializers import ClientSerializer


User = get_user_model()


class ClientModelTests(APITestCase):
	def test_anonymize_removes_contact_information(self):
		client = Client.objects.create(
			first_name='Jan',
			last_name='Kowalski',
			phone_number='+48500100200',
			email='jan@example.com',
		)

		client.anonymize()

		client.refresh_from_db()
		self.assertTrue(client.is_anonymized)
		self.assertIsNone(client.phone_number)
		self.assertIsNone(client.email)
		self.assertEqual(client.first_name, 'Klient')

	def test_active_ticket_count_excludes_closed_and_rejected(self):
		client = Client.objects.create(first_name='Jan', last_name='Kowalski')
		serializer = ClientSerializer(client)

		self.assertEqual(serializer.data['active_tickets_count'], 0)


class ClientApiTests(APITestCase):
	def setUp(self):
		city = City.objects.create(name='Gdansk')
		location = Location.objects.create(
			name='Centrum', address='Dluga 1', postal_code='80-001', city=city
		)
		self.user = User.objects.create_user(
			username='worker', password='password',
			role=User.Role.TECHNICIAN, location=location,
		)
		self.client_record = Client.objects.create(
			first_name='Jan', last_name='Kowalski', phone_number='+48500100200'
		)
		self.client.force_authenticate(self.user)

	def test_minimal_list_returns_only_minimal_fields(self):
		response = self.client.get('/api/clients/clients/?minimal=true')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			set(response.data[0]),
			{'id', 'first_name', 'last_name', 'phone_number'},
		)

	def test_anonymize_endpoint_updates_client(self):
		response = self.client.post(
			f'/api/clients/clients/{self.client_record.pk}/anonymize/'
		)

		self.assertEqual(response.status_code, 200)
		self.client_record.refresh_from_db()
		self.assertTrue(self.client_record.is_anonymized)
		self.assertEqual(self.client_record.first_name, 'Klient')
