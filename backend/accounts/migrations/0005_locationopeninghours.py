from django.db import migrations, models
import django.db.models.deletion


def create_weekday_rows(apps, schema_editor):
    Location = apps.get_model('accounts', 'Location')
    LocationOpeningHours = apps.get_model('accounts', 'LocationOpeningHours')
    rows = []
    for location in Location.objects.all().iterator():
        rows.extend(
            LocationOpeningHours(location_id=location.id, weekday=weekday, is_closed=True)
            for weekday in range(5)
        )
    LocationOpeningHours.objects.bulk_create(rows)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0004_alter_customuser_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='LocationOpeningHours',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('weekday', models.PositiveSmallIntegerField(choices=[(0, 'Poniedziałek'), (1, 'Wtorek'), (2, 'Środa'), (3, 'Czwartek'), (4, 'Piątek')])),
                ('opens_at', models.TimeField(blank=True, null=True)),
                ('closes_at', models.TimeField(blank=True, null=True)),
                ('is_closed', models.BooleanField(default=False)),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='opening_hours', to='accounts.location')),
            ],
            options={
                'ordering': ['weekday'],
                'constraints': [
                    models.UniqueConstraint(fields=('location', 'weekday'), name='unique_location_opening_hours_day'),
                ],
            },
        ),
        migrations.RunPython(create_weekday_rows, migrations.RunPython.noop),
    ]
