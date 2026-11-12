from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location, Voivodeship
from .models import Part, PartCategory, Stock

User = get_user_model()


class InventoryApiTests(APITestCase):
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
        self.category = PartCategory.objects.create(name='Dyski')
        self.part = Part.objects.create(
            name='SSD', sku='SSD-001', category=self.category,
            default_buy_price_net=Decimal('100.00'), sell_price_gross=Decimal('150.00'),
        )
        self.stock = Stock.objects.create(
            part=self.part, location=self.location, quantity=2, min_quantity=2,
        )
        Stock.objects.create(part=self.part, location=self.other_location, quantity=10)

    def test_worker_sees_only_own_stock_and_pagination_shape(self):
        self.client.force_authenticate(self.worker)
        response = self.client.get('/api/inventory/stock/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['location']['id'], self.location.id)

    def test_owner_can_delete_part_but_worker_cannot(self):
        self.client.force_authenticate(self.worker)
        self.assertEqual(self.client.delete(f'/api/inventory/parts/{self.part.id}/').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(f'/api/inventory/parts/{self.part.id}/').status_code, 204)

    def test_active_worker_can_create_part_and_stock_row(self):
        self.client.force_authenticate(self.worker)
        response = self.client.post(
            '/api/inventory/parts/',
            {
                'name': 'RAM', 'category': self.category.id,
                'default_buy_price_net': '50.00', 'sell_price_gross': '80.00',
                'unit': 'PCS',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Stock.objects.filter(part_id=response.data['id'], location=self.location).exists())

    def test_negative_prices_are_rejected(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            '/api/inventory/parts/',
            {
                'name': 'Invalid', 'category': self.category.id,
                'default_buy_price_net': '-1', 'sell_price_gross': '2', 'unit': 'PCS',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_receive_goods_rejects_invalid_quantity(self):
        self.client.force_authenticate(self.worker)
        response = self.client.post(
            '/api/inventory/stock/receive-goods/',
            {'identifier': self.part.sku, 'quantity': 'invalid'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_receive_goods_increases_stock(self):
        self.client.force_authenticate(self.worker)
        response = self.client.post(
            '/api/inventory/stock/receive-goods/',
            {'identifier': self.part.sku, 'quantity': 3},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 5)

    def test_low_stock_endpoint_returns_threshold_matches(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/inventory/stock/low-stock/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertTrue(response.data['results'][0]['is_low_stock'])
