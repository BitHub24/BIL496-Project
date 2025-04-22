import json
from django.core.management.base import BaseCommand
from django.conf import settings
import os
from bicycle_points.models import BicyclePoint
from django.db import IntegrityError

class Command(BaseCommand):
    help = 'Loads Bicycle Station data from JSON file (assuming GeoJSON structure) into the database'

    def handle(self, *args, **options):
        file_path = os.path.join(settings.BASE_DIR, 'data', 'Biycyle.json') # Corrected filename
        self.stdout.write(f"Looking for Bicycle data file at: {file_path}")

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
             self.stderr.write(self.style.ERROR("JSON file does not contain a valid 'features' list."))
             return

        for feature in data['features']:
            properties = feature.get('properties', {})
            geometry = feature.get('geometry', {})

            # Use MultiPoint geometry
            if geometry.get('type') != 'MultiPoint':
                self.stdout.write(self.style.WARNING(f"Skipping non-MultiPoint feature: {properties.get('name')}"))
                skipped_count += 1
                continue

            coordinates = geometry.get('coordinates')
            # Take the first coordinate pair from the MultiPoint array
            if not coordinates or not isinstance(coordinates, list) or len(coordinates) == 0 or len(coordinates[0]) < 2:
                self.stdout.write(self.style.WARNING(f"Skipping feature '{properties.get('name')}' with invalid coordinates."))
                skipped_count += 1
                continue

            # GeoJSON format [longitude, latitude]
            longitude, latitude = coordinates[0][:2] 

            # Get properties (use 'name' and 'global_id' as seen in the file)
            global_id = properties.get('global_id')
            name = properties.get('name')
            # is_active seems not present in Biycyle.json, default to True or handle if needed
            is_active = properties.get('aktif', True) # Default to True if 'aktif' is missing

            if not global_id or not name:
                self.stdout.write(self.style.WARNING("Skipping feature without global_id or name."))
                skipped_count += 1
                continue

            try:
                # Convert coordinates to float
                latitude = float(latitude)
                longitude = float(longitude)
            except (ValueError, TypeError):
                self.stdout.write(self.style.WARNING(f"Skipping feature '{name}' with invalid coordinate format."))
                skipped_count += 1
                continue

            try:
                bicycle_point, created = BicyclePoint.objects.update_or_create(
                    global_id=global_id, # Use global_id as the unique key
                    defaults={
                        'name': name,
                        'latitude': latitude,
                        'longitude': longitude,
                        'is_active': is_active # Use the determined active status
                    }
                )

                if created:
                    added_count += 1
                else:
                    updated_count += 1

            except IntegrityError as ie:
                 self.stderr.write(self.style.ERROR(f"Integrity error for station '{name}' (global_id: {global_id}): {ie}"))
                 skipped_count += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error saving bicycle station '{name}': {e}"))
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully loaded bicycle stations. Added: {added_count}, Updated: {updated_count}, Skipped: {skipped_count}"
        )) 