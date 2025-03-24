from django.db import models

class BicyclePoint(models.Model):
    """Bisiklet İstasyonu modeli"""
    name = models.CharField(max_length=255, verbose_name="İsim")
    global_id = models.CharField(max_length=255, verbose_name="Global ID", unique=True)
    is_active = models.BooleanField(default=True, verbose_name="Aktif mi?")
    latitude = models.FloatField(verbose_name="Enlem")
    longitude = models.FloatField(verbose_name="Boylam")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Oluşturulma Tarihi")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Güncellenme Tarihi")
    
    class Meta:
        verbose_name = "Bisiklet İstasyonu"
        verbose_name_plural = "Bisiklet İstasyonları"
    
    def __str__(self):
        return self.name 