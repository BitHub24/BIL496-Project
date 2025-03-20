from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from django.conf import settings

# Django settings modülünü varsayılan olarak ayarla
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'map_project.settings')

app = Celery('map_project')

# Django settings'ten yapılandırma bilgisini yükle
app.config_from_object('django.conf:settings', namespace='CELERY')

# Tüm uygulamalardaki görevleri otomatik olarak yükle
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}') 