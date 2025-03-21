import requests
import json
from datetime import datetime
import pathlib
import os
import logging
from django.conf import settings

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

def collect_traffic_data():
    """HERE Maps API'den trafik verilerini topla"""
    
    # API anahtarını ortam değişkenlerinden veya settings.py'den al
    api_key = getattr(settings, 'HERE_API_KEY', None)
    
    if not api_key:
        logging.error("HERE API anahtarı bulunamadı")
        return False
    
    # API endpoint ve parametreleri
    url = "https://data.traffic.hereapi.com/v7/flow"
    params = {
        "apiKey": api_key,
        "in": f"bbox:{ANKARA_BOUNDS['west']},{ANKARA_BOUNDS['south']},{ANKARA_BOUNDS['east']},{ANKARA_BOUNDS['north']}",
        "locationReferencing": "shape",
        "return": "description,currentFlow,freeFlow"
    }

    try:
        # API isteği gönder
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        # Yanıtı işle
        data = response.json()
        
        # Zaman damgası ekle
        data['timestamp'] = datetime.now().isoformat()
        
        # Veriyi kaydet
        ensure_data_directory()
        filename = get_timestamp_filename()
        filepath = os.path.join(DATA_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        logging.info(f"Trafik verisi başarıyla kaydedildi: {filename}")
        return True
        
    except Exception as e:
        logging.error(f"Veri toplama hatası: {str(e)}")
        return False 