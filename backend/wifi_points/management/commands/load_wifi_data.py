import json
from django.core.management.base import BaseCommand
from django.conf import settings
import os
from wifi_points.models import WiFiPoint
from django.contrib.gis.geos import Point

class Command(BaseCommand):
    help = 'Loads WiFi points data from GeoJSON file into the database'

    def handle(self, *args, **options):
        file_path = os.path.join(settings.BASE_DIR, 'data', 'WifiPoint.json')
        self.stdout.write(f"Looking for WiFi data file at: {file_path}")

        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError:
            self.stderr.write(self.style.ERROR(f"Error decoding JSON from file: {file_path}"))
            return
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error reading file {file_path}: {e}"))
            return

        added_count = 0
        updated_count = 0
        skipped_count = 0

        if 'features' not in data or not isinstance(data['features'], list):
             self.stderr.write(self.style.ERROR("GeoJSON file does not contain a valid 'features' list."))
             return

        for feature in data['features']:
            properties = feature.get('properties', {})
            geometry = feature.get('geometry', {})
            point_coords = None

            # Handle both Point and GeometryCollection containing a Point
            if geometry.get('type') == 'Point':
                coordinates = geometry.get('coordinates')
                if coordinates and len(coordinates) >= 2:
                    point_coords = coordinates[:2]
            elif geometry.get('type') == 'GeometryCollection':
                geometries = geometry.get('geometries', [])
                for geom in geometries:
                    if geom.get('type') == 'Point':
                        coordinates = geom.get('coordinates')
                        if coordinates and len(coordinates) >= 2:
                            point_coords = coordinates[:2]
                            break # İlk Point geometrisini al ve çık
            
            if point_coords is None:
                self.stdout.write(self.style.WARNING(f"Skipping feature '{properties.get('adi')}' - No suitable Point geometry found."))
                skipped_count += 1
                continue

            longitude, latitude = point_coords # GeoJSON formatı [longitude, latitude]

            # Verileri al (özellik adları dosyadakiyle eşleşmeli)
            # Tahmini özellik adları: adi, adres
            name = properties.get('adi') or properties.get('name')
            address = properties.get('adres') or properties.get('address', '') # Adres yoksa boş bırak

            if not name:
                self.stdout.write(self.style.WARNING("Skipping feature without a name."))
                skipped_count += 1
                continue

            try:
                wifi_point, created = WiFiPoint.objects.update_or_create(
                    # Benzersiz bir alan bulmak zor, isim ve koordinat kombinasyonu deneyelim?
                    # Veya sadece koordinatlara göre arayalım? Şimdilik isme göre yapalım.
                    name=name,
                    defaults={
                        'address': address,
                        'latitude': latitude,
                        'longitude': longitude,
                        'is_active': properties.get('is_active', True), # Varsayılan olarak aktif
                        'category': properties.get('category', 'Wifi Noktası')
                    }
                )

                if created:
                    added_count += 1
                else:
                    updated_count += 1

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error saving WiFi point '{name}': {e}"))
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully loaded WiFi points. Added: {added_count}, Updated: {updated_count}, Skipped: {skipped_count}"
        )) 