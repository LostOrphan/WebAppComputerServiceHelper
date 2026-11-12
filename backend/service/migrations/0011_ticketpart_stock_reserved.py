from django.db import migrations, models


def mark_existing_parts_reserved(apps, schema_editor):
    TicketPart = apps.get_model('service', 'TicketPart')
    TicketPart.objects.all().update(stock_reserved=True)


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0010_publicemailverification'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticketpart',
            name='stock_reserved',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_parts_reserved, migrations.RunPython.noop),
    ]
