# Generated by Django 4.2.15 on 2024-10-28 14:02

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0002_userprofile'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PongMatches',
        ),
    ]
