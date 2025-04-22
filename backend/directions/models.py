from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """Kullanıcı profil modeli"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='directions_profile')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} Profili"

class RoutePreference(models.Model):
    """Kullanıcı rota tercih modeli"""
    ROUTE_TYPES = (
        ('fastest', 'En Hızlı'),
        ('shortest', 'En Kısa'),
        ('balanced', 'Dengeli'),
    )
    
    TRAFFIC_PRIORITIES = (
        ('avoid', 'Trafikten Kaçın'),
        ('moderate', 'Orta Seviye'),
        ('ignore', 'Trafiği Önemseme'),
    )
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='route_preference')
    route_type = models.CharField(max_length=20, choices=ROUTE_TYPES, default='balanced')
    avoid_highways = models.BooleanField(default=False)
    avoid_tolls = models.BooleanField(default=False)
    avoid_ferries = models.BooleanField(default=False)
    traffic_priority = models.CharField(max_length=20, choices=TRAFFIC_PRIORITIES, default='moderate')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_route_type_display()}"
    
class SavedRoute(models.Model):
    """Kullanıcının kaydettiği rotalar"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_routes')
    name = models.CharField(max_length=255)
    start_lat = models.FloatField()
    start_lon = models.FloatField()
    start_name = models.CharField(max_length=255)
    end_lat = models.FloatField()
    end_lon = models.FloatField()
    end_name = models.CharField(max_length=255)
    route_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.name}"
