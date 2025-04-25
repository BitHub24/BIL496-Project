# Map Project (BIL496 Project)

Bu proje, Ankara için bir harita üzerinde rota bulma, güncel trafik durumu, nöbetçi eczaneler, WiFi noktaları ve bisiklet istasyonları gibi bilgileri sunan bir web uygulamasıdır. Backend Django ile, frontend ise React (Vite ile) ve Leaflet kullanılarak geliştirilmiştir.

## Özellikler

*   Başlangıç ve hedef noktası seçerek farklı ulaşım modları (araba, toplu taşıma, yürüme, bisiklet) için rota oluşturma.
*   Rota süresi, mesafe ve tahmini varış zamanı gösterimi.
*   Güncel trafik yoğunluğu katmanı (backend'den alınır).
*   Harita üzerinde en yakın nöbetçi eczaneleri bulma ve listeleme.
*   WiFi erişim noktalarını ve bisiklet istasyonlarını haritada gösterme/gizleme.
*   Kullanıcıların favori konumlarını kaydetmesi (giriş yapıldığında).
*   Ayarlar sayfasında kullanıcı profili ve tercih yönetimi.
*   Farklı harita stilleri seçimi.

## Kurulum

### Ön Gereksinimler

*   Python (3.9 veya üstü önerilir)
*   Node.js (LTS sürümü önerilir) ve npm
*   `pip` (Python paket yöneticisi)

### Adımlar

1.  **Projeyi Klonlama:**
    ```bash
    git clone <repository_url>
    cd BIL496-Project
    ```

2.  **Backend Kurulumu:**
    *   `backend` dizinine gidin: `cd backend`
    *   Sanal ortam oluşturun ve aktifleştirin:
        ```bash
        python -m venv .venv
        source .venv/bin/activate  # Linux/macOS
        # .\.venv\Scripts\activate  # Windows
        ```
    *   Gerekli Python paketlerini kurun:
        ```bash
        pip install -r requirements.txt
        ```
    *   `backend` dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın:
        ```dotenv
        SECRET_KEY='django-secret-key-buraya-gelecek'
        DEBUG=True # Geliştirme için True, canlı ortam için False
        DATABASE_URL='sqlite:///db.sqlite3' # Veya PostgreSQL/MySQL bağlantı URL'si
        # Trafik verisi API anahtarı (Eğer varsa)
        TRAFFIC_API_KEY='trafik-api-anahtari'
        # Diğer backend ayarları...
        ```
    *   Veritabanı tablolarını oluşturun:
        ```bash
        python manage.py migrate
        ```
    *   (Opsiyonel) Yönetici (admin) kullanıcısı oluşturun:
        ```bash
        python manage.py createsuperuser
        ```

3.  **Frontend Kurulumu:**
    *   Ana dizine dönüp `frontend` dizinine gidin: `cd ../frontend`
    *   Gerekli Node.js paketlerini kurun:
        ```bash
        npm install
        ```
    *   `frontend` dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın:
        ```dotenv
        VITE_BACKEND_API_URL =http://127.0.0.1:8000 # Backend sunucu adresi
        VITE_REACT_APP_GOOGLE_API_KEY=google-maps-api-anahtari # Google Geocoding API anahtarı
        ```
    *   **Önemli:** `VITE_REACT_APP_GOOGLE_API_KEY` için Google Cloud Platform'dan bir API anahtarı almanız ve Geocoding API'yi etkinleştirmeniz gerekmektedir.

## Çalıştırma

1.  **Backend Sunucusunu Başlatma:**
    *   `backend` dizininde ve sanal ortam aktifken:
        ```bash
        python manage.py runserver
        ```
    *   Sunucu varsayılan olarak `http://127.0.0.1:8000/` adresinde çalışacaktır.

2.  **Frontend Geliştirme Sunucusunu Başlatma:**
    *   `frontend` dizininde (ayrı bir terminalde):
        ```bash
        npm run dev
        ```
    *   Uygulama genellikle `http://localhost:5173/` gibi bir adreste açılacaktır (terminal çıktısını kontrol edin).

3.  **Arkaplan Görevlerini Çalıştırma (Trafik Verisi Toplama vb.):**
    *   Eğer `django-q` veya benzeri bir kütüphane kullanılıyorsa, arkaplan işçisini başlatmanız gerekir. `backend` dizininde (ayrı bir terminalde):
        ```bash
        python manage.py qcluster # django-q için örnek komut
        ```
    *   Kullanılan kütüphaneye göre komut değişebilir (`celery worker` vb.).

4.  **Zamanlanmış Görevleri Çalıştırma (Cronjobs):**
    *   Eğer `django-cron` kullanılıyorsa, görevleri tetiklemek için:
        ```bash
        python manage.py runcrons
        ```
    *   Bu komutun düzenli aralıklarla çalıştırılması gerekebilir (örn. sistem cron'u ile).

## Grafikleri Oluşturma

Rota bulma özelliği için genellikle bir yol ağı grafiği kullanılır. Bu grafik, OpenStreetMap (OSM) verisinden oluşturulur.

1.  **OSM Verisi İndirme:**
    *   Ankara veya ilgilenilen bölge için güncel bir `.osm.pbf` dosyası indirin (örneğin Geofabrik'ten).
    *   Bu dosyayı projenizde uygun bir yere (örn. `backend/data/osm/`) kaydedin.

2.  **Graf Oluşturma Komutu:**
    *   Grafiği oluşturmak için özel bir Django yönetim komutu bulunmaktadır (komut adı farklı olabilir):
        ```bash
        # backend dizininde ve sanal ortam aktifken
        python manage.py build_graph --input path/to/your/ankara.osm.pbf --output backend/graphs/ankara_graph.graphml
        ```
    *   `--input`: İndirdiğiniz `.osm.pbf` dosyasının yolunu belirtir.
    *   `--output`: Oluşturulacak graf dosyasının kaydedileceği yeri ve adını belirtir (örn. `backend/graphs/` dizini). `.graphml` veya `.pkl` gibi formatlar kullanılabilir.
    *   **Not:** `build_graph` komutunun tam adı ve parametreleri projenin `directions` uygulamasındaki yönetim komutlarına göre değişebilir. Lütfen ilgili kodu kontrol edin.

## Katkıda Bulunma

Katkıda bulunmak isterseniz, lütfen issue açın veya pull request gönderin. 