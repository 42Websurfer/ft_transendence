# Generated by Django 4.2.16 on 2024-11-14 09:07

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='GameStatsUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.IntegerField(default=0)),
                ('username', models.CharField(blank=True, max_length=16, null=True)),
                ('avatar', models.ImageField(default='defaults/default_avatar.jpg', upload_to='avatar/')),
                ('wins', models.IntegerField(default=0)),
                ('losses', models.IntegerField(default=0)),
                ('tournament_wins', models.IntegerField(default=0)),
                ('goals_against', models.IntegerField(default=0)),
                ('goals_for', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Tournament',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tournament_id', models.CharField(max_length=50, unique=True)),
                ('date', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='TournamentResults',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rank', models.IntegerField(default=1)),
                ('games', models.IntegerField(default=0)),
                ('won', models.IntegerField(default=0)),
                ('lost', models.IntegerField(default=0)),
                ('goals_for', models.IntegerField(default=0)),
                ('goals_against', models.IntegerField(default=0)),
                ('diff', models.IntegerField(default=0)),
                ('points', models.IntegerField(default=0)),
                ('tournament_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='all_results', to='gamehub.tournament')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='all_tournament_results', to='gamehub.gamestatsuser')),
            ],
        ),
        migrations.CreateModel(
            name='OnlineMatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('home_score', models.IntegerField(default=0)),
                ('away_score', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('modus', models.CharField(default='DEFAULT', max_length=50)),
                ('home_username', models.CharField(blank=True, max_length=150, null=True)),
                ('away_username', models.CharField(blank=True, max_length=150, null=True)),
                ('away', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='away_matches', to='gamehub.gamestatsuser')),
                ('home', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='home_matches', to='gamehub.gamestatsuser')),
                ('winner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='gamehub.gamestatsuser')),
            ],
        ),
    ]
