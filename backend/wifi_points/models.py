from django.db import models

class WiFiPoint(models.Model):
    """WiFi Noktası modeli"""
    name = models.CharField(max_length=255, verbose_name="İsim")
    address = models.CharField(max_length=500, verbose_name="Adres")
    category = models.CharField(max_length=100, verbose_name="Kategori", default="Wifi Noktası")
    is_active = models.BooleanField(default=True, verbose_name="Aktif mi?")
    latitude = models.FloatField(verbose_name="Enlem")
    longitude = models.FloatField(verbose_name="Boylam")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Oluşturulma Tarihi")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Güncellenme Tarihi")
    
    class Meta:
        verbose_name = "WiFi Noktası"
        verbose_name_plural = "WiFi Noktaları"
    
    def __str__(self):
        return self.name
