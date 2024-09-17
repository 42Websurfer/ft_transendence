# Generated by Django 4.2.15 on 2024-09-17 11:39

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('user', '0006_friendship_delete_user'),
    ]

    operations = [
        migrations.CreateModel(
            name='PongMatches',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('score_player1', models.IntegerField(default=0)),
                ('score_player2', models.IntegerField(default=0)),
                ('played_at', models.DateTimeField(auto_now_add=True)),
                ('player1_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games_as_player1', to=settings.AUTH_USER_MODEL)),
                ('player2_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games_as_player2', to=settings.AUTH_USER_MODEL)),
                ('winner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games_won', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
