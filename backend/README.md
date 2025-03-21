# BitHub - Trafik ve Eczane API Servisi

Bu proje, trafik verileri ve nöbetçi eczane bilgilerini sağlayan bir Django REST API servisidir. Kullanıcılar için rota çizimi, adres arama ve eczane bilgilerine erişim gibi özellikler sunar.

## Özellikler

- Trafik verilerinin belirli aralıklarla toplanması
- Nöbetçi eczane listesinin günlük olarak güncellenmesi
- Kullanıcı kaydı ve kimlik doğrulama
- Adres arama (Geocoding)
- A'dan B'ye rota oluşturma (Directions)
- En yakın eczaneleri bulma

## Teknolojiler

- Python 3.x
- Django 4.2.20
- Django REST Framework 3.15.2
- PostgreSQL (veritabanı)
- Django-crontab (zamanlanmış görevler için)
- Selenium (web scraping için)
- BeautifulSoup4 (web scraping için)

## Kurulum

1. Projeyi klonlayın
```bash
git clone https://github.com/kullaniciadi/BIL496-Project.git
cd BIL496-Project
```

2. Backend dizinine geçin ve sanal ortam oluşturun
```bash
cd backend
python -m venv venv
```

3. Sanal ortamı aktifleştirin
```bash
# Windows için
venv\Scripts\activate
# macOS/Linux için
source venv/bin/activate
```

4. Gerekli paketleri yükleyin
```bash
pip install -r requirements.txt
```

5. `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değişkenleri doldurun

6. Veritabanı migrasyonlarını uygulayın
```bash
python manage.py migrate
```

7. Zamanlanmış görevleri ekleyin
```bash
python manage.py crontab add
```

8. Geliştirme sunucusunu başlatın
```bash
python manage.py runserver
```

## API Endpointleri

### Kullanıcı API

- `POST /api/users/register/`: Yeni kullanıcı kaydı
- `POST /api/users/login/`: Kullanıcı girişi
- `POST /api/users/logout/`: Kullanıcı çıkışı
- `GET /api/users/me/`: Giriş yapmış kullanıcının bilgilerini getir
- `PUT /api/users/update/`: Kullanıcı bilgilerini güncelle

### Eczane API

- `GET /api/pharmacies`: Nöbetçi eczane listesi
  - Query parametreleri:
    - `date`: İstenilen tarih (YYYY-MM-DD formatında, varsayılan: bugün)
    - `city`: Şehir adı
    - `district`: İlçe adı

- `GET /api/pharmacies/nearest`: En yakın eczaneleri bul
  - Query parametreleri:
    - `lat`: Enlem (latitude)
    - `lon`: Boylam (longitude)
    - `limit`: Döndürülecek eczane sayısı (varsayılan: 5)

### Coğrafi Kodlama API (Geocoding)

- `GET /api/geocoding/search/`: Adres araması yapar
  - Query parametreleri:
    - `q`: Arama sorgusu (örn: "Kadıköy İstanbul")

### Yol Tarifi API (Directions)

- `POST /api/directions/route/`: İki nokta arasında rota oluşturur
  - Request body:
    ```json
    {
      "origin": [longitude, latitude],
      "destination": [longitude, latitude],
      "mode": "driving"
    }
    ```

### Trafik Verileri API

- `GET /api/traffic/latest/`: En son toplanan trafik verilerini döndürür

## Zamanlanmış Görevler

Projede iki adet zamanlanmış görev bulunmaktadır:

1. `fetch_duty_pharmacies`: Her gün sabah 6'da nöbetçi eczane verilerini toplar
2. `collect_traffic_data_cron`: Her 15 dakikada bir trafik verilerini toplar

## Yönetim Komutları

Django yönetim komutları ile bazı işlemleri manuel olarak gerçekleştirebilirsiniz:

- Nöbetçi eczane verilerini topla: `python manage.py fetch_duty_pharmacies`
- Trafik verilerini topla: `python manage.py collect_traffic_data`
- Zamanlanmış görevleri göster: `python manage.py crontab show`
- Zamanlanmış görevleri kaldır: `python manage.py crontab remove`

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakınız. 