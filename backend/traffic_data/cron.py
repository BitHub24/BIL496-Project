"""
Düzenli olarak trafik verisi toplamak için cron görevleri
"""
import logging
from datetime import datetime
import os
import sys
import traceback
import glob
from .collector import collect_traffic_data, DATA_DIR

def collect_traffic_data_cron():
    """
    HERE API'den trafik verilerini çeken cron görevi
    Her 15 dakikada bir çalışacak şekilde ayarlanır
    """
    # Logging konfigürasyonu
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'traffic_data', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, 'traffic_collection.log')
    
    # Hem dosyaya hem de stdout'a yazmak için handler ayarları
    logger = logging.getLogger('traffic_collector')
    logger.setLevel(logging.INFO)
    
    # Önceki handler'ları temizle
    if logger.handlers:
        for handler in logger.handlers:
            logger.removeHandler(handler)
    
    # Dosya handler'ı
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.INFO)
    
    # Console handler'ı
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    # Format oluştur
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Handler'ları ekle
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    try:
        # Zaman bilgisini kaydet
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"Trafik veri toplama görevi başlatıldı (cron) - {current_time}")
        
        # Çalışma ortamını logla
        cwd = os.getcwd()
        logger.info(f"Çalışma dizini: {cwd}")
        
        # Veri toplama işlemini çağır
        result = collect_traffic_data()
        
        if result:
            logger.info(f"Trafik veri toplama görevi başarıyla tamamlandı - {current_time}")
            
            # Eski trafik verilerini sil
            delete_old_traffic_data(logger)
            
            return "Trafik veri toplama başarılı"
        else:
            logger.error(f"Trafik veri toplama görevi başarısız oldu - {current_time}")
            return "Trafik veri toplama başarısız"
    except Exception as e:
        error_msg = f"Trafik veri toplama sırasında hata: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return error_msg

def delete_old_traffic_data(logger):
    """
    En son oluşturulan trafik verisi dışındaki eski trafik verilerini siler
    """
    try:
        # Tüm trafik veri dosyalarını bul
        pattern = os.path.join(DATA_DIR, 'traffic_data_*.json')
        files = glob.glob(pattern)
        
        # Dosyaları oluşturulma zamanına göre sırala (en yenisi en sonda)
        files.sort(key=os.path.getmtime)
        
        # En son dosyayı sakla, diğerlerini sil
        if len(files) > 1:
            latest_file = files[-1]
            for file in files[:-1]:
                os.remove(file)
                logger.info(f"Eski trafik verisi silindi: {os.path.basename(file)}")
            
            logger.info(f"Tüm eski trafik verileri silindi. Yalnızca en son veri korundu: {os.path.basename(latest_file)}")
        else:
            logger.info("Silinecek eski trafik verisi bulunamadı")
    
    except Exception as e:
        logger.error(f"Eski trafik verilerini silerken hata oluştu: {str(e)}")
        logger.error(traceback.format_exc()) 