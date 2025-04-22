import requests
import json
from datetime import datetime
import pathlib
import os
import logging
from django.conf import settings
import glob
from background_task import background # Arka plan görevi için import

# Veri dizini
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'traffic_data', 'data')

# Ankara Çankaya bölgesi sınırları (genişletilmiş)
ANKARA_BOUNDS = {
    "north": 39.9850,  # Kızılay-Sıhhiye
    "south": 39.7500,  # Alacaatlı-İncek güney sınırı
    "east": 32.9500,   # Çankaya doğu sınırı (Beytepe-Mamak)
    "west": 32.6800    # Alacaatlı-Ümitköy batı sınırı
}

def ensure_data_directory():
    """Veri dizininin varlığını kontrol et ve yoksa oluştur"""
    pathlib.Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

def get_timestamp_filename():
    """Zaman damgalı dosya adı oluştur"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"traffic_data_{timestamp}.json"

@background(schedule=0) # Arka plan görevi olarak işaretle
def collect_traffic_data():
    """HERE Maps API'den trafik verilerini topla"""
    
    api_key = getattr(settings, 'HERE_API_KEY', None)
    if not api_key:
        logging.error("HERE API anahtarı bulunamadı")
        return False
    
    url = "https://data.traffic.hereapi.com/v7/flow"
    params = {
        "apiKey": api_key,
        "in": f"bbox:{ANKARA_BOUNDS['west']},{ANKARA_BOUNDS['south']},{ANKARA_BOUNDS['east']},{ANKARA_BOUNDS['north']}",
        "locationReferencing": "shape",
        "return": "description,currentFlow,freeFlow"
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        data['timestamp'] = datetime.now().isoformat()
        
        ensure_data_directory()
        filename = get_timestamp_filename()
        filepath = os.path.join(DATA_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        logging.info(f"Trafik verisi başarıyla kaydedildi: {filename}")

        # --- Eski Dosyaları Temizleme Mantığı --- 
        try:
            all_files = glob.glob(os.path.join(DATA_DIR, "traffic_data_*.json"))
            # En son oluşturulan dosyayı koru, diğerlerini sil
            if len(all_files) > 1: # En az 2 dosya varsa temizlik yap
                # Dosyaları oluşturulma zamanına göre sırala (en yeni en sonda)
                all_files.sort(key=os.path.getctime)
                # Silinecek dosyalar (en yeni hariç hepsi)
                files_to_delete = all_files[:-1]
                deleted_count = 0
                for old_file in files_to_delete:
                    try:
                        os.remove(old_file)
                        logging.info(f"Eski trafik dosyası silindi: {os.path.basename(old_file)}")
                        deleted_count += 1
                    except OSError as e:
                        logging.error(f"Eski dosya silinemedi ({os.path.basename(old_file)}): {e}")
                if deleted_count > 0:
                     logging.info(f"Toplam {deleted_count} eski trafik dosyası silindi.")
        except Exception as clean_e:
            logging.error(f"Eski trafik dosyalarını temizlerken hata oluştu: {clean_e}")
        # ----------------------------------------

        return True
        
    except Exception as e:
        logging.error(f"Veri toplama hatası: {str(e)}")
        return False 