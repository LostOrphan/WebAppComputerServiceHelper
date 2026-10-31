from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0008_ticket_status_before_waiting'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='ticketstatushistory',
            options={'ordering': ['-changed_at']},
        ),
    ]
