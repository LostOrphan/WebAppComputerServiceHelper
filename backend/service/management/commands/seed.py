import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from faker import Faker

# Importy z Twoich aplikacji
from accounts.models import City, Location
from clients.models import Client
from inventory.models import PartCategory, Part, Stock
from service.models import Ticket, TicketPart

User = get_user_model()

class Command(BaseCommand):
    help = 'Generuje realistyczne dane testowe dla całego systemu serwisu IT.'

    def handle(self, *args, **kwargs):
        fake = Faker('pl_PL')
        self.stdout.write('Rozpoczynam generowanie danych...')

        # Opcjonalnie: Czyszczenie bazy (odkomentuj, jeśli chcesz resetować bazę przy każdym użyciu)
        # Ticket.objects.all().delete()
        # Part.objects.all().delete()
        # PartCategory.objects.all().delete()
        # Client.objects.all().delete()
        # Location.objects.all().delete()
        # City.objects.all().delete()

        # --- 1. Miasta i Lokalizacje ---
        self.stdout.write('1. Generowanie Miast i Lokalizacji...')
        cities_names = ['Warszawa', 'Kraków', 'Wrocław', 'Poznań']
        cities = [City.objects.get_or_create(name=name)[0] for name in cities_names]

        locations = []
        for i, city in enumerate(cities):
            loc, _ = Location.objects.get_or_create(
                name=f"Oddział {city.name} #{i+1}",
                address=fake.street_address(),
                postal_code=fake.postcode(),
                city=city,
                phone_number=f"+48{fake.msisdn()[2:11]}"  # Poprawny format dla PhoneNumberField
            )
            locations.append(loc)

        # --- 2. Użytkownicy (Pracownicy) ---
        self.stdout.write('2. Generowanie Pracowników...')
        technicians = []
        for loc in locations:
            # Tworzymy 2 serwisantów na każdy oddział
            for _ in range(2):
                tech = User.objects.create_user(
                    username=fake.user_name(),
                    password='password123',
                    first_name=fake.first_name(),
                    last_name=fake.last_name(),
                    role='TECHNICIAN',
                    location=loc
                )
                technicians.append(tech)

        # --- 3. Klienci ---
        self.stdout.write('3. Generowanie Klientów...')
        clients = []
        for _ in range(30):
            client = Client.objects.create(
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                phone_number=f"+48{fake.msisdn()[2:11]}",
                email=fake.email()
            )
            clients.append(client)

        # --- 4. Magazyn (Kategorie, Części, Stany) ---
        self.stdout.write('4. Generowanie Magazynu...')
        categories_data = ['Dyski SSD', 'Pamięć RAM', 'Zasilacze', 'Matryce', 'Pasty termoprzewodzące']
        parts = []
        
        for cat_name in categories_data:
            cat, _ = PartCategory.objects.get_or_create(name=cat_name)
            # 3 części na kategorię
            for _ in range(3):
                buy_price = Decimal(random.uniform(20.0, 400.0)).quantize(Decimal('0.01'))
                sell_price = buy_price * Decimal('1.3') # 30% marży
                
                part = Part.objects.create(
                    name=f"{cat.name} {fake.word().capitalize()} {random.randint(100, 999)}",
                    sku=fake.ean8(),
                    category=cat,
                    buy_price_net=buy_price,
                    sell_price_gross=sell_price.quantize(Decimal('0.01')),
                    unit='PCS'
                )
                parts.append(part)

        # Przypisanie części do każdego oddziału (Stock)
        for loc in locations:
            for part in parts:
                Stock.objects.get_or_create(
                    part=part,
                    location=loc,
                    defaults={
                        'quantity': random.randint(0, 50),
                        'min_quantity': random.randint(2, 5)
                    }
                )

        # --- 5. Zgłoszenia Serwisowe ---
        self.stdout.write('5. Generowanie Zgłoszeń...')
        devices = ['Laptop Dell', 'PC Custom', 'MacBook Air', 'Lenovo ThinkPad', 'Konsola PS5']
        
        for _ in range(40):
            loc = random.choice(locations)
            # Wybieramy serwisanta z tego samego oddziału
            local_techs = [t for t in technicians if t.location == loc]
            tech = random.choice(local_techs) if local_techs else None
            
            status = random.choice([s[0] for s in Ticket.Status.choices])
            
            ticket = Ticket(
                client=random.choice(clients),
                location=loc,
                assigned_worker=tech,
                device_name=random.choice(devices),
                serial_number=fake.ean13(),
                problem_description=fake.paragraph(nb_sentences=3),
                status=status,
            )
            ticket.save(
                user=tech,
                comment="Automatyczne wygenerowanie statusu",
            )

            # Jeśli zgłoszenie jest naprawiane/gotowe, dodajemy zużyte części
            if status in ['IN_PROGRESS', 'READY', 'CLOSED']:
                used_parts = random.sample(parts, random.randint(1, 3))
                for p in used_parts:
                    TicketPart.objects.create(
                        ticket=ticket,
                        part=p,
                        quantity=random.randint(1, 2),
                        price_at_use=p.sell_price_gross
                    )

        self.stdout.write(self.style.SUCCESS('Pomyślnie wygenerowano pełne środowisko testowe!'))