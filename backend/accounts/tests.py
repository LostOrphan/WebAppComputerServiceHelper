from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import City, Location
from .serializers import UserWriteSerializer


User = get_user_model()


class AccountModelTests(APITestCase):
	def test_city_is_ordered_by_name(self):
		City.objects.create(name='Warszawa')
		City.objects.create(name='Gdansk')

		self.assertEqual(list(City.objects.values_list('name', flat=True)), ['Gdansk', 'Warszawa'])

	def test_user_write_serializer_hashes_password(self):
		serializer = UserWriteSerializer(data={
			'username': 'technician',
			'password': 'Strong-password-123',
			'first_name': 'Jan',
			'last_name': 'Kowalski',
			'role': User.Role.TECHNICIAN,
		})

		self.assertTrue(serializer.is_valid(), serializer.errors)
		user = serializer.save()

		self.assertTrue(user.check_password('Strong-password-123'))


class AccountApiTests(APITestCase):
	def setUp(self):
		self.city = City.objects.create(name='Gdansk')
		self.location = Location.objects.create(
			name='Centrum',
			address='Dluga 1',
			postal_code='80-001',
			city=self.city,
		)
		self.inactive_location = Location.objects.create(
			name='Nieaktywna',
			address='Krotka 2',
			postal_code='80-002',
			city=self.city,
			is_active=False,
		)
		self.owner = User.objects.create_user(
			username='owner', role=User.Role.OWNER, location=self.location
		)
		self.worker = User.objects.create_user(
			username='worker', role=User.Role.TECHNICIAN, location=self.location
		)

	def test_non_owner_sees_only_active_locations(self):
		self.client.force_authenticate(self.worker)

		response = self.client.get('/api/accounts/locations/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['name'] for item in response.data], ['Centrum'])

	def test_owner_sees_inactive_locations(self):
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/accounts/locations/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 2)
