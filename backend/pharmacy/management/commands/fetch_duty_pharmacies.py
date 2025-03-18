"""
Management command to fetch duty pharmacy data.
"""
from django.core.management.base import BaseCommand
from datetime import datetime
from pharmacy.scrapers.ankara import get_duty_pharmacies
from pharmacy.models import Pharmacy
import logging

class Command(BaseCommand):
    help = 'Fetch and save duty pharmacy data from the Ankara Chamber of Pharmacists website'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force fetch even if data exists for today',
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Set up logging
        logger = logging.getLogger(__name__)
        
        # Check if we already have data for today
        today = datetime.now().date()
        existing_pharmacies = Pharmacy.objects.filter(date=today)
        
        if existing_pharmacies.exists() and not force:
            self.stdout.write(
                self.style.WARNING(f'Data for today ({today}) already exists. Use --force to override.')
            )
            return
        
        self.stdout.write(self.style.SUCCESS(f'Fetching duty pharmacy data for {today}...'))
        
        # Fetch fresh data
        pharmacies_data = get_duty_pharmacies()
        
        if pharmacies_data:
            # Clear existing data for today
            if existing_pharmacies.exists():
                existing_pharmacies.delete()
                self.stdout.write(self.style.SUCCESS(f'Deleted {len(existing_pharmacies)} existing records.'))
            
            # Save new data
            for pharmacy_data in pharmacies_data:
                pharmacy = Pharmacy(
                    name=pharmacy_data['Eczane Adı'],
                    address=pharmacy_data['Adres'],
                    phone=pharmacy_data['Telefon'],
                    district=pharmacy_data['Bölge'],
                    extra_info=pharmacy_data['Ek Bilgi'],
                    date=datetime.strptime(pharmacy_data['Tarih'], '%Y-%m-%d').date()
                )
                pharmacy.save()
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully fetched and saved {len(pharmacies_data)} duty pharmacies.')
            )
        else:
            self.stdout.write(
                self.style.ERROR('Failed to fetch duty pharmacy data.')
            )