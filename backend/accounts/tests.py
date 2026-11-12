from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from rest_framework.test import APITestCase

from inventory.models import PartCategory

from .models import City, Location, LocationOpeningHours, Voivodeship

User = get_user_model()


def create_city(name='Gdansk', code='2261011'):
    voivodeship = Voivodeship.objects.create(code=f'P{code[-1]}', name='Pomorskie')
    return City.objects.create(
        name=name, simc_code=code, locality_type='96',
        voivodeship=voivodeship, county_code='101',
        municipality_code='01', municipality_type='1',
    )


class AccountModelTests(TestCase):
    @patch('accounts.management.commands.first_run.getpass.getpass', side_effect=['Strong-password-123', 'Strong-password-123'])
    @patch('builtins.input', side_effect=['first-owner', 'Jan', 'Kowalski', ''])
    def test_first_run_creates_owner_without_city_import(self, mocked_input, mocked_getpass):
        call_command('first_run', stdout=StringIO())

        user = User.objects.get(username='first-owner')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertEqual(user.role, User.Role.OWNER)
        self.assertEqual(user.first_name, 'Jan')
        self.assertEqual(user.last_name, 'Kowalski')
        self.assertSetEqual(
            set(PartCategory.objects.values_list('name', flat=True)),
            {
                'Dyski HDD',
                'Dyski SSD',
                'Karty graficzne',
                'Pamięci RAM',
                'Płyty główne',
                'Procesory',
                'Zasilacze',
            },
        )

    @patch('accounts.management.commands.first_run.getpass.getpass', side_effect=['first-password', 'different-password'])
    @patch('builtins.input', side_effect=['first-owner', 'Jan', 'Kowalski'])
    def test_first_run_rejects_mismatched_passwords(self, mocked_input, mocked_getpass):
        with self.assertRaises(CommandError):
            call_command('first_run', stdout=StringIO())

        self.assertFalse(User.objects.filter(username='first-owner').exists())

    def test_location_creates_five_closed_opening_hours(self):
        location = Location.objects.create(
            name='Centrum', address='Dluga 1', postal_code='80-001',
            city=create_city(),
        )
        hours = location.opening_hours.all()
        self.assertEqual(hours.count(), 5)
        self.assertTrue(all(item.is_closed for item in hours))

    def test_opening_hours_clean_rejects_invalid_interval(self):
        location = Location.objects.create(
            name='Centrum', address='Dluga 1', postal_code='80-001',
            city=create_city(),
        )
        hours = location.opening_hours.get(weekday=0)
        hours.is_closed = False
        hours.opens_at = '16:00'
        hours.closes_at = '08:00'
        with self.assertRaises(ValidationError):
            hours.full_clean()

    def test_superuser_is_owner_without_location(self):
        user = User.objects.create_superuser('admin', password='Strong-password-123')
        self.assertEqual(user.role, User.Role.OWNER)
        self.assertIsNone(user.location_id)


class AccountApiTests(APITestCase):
    def setUp(self):
        self.city = create_city()
        self.location = Location.objects.create(
            name='Centrum', address='Dluga 1', postal_code='80-001', city=self.city,
        )
        self.inactive = Location.objects.create(
            name='Zamkniety', address='Krotka 2', postal_code='80-002',
            city=self.city, is_active=False,
        )
        self.owner = User.objects.create_user('owner', password='pass', role=User.Role.OWNER)
        self.manager = User.objects.create_user(
            'manager', password='pass', role=User.Role.MANAGER, location=self.location,
        )
        self.worker = User.objects.create_user(
            'worker', password='pass', role=User.Role.TECHNICIAN, location=self.location,
        )

    def test_anonymous_cannot_list_private_locations(self):
        response = self.client.get('/api/accounts/locations/')
        self.assertEqual(response.status_code, 401)

    def test_public_locations_return_only_active_paginated_results(self):
        response = self.client.get('/api/accounts/locations/public/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['name'] for item in response.data['results']], ['Centrum'])
        self.assertEqual(len(response.data['results'][0]['opening_hours']), 5)

    def test_manager_sees_only_own_location(self):
        self.client.force_authenticate(self.manager)
        response = self.client.get('/api/accounts/locations/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data['results']], [self.location.id])

    def test_owner_sees_inactive_locations(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/accounts/locations/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)

    def test_inactive_location_user_is_denied(self):
        user = User.objects.create_user(
            'inactive-worker', password='pass', role=User.Role.TECHNICIAN, location=self.inactive,
        )
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get('/api/inventory/stock/').status_code, 403)

    def test_invalid_opening_hours_are_rejected(self):
        self.client.force_authenticate(self.manager)
        hours = self.location.opening_hours.get(weekday=0)
        response = self.client.patch(
            f'/api/accounts/opening-hours/{hours.id}/',
            {'is_closed': False, 'opens_at': '16:00', 'closes_at': '08:00'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_manager_cannot_create_owner(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            '/api/accounts/users/',
            {'username': 'new-owner', 'password': 'pass', 'role': User.Role.OWNER},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
