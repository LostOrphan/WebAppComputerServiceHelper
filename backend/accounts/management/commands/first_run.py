import getpass
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inventory.models import PartCategory


DEFAULT_PART_CATEGORIES = (
    'Dyski HDD',
    'Dyski SSD',
    'Karty graficzne',
    'Pamięci RAM',
    'Płyty główne',
    'Procesory',
    'Zasilacze',
)


class Command(BaseCommand):
    help = (
        'Tworzy pierwszego właściciela systemu i opcjonalnie importuje miasta '
        'z pliku SIMC.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv-file',
            type=Path,
            help='Opcjonalna ścieżka do pliku CSV SIMC. Bez niej ścieżka zostanie zapytana interaktywnie.',
        )

    def handle(self, *args, **options):
        user_model = get_user_model()
        if user_model.objects.filter(is_superuser=True).exists():
            raise CommandError(
                'Pierwszy superużytkownik już istnieje. Nie uruchamiaj '
                'first_run ponownie.'
            )

        username = self._required_input('Nazwa użytkownika: ')
        first_name = self._required_input('Imię: ')
        last_name = self._required_input('Nazwisko: ')
        password = self._password_pair()

        csv_file = options.get('csv_file')
        if csv_file is None:
            csv_file = self._optional_input(
                'Ścieżka do pliku SIMC (pozostaw puste, aby pominąć import): '
            )
            if csv_file:
                csv_file = Path(csv_file)

        with transaction.atomic():
            user_model.objects.create_superuser(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            for category_name in DEFAULT_PART_CATEGORIES:
                PartCategory.objects.get_or_create(name=category_name)
            if csv_file:
                call_command(
                    'import_simc',
                    str(csv_file),
                    verbosity=options['verbosity'],
                )

        self.stdout.write(self.style.SUCCESS(
            f'Utworzono właściciela "{username}".'
        ))
        if csv_file:
            self.stdout.write(self.style.SUCCESS(
                f'Zakończono konfigurację z importem SIMC z pliku {csv_file}.'
            ))
        else:
            self.stdout.write('Pominięto import miast SIMC.')

    def _required_input(self, prompt):
        value = input(prompt).strip()
        if not value:
            raise CommandError('To pole jest wymagane.')
        return value

    @staticmethod
    def _optional_input(prompt):
        return input(prompt).strip()

    @staticmethod
    def _password_pair():
        password = getpass.getpass('Hasło: ')
        confirmation = getpass.getpass('Powtórz hasło: ')
        if not password:
            raise CommandError('Hasło nie może być puste.')
        if password != confirmation:
            raise CommandError('Hasła nie są takie same.')
        return password
