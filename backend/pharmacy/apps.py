from django.apps import AppConfig


class PharmacyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pharmacy'
    verbose_name = 'Nöbetçi Eczaneler'
    
    def ready(self):
        """
        Uygulama hazır olduğunda çalışacak işlemler.
        Celery Beat görevlerini ayarlar.
        """
        # İçe aktarmaları burada yapmak Django başlangıç döngüsünden kaçınmak için önemli
        from .celery_beat_tasks import setup_periodic_tasks
        
        # Görevleri ayarla (Django hazır olduğunda)
        # Not: Bu kod Django yalnızca web sunucusu olarak çalıştığında değil,
        # yönetim komutları çalıştırıldığında da çalışır.
        import sys
        if 'runserver' in sys.argv or 'gunicorn' in sys.argv[0]:
            setup_periodic_tasks() 