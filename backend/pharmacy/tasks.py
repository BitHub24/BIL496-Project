from celery import shared_task
from .scrapers.ankara import get_duty_pharmacies
from .models import Pharmacy
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@shared_task
def fetch_duty_pharmacies_task():
    """Nöbetçi eczane verilerini çek ve veritabanına kaydet"""
    logger.info("Nöbetçi eczane veri çekme görevi başlatıldı")
    
    # Bugün için veri çek
    today = datetime.now().date()
    pharmacies_data = get_duty_pharmacies()
    
    if pharmacies_data:
        # Mevcut verileri temizle
        existing_count = Pharmacy.objects.filter(date=today).count()
        Pharmacy.objects.filter(date=today).delete()
        logger.info(f"{existing_count} adet mevcut kayıt silindi")
        
        # Yeni verileri kaydet
        new_records = []
        for pharmacy_data in pharmacies_data:
            pharmacy = Pharmacy(
                name=pharmacy_data['Eczane Adı'],
                address=pharmacy_data['Adres'],
                phone=pharmacy_data['Telefon'],
                district=pharmacy_data['Bölge'],
                extra_info=pharmacy_data['Ek Bilgi'],
                date=datetime.strptime(pharmacy_data['Tarih'], '%Y-%m-%d').date()
            )
            new_records.append(pharmacy)
        
        Pharmacy.objects.bulk_create(new_records)
        logger.info(f"Başarıyla {len(pharmacies_data)} adet nöbetçi eczane verisi kaydedildi.")
        return f"Başarıyla {len(pharmacies_data)} adet nöbetçi eczane verisi kaydedildi."
    else:
        logger.error("Nöbetçi eczane verisi çekilemedi.")
        return "Nöbetçi eczane verisi çekilemedi." 