#!/bin/bash

# Celery worker'ı başlatmak için betik
# Bu betiği bir terminal penceresinde çalıştırın

# Django projesinin olduğu dizine git
cd "$(dirname "$0")"

# Environment değişkenlerini ayarla (gerekirse)
# export DJANGO_SETTINGS_MODULE=map_project.settings

# Python virtual environment'i aktifleştir (varsa)
# source /path/to/venv/bin/activate

echo "Celery worker başlatılıyor..."
celery -A map_project worker -l INFO 