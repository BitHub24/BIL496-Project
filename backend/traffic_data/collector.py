import requests
import json
from datetime import datetime
import pathlib
import os
import logging
from django.conf import settings
import glob
import tempfile # Geçici dosya için
# from background_task import background # Bu satırı kaldıracağız veya yorum satırı yapacağız

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

# @background(schedule=10) # Bu dekoratörü kaldırıyoruz
def collect_traffic_data():
    """HERE Maps API'den trafik verilerini topla ve atomik olarak kaydet."""
    
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

    tmp_filepath = None # Geçici dosya yolu
    try:
        response = requests.get(url, params=params, timeout=30) # Timeout ekleyelim
        response.raise_for_status() # HTTP hatalarını kontrol et
        
        try:
            data = response.json() # JSON parse etmeyi dene
        except json.JSONDecodeError as json_err:
             logging.error(f"API'den gelen yanıt JSON formatında değil: {json_err}. Yanıt içeriği (ilk 500 karakter): {response.text[:500]}")
             return False # Hatalı JSON ile devam etme

        data['timestamp'] = datetime.now().isoformat()
        
        ensure_data_directory()
        filename = get_timestamp_filename()
        filepath = os.path.join(DATA_DIR, filename)
        
        # --- Atomik Yazma Başlangıcı ---
        # Geçici bir dosya oluştur (aynı dizinde, .tmp uzantılı)
        # NamedTemporaryFile kullanmak yerine elle yönetmek rename için daha güvenli olabilir.
        tmp_filepath = filepath + f".{os.getpid()}.tmp" # İşlem ID'si ile eşsizleştir
        
        logging.info(f"Writing data to temporary file: {os.path.basename(tmp_filepath)}")
        with open(tmp_filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            # Yazma işleminin tamamlandığından emin olmak için dosyayı flush et ve kapat (with bloğu bunu yapar)
        
        # Yazma başarılıysa, geçici dosyayı asıl dosya adıyla değiştir
        logging.info(f"Renaming temporary file to final file: {filename}")
        os.rename(tmp_filepath, filepath)
        tmp_filepath = None # Başarıyla yeniden adlandırıldı, artık silmeye gerek yok
        # --- Atomik Yazma Sonu ---
            
        logging.info(f"Trafik verisi başarıyla kaydedildi: {filename}")

        # --- Eski Dosyaları Temizleme Mantığı (Başarılı yazmadan sonra) --- 
        try:
            all_files = glob.glob(os.path.join(DATA_DIR, "traffic_data_*.json"))
            if len(all_files) > 1:
                all_files.sort(key=os.path.getctime)
                files_to_delete = all_files[:-1] # En yeni hariç
                deleted_count = 0
                for old_file in files_to_delete:
                    if old_file != filepath: # Yeni oluşturulan dosyayı silme
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
        
    except requests.exceptions.RequestException as req_err:
        # Ağ veya API isteği hataları
        logging.error(f"API isteği hatası: {req_err}")
        return False
    except Exception as e:
        # Diğer beklenmedik hatalar (örn. dosya yazma, rename)
        logging.exception(f"Veri toplama sırasında beklenmedik hata") # exception ile traceback loglanır
        return False
    finally:
        # Eğer işlem hata verirse ve geçici dosya kaldıysa sil
        if tmp_filepath and os.path.exists(tmp_filepath):
            try:
                os.remove(tmp_filepath)
                logging.warning(f"Hata nedeniyle geçici dosya silindi: {os.path.basename(tmp_filepath)}")
            except OSError as e:
                logging.error(f"Hata sonrası geçici dosya silinemedi ({os.path.basename(tmp_filepath)}): {e}") 