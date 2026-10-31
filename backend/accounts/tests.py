from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import City, Location, LocationOpeningHours
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
		self.archived_worker = User.objects.create_user(
			username='ARCHIVED_old-worker',
			role=User.Role.TECHNICIAN,
			location=self.location,
			is_active=False,
		)

	def test_non_owner_sees_only_active_locations(self):
		self.client.force_authenticate(self.worker)

		response = self.client.get('/api/accounts/locations/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['name'] for item in response.data], ['Centrum'])

	def test_location_email_is_returned(self):
		self.location.email = 'centrum@example.com'
		self.location.save(update_fields=['email'])
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/accounts/locations/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['email'], 'centrum@example.com')

	def test_owner_sees_inactive_locations(self):
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/accounts/locations/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 2)
		self.assertEqual(response.data[0]['name'], 'Centrum')

	def test_public_locations_endpoint_requires_no_authentication(self):
		response = self.client.get('/api/accounts/locations/public/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['name'] for item in response.data], ['Centrum'])
		self.assertEqual(len(response.data[0]['opening_hours']), 5)
		self.assertTrue(all(item['is_closed'] for item in response.data[0]['opening_hours']))

	def test_owner_can_update_location_opening_hours(self):
		self.client.force_authenticate(self.owner)
		hours = self.location.opening_hours.get(weekday=LocationOpeningHours.Weekday.MONDAY)

		response = self.client.patch(
			f'/api/accounts/opening-hours/{hours.pk}/',
			{'opens_at': '08:00', 'closes_at': '16:00', 'is_closed': False},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		hours.refresh_from_db()
		self.assertEqual(hours.opens_at.strftime('%H:%M'), '08:00')
		self.assertFalse(hours.is_closed)

	def test_invalid_opening_hours_are_rejected(self):
		self.client.force_authenticate(self.owner)
		hours = self.location.opening_hours.get(weekday=LocationOpeningHours.Weekday.MONDAY)

		response = self.client.patch(
			f'/api/accounts/opening-hours/{hours.pk}/',
			{'opens_at': '16:00', 'closes_at': '08:00', 'is_closed': False},
			format='json',
		)

		self.assertEqual(response.status_code, 400)

	def test_users_list_contains_only_active_users(self):
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/accounts/users/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			{item['username'] for item in response.data},
			{'owner', 'worker'},
		)

	def test_archived_users_endpoint_contains_only_inactive_users(self):
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/accounts/users/archived/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[item['username'] for item in response.data],
			['ARCHIVED_old-worker'],
		)
