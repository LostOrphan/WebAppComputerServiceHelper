import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import City, Voivodeship


VOIVODESHIP_NAMES = {
    '02': 'Dolnośląskie',
    '04': 'Kujawsko-Pomorskie',
    '06': 'Lubelskie',
    '08': 'Lubuskie',
    '10': 'Łódzkie',
    '12': 'Małopolskie',
    '14': 'Mazowieckie',
    '16': 'Opolskie',
    '18': 'Podkarpackie',
    '20': 'Podlaskie',
    '22': 'Pomorskie',
    '24': 'Śląskie',
    '26': 'Świętokrzyskie',
    '28': 'Warmińsko-Mazurskie',
    '30': 'Wielkopolskie',
    '32': 'Zachodniopomorskie',
}

REQUIRED_COLUMNS = {
    'woj',
    'pow',
    'gmi',
    'rodz_gmi',
    'rm',
    'mz',
    'nazwa',
    'sym',
    'sympod',
    'stan_na',
}


class Command(BaseCommand):
    help = 'Importuje dane z pliku CSV SIMC do bazy danych.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=Path)
        parser.add_argument(
            '--encoding',
            default='utf-8-sig',
            help='Kodowanie CSV. Użyj cp1250 dla starszych eksportów.',
        )
        parser.add_argument(
            '--delimiter',
            default=None,
            help='Separator CSV. Wykrywany automatycznie jeśli pominięty.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Waliduje i zlicza wiersze bez zmiany bazy danych.',
        )

    def handle(self, *args, **options):
        csv_path = options['csv_file']
        if not csv_path.is_file():
            raise CommandError(f'Plik nie istnieje: {csv_path}')

        try:
            with csv_path.open('r', encoding=options['encoding'], newline='') as file:
                sample = file.read(8192)
                file.seek(0)
                delimiter = options['delimiter'] or self.detect_delimiter(sample)
                reader = csv.DictReader(file, delimiter=delimiter)
                headers = {
                    (header or '').strip().lower()
                    for header in (reader.fieldnames or [])
                }
                missing = REQUIRED_COLUMNS - headers
                if missing:
                    missing_columns = ', '.join(sorted(missing))
                    raise CommandError(f'Brak wymaganych kolumn: {missing_columns}')
                rows = [
                    (row_number, self.normalized_row(row))
                    for row_number, row in enumerate(reader, start=2)
                ]
        except UnicodeDecodeError as error:
            raise CommandError(
                f'Nie można zdekodować {csv_path}. Spróbuj --encoding cp1250.'
            ) from error

        selected_rows = [
            (row_number, row)
            for row_number, row in rows
            if self.should_import(row)
        ]
        skipped = len(rows) - len(selected_rows)

        if options['dry_run']:
            for row_number, row in selected_rows:
                self.validate_row(row, row_number)
            self.stdout.write(self.style.SUCCESS(
                f'Potwierdzono {len(selected_rows)} wierszy SIMC; pominięto {skipped}. '
                'Nie wprowadzono zmian w bazie danych.'
            ))
            return

        imported = 0
        with transaction.atomic():
            for row_number, values in selected_rows:
                self.validate_row(values, row_number)
                voivodeship, _ = Voivodeship.objects.get_or_create(
                    code=values['woj'],
                    defaults={'name': VOIVODESHIP_NAMES.get(
                        values['woj'], f"Województwo {values['woj']}"
                    )},
                )
                City.objects.update_or_create(
                    simc_code=values['sym'],
                    defaults={
                        'name': values['nazwa'],
                        'simc_parent_code': values['sympod'],
                        'locality_type': values['rm'],
                        'voivodeship': voivodeship,
                        'county_code': values['pow'],
                        'municipality_code': values['gmi'],
                        'municipality_type': values['rodz_gmi'],
                    },
                )
                imported += 1

        self.stdout.write(self.style.SUCCESS(
            f'Zimportowano {imported} wierszy SIMC z {csv_path.name}; pominięto {skipped}.'
        ))

    @staticmethod
    def detect_delimiter(sample):
        try:
            return csv.Sniffer().sniff(sample, delimiters=',;\t').delimiter
        except csv.Error:
            return ';'

    @staticmethod
    def normalized_row(row):
        return {
            (key or '').strip().lower(): (value or '').strip()
            for key, value in row.items()
        }

    @staticmethod
    def should_import(row):
        return (row.get('rm')=='96' and row.get('sym')==row.get('sympod'))
    
    @staticmethod
    def validate_row(row, row_number):
        for field in ('woj', 'pow', 'gmi', 'rodz_gmi', 'rm', 'nazwa', 'sym'):
            if not row.get(field):
                raise CommandError(f'Wiersz {row_number}: kolumna {field} jest pusta.')
        if row['woj'] not in VOIVODESHIP_NAMES:
            raise CommandError(
                f"Wiersz {row_number}: nieznany kod województwa '{row['woj']}'."
            )
