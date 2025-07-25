# Generated by Django 4.2.20 on 2025-04-25 22:03

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('routing', '0002_userareapreference'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userareapreference',
            name='max_lat',
            field=models.DecimalField(decimal_places=7, max_digits=11),
        ),
        migrations.AlterField(
            model_name='userareapreference',
            name='max_lon',
            field=models.DecimalField(decimal_places=7, max_digits=11),
        ),
        migrations.AlterField(
            model_name='userareapreference',
            name='min_lat',
            field=models.DecimalField(decimal_places=7, max_digits=11),
        ),
        migrations.AlterField(
            model_name='userareapreference',
            name='min_lon',
            field=models.DecimalField(decimal_places=7, max_digits=11),
        ),
    ]
