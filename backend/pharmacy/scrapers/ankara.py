"""
Ankara pharmacy on duty data scraper module.
"""
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException
from bs4 import BeautifulSoup
import time
import pandas as pd
import os
from datetime import datetime, timedelta
import re
import json
import logging  # Logging modülünü ekledik

# Log ayarları
def setup_logging():
    # EczaneData klasörünün varlığını kontrol et, yoksa oluştur
    os.makedirs("EczaneData/logs", exist_ok=True)
    
    # Bugünün tarihi ile log dosyası oluştur
    log_file = f"EczaneData/logs/eczane_log_{datetime.now().strftime('%Y%m%d')}.log"
    
    # Logger'ı yapılandır
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()  # Hem dosyaya hem de konsola yazdır
        ]
    )
    
    logging.info(f"Logging başlatıldı. Log dosyası: {log_file}")
    return logging.getLogger()

def fetch_crisis_data(tarih=None, logger=None):
    if logger:
        logger.info(f"Nöbetçi eczane verilerini çekme işlemi başlıyor...")
    else:
        print(f"Nöbetçi eczane verilerini çekme işlemi başlıyor...")
    
    # ChromeDriver için seçenekler ayarlanıyor - headless modu aktivite edelim
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    if logger:
        logger.info("Tarayıcı başlatılıyor...")
    else:
        print("Tarayıcı başlatılıyor...")
    driver = webdriver.Chrome(options=options)
    
    try:
        # Ankara Eczacı Odası nöbetçi eczane sayfasına git
        url = "https://www.aeo.org.tr/crisis-pha"
        
        # Temel URL'yi aç
        if logger:
            logger.info(f"Web sayfasına gidiliyor: {url}")
        else:
            print(f"Web sayfasına gidiliyor: {url}")
        driver.get(url)
        
        # Sayfanın yüklenmesi için bekleme
        if logger:
            logger.info("Sayfa yükleniyor, lütfen bekleyin...")
        else:
            print("Sayfa yükleniyor, lütfen bekleyin...")
        time.sleep(3)
        
        # Önce çerez onay penceresini kapatmayı dene
        try:
            if logger:
                logger.info("Çerez onay penceresi aranıyor...")
            else:
                print("Çerez onay penceresi aranıyor...")
            cookie_consent = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CLASS_NAME, "cookie-consent"))
            )
            
            # Kabul et butonunu bul ve tıkla
            accept_button = cookie_consent.find_element(By.CSS_SELECTOR, "button")
            if logger:
                logger.info("Çerez onay butonu bulundu, tıklanıyor...")
            else:
                print("Çerez onay butonu bulundu, tıklanıyor...")
            accept_button.click()
            time.sleep(1)
            if logger:
                logger.info("Çerez onay penceresi kapatıldı.")
            else:
                print("Çerez onay penceresi kapatıldı.")
        except Exception as e:
            if logger:
                logger.warning(f"Çerez onay penceresi işlemi sırasında hata: {e}")
                logger.info("Devam ediliyor...")
            else:
                print(f"Çerez onay penceresi işlemi sırasında hata: {e}")
                print("Devam ediliyor...")
            
        # Sayfadaki varsayılan tarihi tespit et (sadece bilgi için)
        try:
            if logger:
                logger.info("Sayfadaki tarih alanını kontrol ediyorum...")
            else:
                print("Sayfadaki tarih alanını kontrol ediyorum...")
            date_input = driver.find_element(By.ID, "crisisDate")
            default_date = date_input.get_attribute("value")
            min_date = date_input.get_attribute("min")
            max_date = date_input.get_attribute("max")
            if logger:
                logger.info(f"Tarih alanının varsayılan değeri: {default_date}")
                logger.info(f"Tarih alanının min değeri: {min_date}")
                logger.info(f"Tarih alanının max değeri: {max_date}")
            else:
                print(f"Tarih alanının varsayılan değeri: {default_date}")
                print(f"Tarih alanının min değeri: {min_date}")
                print(f"Tarih alanının max değeri: {max_date}")
        except Exception as e:
            if logger:
                logger.error(f"Varsayılan tarih kontrolü sırasında hata: {e}")
            else:
                print(f"Varsayılan tarih kontrolü sırasında hata: {e}")
        
        # Sayfa kaynağını alıyoruz - tarih değiştirmeden direkt güncel içeriği alıyoruz
        page_source = driver.page_source
        
        # Mevcut URL'i ve sayfa başlığını kontrol et
        current_url = driver.current_url
        if logger:
            logger.info(f"Mevcut URL: {current_url}")
            logger.info(f"Sayfa başlığı: {driver.title}")
        else:
            print(f"Mevcut URL: {current_url}")
            print(f"Sayfa başlığı: {driver.title}")
        
        # Alert/uyarı mesajlarını kontrol et
        try:
            alerts = driver.find_elements(By.CLASS_NAME, "alert")
            if alerts:
                if logger:
                    logger.info(f"{len(alerts)} adet uyarı mesajı bulundu:")
                else:
                    print(f"{len(alerts)} adet uyarı mesajı bulundu:")
                for idx, alert in enumerate(alerts):
                    if logger:
                        logger.info(f"Uyarı {idx+1}: {alert.text}")
                    else:
                        print(f"Uyarı {idx+1}: {alert.text}")
        except Exception as e:
            if logger:
                logger.error(f"Uyarı kontrolü sırasında hata: {e}")
            else:
                print(f"Uyarı kontrolü sırasında hata: {e}")
            
        # Sayfayı parse et
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Tablo elementlerini kontrol et - ana veri kaynağı olabilir
        tables = soup.find_all('table')
        if tables:
            if logger:
                logger.info(f"{len(tables)} adet tablo bulundu, tablolarda veri aranıyor...")
            else:
                print(f"{len(tables)} adet tablo bulundu, tablolarda veri aranıyor...")
            
            for table_idx, table in enumerate(tables):
                table_rows = table.find_all('tr')
                if logger:
                    logger.info(f"Tablo {table_idx+1}: {len(table_rows)} satır içeriyor")
                else:
                    print(f"Tablo {table_idx+1}: {len(table_rows)} satır içeriyor")
                
                # Başlıkları kontrol et
                headers = table.find_all('th')
                if headers:
                    header_texts = [h.get_text(strip=True) for h in headers]
                    if logger:
                        logger.info(f"Tablo başlıkları: {header_texts}")
                    else:
                        print(f"Tablo başlıkları: {header_texts}")
        
        # Nöbetçi eczane verilerini doğrudan paragraflardan topla
        crisis_data = []
        paragraphs = soup.find_all('p')
        
        # İlk olarak tüm eczane adlarını bul (bunlar genellikle kalın yazılır)
        eczane_adlari = []
        for p in paragraphs:
            text = p.get_text(strip=True)
            if text and "ECZANESİ" in text and len(text) < 50:  # Eczane adı kısa olmalı
                eczane_adlari.append(text)
        
        if logger:
            logger.info(f"{len(eczane_adlari)} adet eczane adı bulundu.")
        else:
            print(f"{len(eczane_adlari)} adet eczane adı bulundu.")
        
        # Şimdi her eczane için diğer bilgileri bul
        current_eczane = None
        eczane_info = {}
        
        for p in paragraphs:
            text = p.get_text(strip=True)
            if not text:
                continue
                
            # Eğer bu bir eczane adıysa, yeni bir eczane kaydı başlat
            if "ECZANESİ" in text and len(text) < 50:
                # Eğer önceki eczane bilgilerini topladıysak, listeye ekle
                if current_eczane and 'adres' in eczane_info:
                    bolge = ""
                    if 'ek_bilgi' in eczane_info and eczane_info['ek_bilgi']:
                        # Bölge genellikle ek bilgide son kısımdadır
                        bolge_match = re.search(r'\s+(\d+\.\s*Bölge|\w+\s*Bölge(?:si)?|[A-Za-zçğıöşüÇĞİÖŞÜ]+)$', eczane_info['ek_bilgi'])
                        if bolge_match:
                            bolge = bolge_match.group(1).strip()
                    
                    crisis_data.append({
                        'Eczane Adı': current_eczane,
                        'Adres': eczane_info.get('adres', ''),
                        'Telefon': eczane_info.get('telefon', ''),
                        'Ek Bilgi': eczane_info.get('ek_bilgi', ''),
                        'Bölge': bolge
                    })
                
                # Yeni eczane başlat
                current_eczane = text
                eczane_info = {}
            
            # Eğer bu paragraf bir adres ise (Mah., Cad., Sok. gibi içeriyorsa)
            elif current_eczane and ('Mah.' in text or 'Cad.' in text or 'Sok.' in text or 'No:' in text) and 'adres' not in eczane_info:
                eczane_info['adres'] = text
            
            # Eğer bu paragraf bir telefon numarası ise
            elif current_eczane and re.search(r'\d{10,11}|\d{3,4}\s*\d{3}\s*\d{2}\s*\d{2}|0\d{3}\s*\d{3}\s*\d{2}\s*\d{2}', text) and 'telefon' not in eczane_info:
                telefon_match = re.search(r'(0\d{3}\s*\d{3}\s*\d{2}\s*\d{2}|\d{10,11}|\d{3,4}\s*\d{3}\s*\d{2}\s*\d{2})', text)
                if telefon_match:
                    eczane_info['telefon'] = telefon_match.group(1)
                else:
                    eczane_info['telefon'] = text
            
            # Eğer bu paragraf ek bilgi ise (ve çok uzun değilse)
            elif current_eczane and len(text) < 100 and 'ek_bilgi' not in eczane_info:
                eczane_info['ek_bilgi'] = text
        
        # Son eczaneyi de ekle
        if current_eczane and 'adres' in eczane_info:
            bolge = ""
            if 'ek_bilgi' in eczane_info and eczane_info['ek_bilgi']:
                bolge_match = re.search(r'\s+(\d+\.\s*Bölge|\w+\s*Bölge(?:si)?|[A-Za-zçğıöşüÇĞİÖŞÜ]+)$', eczane_info['ek_bilgi'])
                if bolge_match:
                    bolge = bolge_match.group(1).strip()
            
            crisis_data.append({
                'Eczane Adı': current_eczane,
                'Adres': eczane_info.get('adres', ''),
                'Telefon': eczane_info.get('telefon', ''),
                'Ek Bilgi': eczane_info.get('ek_bilgi', ''),
                'Bölge': bolge
            })
        
        # Kartları analiz et (alternatif yaklaşım)
        if not crisis_data:
            if logger:
                logger.warning("Paragraf yöntemi başarısız oldu, şimdi kart yapısını kullanarak deniyorum...")
            else:
                print("Paragraf yöntemi başarısız oldu, şimdi kart yapısını kullanarak deniyorum...")
            
            # Eczane kartlarını temsil eden divleri bul
            eczane_div_list = soup.find_all('div', class_='pharmacy-item')
            if not eczane_div_list:
                eczane_div_list = soup.find_all('div', class_='col-lg-4')
            
            if logger:
                logger.info(f"{len(eczane_div_list)} adet potansiyel eczane kartı bulundu.")
            else:
                print(f"{len(eczane_div_list)} adet potansiyel eczane kartı bulundu.")
            
            for div in eczane_div_list:
                name = None
                address = None
                phone = None
                extra_info = None
                area = None
                
                # Kart içindeki tüm metni al
                all_text = div.get_text(separator='|', strip=True).split('|')
                
                # Eczane adı genellikle ilk sıradadır
                for text in all_text:
                    if "ECZANESİ" in text and len(text) < 50:
                        name = text.strip()
                        break
                
                if not name:
                    continue
                
                # Adres genellikle Mah., Cad., Sok. veya No: içerir
                for text in all_text:
                    if ('Mah.' in text or 'Cad.' in text or 'Sok.' in text or 'No:' in text) and text != name:
                        address = text.strip()
                        break
                
                # Telefon numarası formatını kontrol et
                for text in all_text:
                    if re.search(r'\d{10,11}|\d{3,4}\s*\d{3}\s*\d{2}\s*\d{2}|0\d{3}\s*\d{3}\s*\d{2}\s*\d{2}', text):
                        phone = text.strip()
                        break
                
                # Bölge bilgisi genellikle kısa ve son kısımdadır
                for text in all_text:
                    if text and text not in [name, address, phone] and len(text) < 30:
                        if "Bölge" in text or text.strip() in ["Batıkent", "Keçiören", "Sincan", "Çankaya", "Mamak"]:
                            area = text.strip()
                            break
                
                # Diğer bilgiler
                for text in all_text:
                    if text and text not in [name, address, phone, area] and len(text) < 100:
                        extra_info = text.strip()
                        break
                
                if name and address:
                    crisis_data.append({
                        'Eczane Adı': name,
                        'Adres': address,
                        'Telefon': phone or '',
                        'Ek Bilgi': extra_info or '',
                        'Bölge': area or ''
                    })
        
        # Tarih bilgisini veri içine ekle
        for item in crisis_data:
            item['Tarih'] = datetime.now().strftime('%Y-%m-%d')
        
        return crisis_data
        
    except Exception as e:
        if logger:
            logger.error(f"Veri çekilirken hata oluştu: {e}")
            import traceback
            logger.error(traceback.format_exc())
        else:
            print(f"Veri çekilirken hata oluştu (Tarih: {tarih}):", e)
            import traceback
            traceback.print_exc()
        return []
    finally:
        if logger:
            logger.info("Tarayıcı kapatılıyor...")
        else:
            print("Tarayıcı kapatılıyor...")
        driver.quit()

