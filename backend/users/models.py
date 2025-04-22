from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    reset_password_token = models.CharField(max_length=100, blank=True, null=True)
    reset_password_token_created_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} Profili"

class FavoriteLocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_locations')
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True, null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.user.username} - {self.name}"

# Kullanıcı oluşturulduğunda otomatik olarak profil oluşturmak için sinyal
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    try:
        instance.user_profile.save()
    except UserProfile.DoesNotExist:
        UserProfile.objects.create(user=instance)
