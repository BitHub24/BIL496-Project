"""
PostgreSQL veritabanı yapılandırma dosyası.
Bu dosya veritabanı bağlantı bilgilerini .env dosyasından alır.
"""
import os
from dotenv import load_dotenv
import sys
from pathlib import Path

# Çalışma dizinini ve .env dosyasını doğru yerden buluyoruz
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / '.env'

# .env dosyasını tam yoluyla yükle
load_dotenv(dotenv_path=env_path)

# Bağlantı bilgilerini günlüğe kaydediyoruz
print("DB_CONFIG: Veritabanı bağlantı bilgileri yükleniyor")
print(f"Env dosyası konumu: {env_path}")
print(f"DB HOST: {os.getenv('DB_HOST', 'Değer yok')}")
print(f"DB NAME: {os.getenv('DB_NAME', 'Değer yok')}")
print(f"DB USER: {os.getenv('DB_USER', 'Değer yok')}")
print(f"DB PORT: {os.getenv('DB_PORT', 'Değer yok')}")

# PostgreSQL bağlantı bilgileri .env dosyasından alınır
POSTGRES_CONFIG = {
    'NAME': os.getenv('DB_NAME', 'bithub'),  # Veritabanı adı
    'USER': os.getenv('DB_USER', 'admin'),   # Kullanıcı adı
    'PASSWORD': os.getenv('DB_PASSWORD', 'srTCbq8c7H7QEfOf2Wgg7ORpHAGOBSrV'),   # Şifre
    'HOST': os.getenv('DB_HOST', 'oregon-postgres.render.com'),       # IP adresi
    'PORT': os.getenv('DB_PORT', '5432'),            # Port numarası
}

# Django için veritabanı yapılandırması
DATABASE_CONFIG = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': POSTGRES_CONFIG['NAME'],
        'USER': POSTGRES_CONFIG['USER'],
        'PASSWORD': POSTGRES_CONFIG['PASSWORD'],
        'HOST': POSTGRES_CONFIG['HOST'],
        'PORT': POSTGRES_CONFIG['PORT'],
    }
} 