from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

# Kullanıcı profilini genişleten model
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    
    # Şifre sıfırlama alanı
    reset_password_token = models.UUIDField(null=True, blank=True, unique=True)
    reset_password_token_created_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.user.username} Profile'

# Kullanıcı favori mekanlarını saklamak için model
class FavoriteLocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_locations')
    name = models.CharField(max_length=100) # Mekan adı (örn: Evim, İş Yerim)
    address = models.CharField(max_length=255) # Adres bilgisi
    latitude = models.FloatField()
    longitude = models.FloatField()
    tag = models.CharField(max_length=50, blank=True, null=True) # Etiket (örn: ev, iş, favori)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'latitude', 'longitude') # Bir kullanıcı aynı konumu birden fazla kaydedemez
        ordering = ['-created_at'] # Varsayılan sıralama en yeniden eskiye

    def __str__(self):
        tag_str = f" [{self.tag}]" if self.tag else ""
        return f"{self.user.username} - {self.name}{tag_str}"

# Kullanıcı oluşturulduğunda otomatik olarak UserProfile oluştur
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        # Eğer kullanıcı güncellendiyse ve profili yoksa (olmamalı ama garantiye alalım)
        UserProfile.objects.get_or_create(user=instance)

# Kullanıcı silindiğinde ilgili UserProfile'ı da sil (opsiyonel, CASCADE zaten hallediyor olabilir)
# @receiver(post_delete, sender=User)
# def delete_user_profile(sender, instance, **kwargs):
#     try:
#         instance.profile.delete()
#     except UserProfile.DoesNotExist:
#         pass
