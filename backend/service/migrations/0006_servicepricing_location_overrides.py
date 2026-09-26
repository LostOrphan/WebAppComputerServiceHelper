import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
        ('service', '0005_ticket_created_by'),
    ]

    operations = [
        migrations.RenameField(
            model_name='servicepricing',
            old_name='price',
            new_name='default_price',
        ),
        migrations.AddField(
            model_name='servicepricing',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='servicepricing',
            name='default_price',
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.CreateModel(
            name='LocationServicePrice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('custom_price', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    max_digits=10,
                    null=True,
                    validators=[django.core.validators.MinValueValidator(0)],
                )),
                ('is_available', models.BooleanField(default=True)),
                ('location', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='service_prices',
                    to='accounts.location',
                )),
                ('service', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='location_prices',
                    to='service.servicepricing',
                )),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(
                        fields=('location', 'service'),
                        name='unique_location_service_price',
                    ),
                ],
            },
        ),
    ]
