"""
Celery Beat için başlangıç görevlerini içeren dosya.
Bu dosyadaki kodlar pharmacy uygulaması yüklendiğinde otomatik olarak zamanlanmış görevleri oluşturur.
"""

from django_celery_beat.models import PeriodicTask, CrontabSchedule
from django.db import transaction
import logging

logger = logging.getLogger(__name__)

def setup_periodic_tasks():
    """
    Celery Beat için periyodik görevleri ayarlar.
    Bu fonksiyon Django başlatıldığında çağrılır.
    """
    try:
        with transaction.atomic():
            # Türkiye saati ile 05:30'da çalışacak crontab ayarı
            schedule, created = CrontabSchedule.objects.get_or_create(
                minute='30',
                hour='5',
                day_of_week='*',
                day_of_month='*',
                month_of_year='*',
                timezone='Europe/Istanbul'
            )
            
            # Görev tanımını oluştur veya güncelle
            task, created = PeriodicTask.objects.update_or_create(
                name='Nöbetçi Eczane Verilerini Çek (Her Gün 05:30)',
                defaults={
                    'crontab': schedule,
                    'task': 'pharmacy.tasks.fetch_duty_pharmacies_task',
                    'enabled': True,
                    'description': 'Her gün sabah 05:30\'da Ankara Eczacı Odası web sitesinden nöbetçi eczane verilerini çeker.'
                }
            )
            
            if created:
                logger.info("Nöbetçi eczane görev zamanlaması oluşturuldu")
            else:
                logger.info("Nöbetçi eczane görev zamanlaması güncellendi")
                
    except Exception as e:
        logger.error(f"Görev zamanlaması sırasında hata: {e}")
        
# Uygulamayı yeniden başlatırken mevcut görevleri silip yeniden oluşturmak için
def reset_periodic_tasks():
    """
    Mevcut nöbetçi eczane görevlerini siler ve yeniden oluşturur.
    """
    try:
        # Mevcut görevi bul ve sil
        tasks = PeriodicTask.objects.filter(name='Nöbetçi Eczane Verilerini Çek (Her Gün 05:30)')
        count = tasks.count()
        tasks.delete()
        logger.info(f"{count} adet eski görev zamanlaması silindi")
        
        # Yeniden oluştur
        setup_periodic_tasks()
    except Exception as e:
        logger.error(f"Görev zamanlaması sıfırlama sırasında hata: {e}") 