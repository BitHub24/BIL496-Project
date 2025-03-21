from django.apps import AppConfig


class PharmacyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pharmacy'
    verbose_name = 'Nöbetçi Eczaneler'
    
    def ready(self):
        """
        Uygulama hazır olduğunda çalışacak işlemler.
        """
        # Artık crontab kullanıldığı için Celery Beat ayarlarına gerek yok
        pass 