# Bu dosya, map_project paketini tanımlar
# Celery uygulamasını burada başlatıyoruz
from __future__ import absolute_import, unicode_literals
from .celery import app as celery_app

__all__ = ('celery_app',)
