from django.core.management.base import BaseCommand, CommandError
import logging
from traffic_data.collector import collect_traffic_data

# Django loglama sistemini kullan
logger = logging.getLogger(__name__) 
# logger = logging.getLogger('traffic_data.management.commands.collect_traffic') # Veya spesifik isim

class Command(BaseCommand):
    help = 'Collects traffic data from HERE API and saves it.'

    def handle(self, *args, **options):
        logger.info("Starting traffic data collection...") # stdout yerine logger kullan
        try:
            success = collect_traffic_data()
            if success:
                logger.info('Successfully collected and saved traffic data.') # stdout yerine logger kullan
                self.stdout.write(self.style.SUCCESS('Successfully collected and saved traffic data.')) # İsteğe bağlı olarak konsola da yaz
            else:
                # Hata mesajı collector içinde loglanıyor olmalı
                logger.error('Traffic data collection reported failure. Check collector logs.')
                raise CommandError('Traffic data collection failed. Check logs for details.')
        except Exception as e:
            logger.exception("An unexpected error occurred during traffic data collection.") # Hata detayını logla
            raise CommandError(f'Traffic data collection failed: {e}') 