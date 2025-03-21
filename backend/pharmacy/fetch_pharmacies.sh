#!/bin/bash

# Nöbetçi eczane verilerini çekmek için betik
# Her gün 05:30'da çalıştırmak için crontab'a şu şekilde ekleyin:
# 30 5 * * * /path/to/this/script/fetch_pharmacies.sh

# Django projesinin olduğu dizine git
cd "$(dirname "$0")/.."

# Log dosyası için bir dizin oluştur (yoksa)
mkdir -p logs

# Günün tarihi
DATE=$(date +"%Y-%m-%d_%H-%M-%S")

# Log dosyası
LOG_FILE="logs/pharmacy_fetch_$DATE.log"

echo "Nöbetçi eczane verileri çekme işlemi başlatılıyor - $DATE" > "$LOG_FILE"

# Python virtual environment'i aktifleştir (varsa)
# source /path/to/venv/bin/activate

# Django komutunu çalıştır
python3 manage.py fetch_duty_pharmacies >> "$LOG_FILE" 2>&1

echo "İşlem tamamlandı - $(date +"%Y-%m-%d_%H-%M-%S")" >> "$LOG_FILE"

# Çıkış kodu kontrolü
if [ $? -eq 0 ]; then
    echo "Nöbetçi eczane verileri başarıyla çekildi. Log dosyası: $LOG_FILE"
else
    echo "Nöbetçi eczane verileri çekilirken bir hata oluştu. Log dosyası: $LOG_FILE"
fi 