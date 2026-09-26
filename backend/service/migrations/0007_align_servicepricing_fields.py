from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0006_servicepricing_location_overrides'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='servicepricing',
            options={'ordering': ['name']},
        ),
        migrations.AlterField(
            model_name='servicepricing',
            name='description',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='servicepricing',
            name='name',
            field=models.CharField(max_length=150, unique=True),
        ),
    ]
