from django.db import models
from django.conf import settings

class RoadSegment(models.Model):
    """Model representing a road segment that can be preferred or avoided."""
    osm_id = models.BigIntegerField(unique=True, verbose_name="OSM Way ID")
    name = models.CharField(max_length=255, blank=True, verbose_name="Road Name")
    road_type = models.CharField(max_length=50, blank=True, verbose_name="Road Type")
    start_node = models.BigIntegerField(verbose_name="Start Node ID")
    end_node = models.BigIntegerField(verbose_name="End Node ID")
    # geometry = gis_models.LineStringField(verbose_name="Road Geometry") # Eski alan
    geometry = models.TextField(blank=True, null=True, verbose_name="Road Geometry (GeoJSON)") # TextField olarak değiştirildi
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Road Segment"
        verbose_name_plural = "Road Segments"
        indexes = [
            models.Index(fields=['osm_id']),
            models.Index(fields=['name']),
            models.Index(fields=['road_type']),
        ]
    
    def __str__(self):
        return f"{self.name or 'Unnamed Road'} ({self.osm_id})"


class UserRoadPreference(models.Model):
    """Model representing a user's preference for a specific road segment."""
    PREFERENCE_CHOICES = [
        ('prefer', 'Prefer this road'),
        ('avoid', 'Avoid this road'),
    ]
    
    user = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='road_preferences')
    road_segment = models.ForeignKey(RoadSegment, on_delete=models.CASCADE, related_name='user_preferences')
    preference_type = models.CharField(max_length=10, choices=PREFERENCE_CHOICES, verbose_name="Preference Type")
    reason = models.TextField(blank=True, verbose_name="Reason for Preference")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Road Preference"
        verbose_name_plural = "User Road Preferences"
        unique_together = [['user', 'road_segment']]
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['preference_type']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.get_preference_type_display()} - {self.road_segment}"


class RoutePreferenceProfile(models.Model):
    """Model representing a user's route preference profile."""
    user = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='route_profiles')
    name = models.CharField(max_length=100, verbose_name="Profile Name")
    is_default = models.BooleanField(default=False, verbose_name="Default Profile")
    description = models.TextField(blank=True, verbose_name="Profile Description")
    
    # Preference weights (can be adjusted by user)
    prefer_multiplier = models.FloatField(default=0.75, verbose_name="Preferred Road Multiplier")
    avoid_multiplier = models.FloatField(default=3.0, verbose_name="Avoided Road Multiplier")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Route Preference Profile"
        verbose_name_plural = "Route Preference Profiles"
        unique_together = [['user', 'name']]
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['is_default']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.name}"
    
    def save(self, *args, **kwargs):
        # Ensure only one default profile per user
        if self.is_default:
            RoutePreferenceProfile.objects.filter(
                user=self.user, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

# YENİ MODEL: Kullanıcı Alan Tercihi
class UserAreaPreference(models.Model):
    """Stores user preferences for specific geographic areas (bounding boxes)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name='area_preferences', 
        on_delete=models.CASCADE
    )
    preference_type = models.CharField(
        max_length=10, 
        choices=[('prefer', 'Prefer'), ('avoid', 'Avoid')]
    )
    # Alanın köşe koordinatları
    # Hassasiyet için DecimalField kullanmak daha iyi olabilir
    min_lat = models.DecimalField(max_digits=14, decimal_places=7) # max_digits 11 -> 14
    min_lon = models.DecimalField(max_digits=14, decimal_places=7) # max_digits 11 -> 14
    max_lat = models.DecimalField(max_digits=14, decimal_places=7) # max_digits 11 -> 14
    max_lon = models.DecimalField(max_digits=14, decimal_places=7) # max_digits 11 -> 14
    
    reason = models.TextField(blank=True, null=True) # Opsiyonel açıklama
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Bir kullanıcının aynı alan için birden fazla tercihi olmamasını sağlayabiliriz (opsiyonel)
        # unique_together = ('user', 'min_lat', 'min_lon', 'max_lat', 'max_lon')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.get_preference_type_display()} Area ({self.min_lat},{self.min_lon} to {self.max_lat},{self.max_lon})"