def get_duty_pharmacies():
    """Main function to fetch duty pharmacies and return as JSON."""
    # EczaneData klasörünün varlığını kontrol et, yoksa oluştur
    os.makedirs("EczaneData", exist_ok=True)
    
    # Logger'ı başlat
    logger = setup_logging()

    # Bugün için veri çek - tarih parametresi vermeden
    logger.info(f"\n{'='*20} Tarih: Bugün (Varsayılan) {'='*20}")
    logger.info("Anlık veriler çekiliyor (varsayılan tarih)...")
    
    data = fetch_crisis_data(logger=logger)
    
    if not data:
        logger.warning("Veri bulunamadı.")
        return []
    else:        
        logger.info(f"Toplam {len(data)} adet nöbetçi eczane verisi bulundu.")
        
        # Tekrarlanan eczaneleri temizle
        unique_data = []
        seen_names = set()
        
        for eczane in data:
            if eczane['Eczane Adı'] not in seen_names:
                seen_names.add(eczane['Eczane Adı'])
                unique_data.append(eczane)
        
        logger.info(f"Tekrarlananlar kaldırıldıktan sonra {len(unique_data)} adet tekil eczane kaldı.")
        
        # Verileri JSON dosyasına kaydet - sadece tarih kullanarak
        date_str = datetime.now().strftime('%Y%m%d')
        json_dosya = f"EczaneData/{date_str}.json"
        
        with open(json_dosya, 'w', encoding='utf-8') as f:
            json.dump(unique_data, f, ensure_ascii=False, indent=4)
            
        logger.info(f"Veriler '{json_dosya}' dosyasına JSON formatında kaydedildi.")
        logger.info(f"Dosya konumu: {os.path.abspath(json_dosya)}")
        
        return unique_data 