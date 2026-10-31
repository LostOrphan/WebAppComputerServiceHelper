from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0007_align_servicepricing_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='status_before_waiting_for_parts',
            field=models.CharField(
                blank=True,
                choices=[
                    ('NEW', 'Nowe (Przyjęte)'),
                    ('DIAGNOSIS', 'W trakcie diagnozy'),
                    ('PARTS', 'Oczekiwanie na części'),
                    ('IN_PROGRESS', 'W trakcie naprawy'),
                    ('READY', 'Gotowe do odbioru'),
                    ('CLOSED', 'Zakończone / Odebrane'),
                    ('REJECTED', 'Odrzucone / Rezygnacja'),
                ],
                max_length=20,
                null=True,
            ),
        ),
    ]
