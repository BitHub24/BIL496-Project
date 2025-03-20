from celery import shared_task
import logging
from .collector import collect_traffic_data
import os

@shared_task(name="collect_traffic_data_task")
def collect_traffic_data_task():
    """
    HERE API'den trafik verilerini çeken Celery görevi
    Her 15 dakikada bir çalışacak şekilde ayarlanır
    """
    # Logging konfigürasyonu
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'traffic_data', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, 'traffic_collection.log')
    
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    logging.info("Trafik veri toplama görevi başlatıldı")
    
    # Veri toplama işlemini çağır
    result = collect_traffic_data()
    
    if result:
        logging.info("Trafik veri toplama görevi başarıyla tamamlandı")
        return "Trafik veri toplama başarılı"
    else:
        logging.error("Trafik veri toplama görevi başarısız oldu")
        return "Trafik veri toplama başarısız" 