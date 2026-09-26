from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0002_ticketassignmenthistory'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketService',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('price', models.DecimalField(decimal_places=2, max_digits=8)),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='used_services', to='service.ticket')),
            ],
        ),
    ]
