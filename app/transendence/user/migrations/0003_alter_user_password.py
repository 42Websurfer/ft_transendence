# Generated by Django 4.2.15 on 2024-09-04 11:53

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0002_user_email_user_password_user_username'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='password',
            field=models.CharField(default='DEFAULT', max_length=255),
        ),
    ]