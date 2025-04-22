from django.db import models

class TaxiStation(models.Model):
    """Taksi istasyonu modelidir. Google Places API'den alınan verilerle çalışır."""
    name = models.CharField(max_length=255)
    place_id = models.CharField(max_length=255, unique=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    rating = models.FloatField(null=True, blank=True)
    phone_number = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.name 