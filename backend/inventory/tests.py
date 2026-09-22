from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import City, Location, Voivodeship
from .models import PartCategory, Part, Stock
from .serializers import PartSerializer


User = get_user_model()


class InventoryModelTests(APITestCase):
	def setUp(self):
		voivodeship = Voivodeship.objects.create(code='PM', name='Pomorskie')
		self.city = City.objects.create(name='Gdansk', voivodeship=voivodeship)
		self.location = Location.objects.create(
			name='Centrum', address='Dluga 1', postal_code='80-001', city=self.city
		)
		self.category = PartCategory.objects.create(name='Laptopy')
		self.part = Part.objects.create(
			name='Dysk SSD', sku='SSD-001', category=self.category,
			buy_price_net=Decimal('100.00'), sell_price_gross=Decimal('150.00'),
		)

	def test_stock_is_low_at_or_below_threshold(self):
		stock = Stock.objects.create(
			part=self.part, location=self.location, quantity=2, min_quantity=2
		)

		self.assertTrue(stock.is_low_stock)

	def test_zero_minimum_disables_low_stock(self):
		stock = Stock.objects.create(
			part=self.part, location=self.location, quantity=0, min_quantity=0
		)

		self.assertFalse(stock.is_low_stock)

	def test_part_serializer_rejects_negative_prices(self):
		serializer = PartSerializer(data={
			'name': 'Invalid',
			'sku': 'BAD-001',
			'category': self.category.pk,
			'buy_price_net': '-1.00',
			'sell_price_gross': '2.00',
			'unit': Part.Unit.PCS,
		})

		self.assertFalse(serializer.is_valid())
		self.assertIn('buy_price_net', serializer.errors)


class InventoryApiTests(APITestCase):
	def setUp(self):
		voivodeship = Voivodeship.objects.create(code='PM', name='Pomorskie')
		self.city = City.objects.create(name='Gdansk', voivodeship=voivodeship)
		self.location = Location.objects.create(
			name='Centrum', address='Dluga 1', postal_code='80-001', city=self.city
		)
		self.other_location = Location.objects.create(
			name='Wrzeszcz', address='Grunwaldzka 2', postal_code='80-002', city=self.city
		)
		self.inactive_location = Location.objects.create(
			name='Nieaktywna', address='Krotka 3', postal_code='80-003', city=self.city,
			is_active=False,
		)
		self.owner = User.objects.create_user(username='owner', role=User.Role.OWNER)
		self.worker = User.objects.create_user(
			username='worker', role=User.Role.TECHNICIAN, location=self.location
		)
		self.inactive_worker = User.objects.create_user(
			username='inactive-worker', role=User.Role.TECHNICIAN,
			location=self.inactive_location,
		)
		category = PartCategory.objects.create(name='Laptopy')
		part = Part.objects.create(
			name='Dysk SSD', sku='SSD-001', category=category,
			buy_price_net=Decimal('100.00'), sell_price_gross=Decimal('150.00'),
		)
		Stock.objects.create(part=part, location=self.location, quantity=1, min_quantity=2)
		Stock.objects.create(part=part, location=self.other_location, quantity=10, min_quantity=2)

	def test_worker_sees_only_stock_at_own_location(self):
		self.client.force_authenticate(self.worker)

		response = self.client.get('/api/inventory/stock/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['location']['id'], self.location.pk)

	def test_owner_sees_low_stock_items_from_all_locations(self):
		self.client.force_authenticate(self.owner)

		response = self.client.get('/api/inventory/stock/low-stock/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertTrue(response.data[0]['is_low_stock'])

	def test_worker_with_inactive_location_is_forbidden(self):
		self.client.force_authenticate(self.inactive_worker)

		response = self.client.get('/api/inventory/stock/')

		self.assertEqual(response.status_code, 403)
