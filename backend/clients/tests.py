from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location, Voivodeship
from .models import Client

User = get_user_model()


class ClientApiTests(APITestCase):
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
        self.manager = User.objects.create_user(
            'manager', password='pass', role=User.Role.MANAGER, location=self.location,
        )
        self.worker = User.objects.create_user(
            'worker', password='pass', role=User.Role.TECHNICIAN, location=self.location,
        )
        self.owner = User.objects.create_user('owner', password='pass', role=User.Role.OWNER)
        self.client_record = Client.objects.create(
            first_name='Jan', last_name='Kowalski', email='jan@example.com',
            phone_number='+48500100100', location=self.location,
        )
        self.other_client = Client.objects.create(
            first_name='Anna', last_name='Nowak', email='anna@example.com',
            phone_number='+48500100101', location=self.other_location,
        )

    def test_technician_can_list_and_create_client(self):
        self.client.force_authenticate(self.worker)
        response = self.client.post(
            '/api/clients/clients/',
            {'first_name': 'Piotr', 'last_name': 'Lis', 'phone_number': '+48500100102'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Client.objects.get(first_name='Piotr').location_id, self.location.id)

    def test_manager_sees_only_clients_from_own_location(self):
        self.client.force_authenticate(self.manager)
        response = self.client.get('/api/clients/clients/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_manager_can_update_but_technician_cannot(self):
        self.client.force_authenticate(self.worker)
        denied = self.client.patch(
            f'/api/clients/clients/{self.client_record.id}/',
            {'first_name': 'Changed'}, format='json',
        )
        self.assertEqual(denied.status_code, 403)
        self.client.force_authenticate(self.manager)
        allowed = self.client.patch(
            f'/api/clients/clients/{self.client_record.id}/',
            {'first_name': 'Changed'}, format='json',
        )
        self.assertEqual(allowed.status_code, 200)

    def test_delete_anonymizes_and_preserves_record(self):
        self.client.force_authenticate(self.manager)
        response = self.client.delete(f'/api/clients/clients/{self.client_record.id}/')
        self.assertEqual(response.status_code, 204)
        self.client_record.refresh_from_db()
        self.assertTrue(self.client_record.is_anonymized)
        self.assertIsNone(self.client_record.email)

    def test_search_supports_email(self):
        self.client.force_authenticate(self.manager)
        response = self.client.get('/api/clients/clients/?search=jan@example.com')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['email'], 'jan@example.com')
