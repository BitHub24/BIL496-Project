from django.db import models

class Pharmacy(models.Model):
    """Model representing a pharmacy."""
    name = models.CharField(max_length=255, verbose_name="Eczane Adı")
    address = models.TextField(verbose_name="Adres")
    phone = models.CharField(max_length=50, blank=True, verbose_name="Telefon")
    district = models.CharField(max_length=100, blank=True, verbose_name="Bölge")
    extra_info = models.TextField(blank=True, verbose_name="Ek Bilgi")
    date = models.DateField(verbose_name="Tarih")
    latitude = models.FloatField(null=True, blank=True, verbose_name="Enlem")
    longitude = models.FloatField(null=True, blank=True, verbose_name="Boylam")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Nöbetçi Eczane"
        verbose_name_plural = "Nöbetçi Eczaneler"
        ordering = ['-date', 'district', 'name']
        unique_together = [['name', 'date']]
    
    def __str__(self):
        return f"{self.name} - {self.date.strftime('%d.%m.%Y')}"
    
    @property
    def location(self):
        """Returns a dict with location data if available."""
        return {
            "lat": self.latitude,
            "lng": self.longitude
        } 