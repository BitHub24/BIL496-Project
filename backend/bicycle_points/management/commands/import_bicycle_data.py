import json
import os
import logging
from django.conf import settings
from django.core.management.base import BaseCommand
from bicycle_points.models import BicyclePoint

logger = logging.getLogger(__name__)

# JSON veri dosyası yolu
BICYCLE_DATA_PATH = os.path.join(settings.BASE_DIR, 'bicycle_points', 'data', 'Bicycle.json')

class Command(BaseCommand):
    help = 'Bicycle.json dosyasından bisiklet istasyonları verilerini içe aktarır'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Bisiklet istasyonları verilerini içe aktarma işlemi başlatılıyor...'))
        
        try:
            # JSON dosyasını oku
            with open(BICYCLE_DATA_PATH, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)
            
            # İçe aktarma istatistikleri
            created_count = 0
            skipped_count = 0
            
            # Her bir özellik için
            for feature in geojson_data.get('features', []):
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                
                # Sadece MultiPoint tipindeki bisiklet istasyonlarını al
                if geometry.get('type') == 'MultiPoint':
                    coords = geometry.get('coordinates', [])
                    if coords and len(coords[0]) >= 2:
                        # Koordinatlar [longitude, latitude] formatında geliyor
                        longitude, latitude = coords[0][0], coords[0][1]
                        global_id = properties.get('global_id', '')
                        name = properties.get('name', '')
                        
                        # Aynı global_id'ye sahip bir kayıt var mı kontrol et
                        if global_id and not BicyclePoint.objects.filter(global_id=global_id).exists():
                            # Yeni istasyon oluştur
                            BicyclePoint.objects.create(
                                name=name,
                                global_id=global_id,
                                latitude=latitude,
                                longitude=longitude,
                                is_active=True
                            )
                            created_count += 1
                        else:
                            skipped_count += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'İçe aktarma tamamlandı. {created_count} yeni kayıt eklendi, {skipped_count} kayıt atlandı.')
            )
            
        except Exception as e:
            logger.error(f"Bisiklet istasyonu verilerini içe aktarma hatası: {str(e)}")
            self.stdout.write(self.style.ERROR(f'Hata: {str(e)}')) 