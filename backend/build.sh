#!/usr/bin/env bash
# Render.com için build betiği

set -o errexit  # Herhangi bir komut başarısız olursa exit
set -o pipefail # Pipe kullanılan işlemlerde herhangi bir kısım başarısız olursa exit
set -o nounset  # Tanımlanmamış değişkenlerin kullanımını engelle

# Python bağımlılıklarını yükle
pip install --upgrade pip
pip install -r requirements.txt

# ChromeDriver indirme ve kurma
curl -SL https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_linux64.zip > chromedriver.zip
unzip chromedriver.zip
chmod +x chromedriver
mkdir -p bin
mv chromedriver bin/

# Chrome tarayıcı kurulumu
curl -SL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o chrome.deb
apt-get update && apt-get install -y ./chrome.deb
rm chrome.deb

# Statik dosyaları topla
python manage.py collectstatic --noinput

# Veritabanı migrasyon işlemlerini yap
python manage.py makemigrations
python manage.py migrate 