import os
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status # status import'u eklendi
from datetime import datetime, timedelta # timedelta eklendi (opsiyonel yaş kontrolü için)
import glob
from django.conf import settings
from .collector import DATA_DIR, collect_traffic_data # Arka plan görevi import edildi
import logging # Loglama için

logger = logging.getLogger(__name__) # Logger

def transform_here_to_geojson(here_data):
    """HERE API flow verisini GeoJSON FeatureCollection'a dönüştürür."""
    features = []
    if not here_data or 'results' not in here_data:
        logger.warning("HERE data is missing 'results' key or is empty.")
        return {"type": "FeatureCollection", "features": features}

    results = here_data.get('results', [])
    if not results:
        logger.warning("HERE data 'results' list is empty.")
        return {"type": "FeatureCollection", "features": features}
        
    for result in results:
        try:
            location = result.get('location')
            current_flow = result.get('currentFlow')
            free_flow = result.get('freeFlow') # freeFlow olmayabilir
            
            if not location or not current_flow:
                 logger.warning(f"Skipping result due to missing location or currentFlow: {result}")
                 continue
                 
            shape = location.get('shape')
            if not shape or not shape.get('links'):
                logger.warning(f"Skipping result due to missing shape links: {location.get('description')}")
                continue

            coordinates = []
            for link in shape.get('links', []):
                points = link.get('points', [])
                start_index = 1 if len(coordinates) > 0 and len(points) > 0 else 0 
                for point in points[start_index:]:
                    if 'lng' in point and 'lat' in point:
                         if -180 <= point['lng'] <= 180 and -90 <= point['lat'] <= 90:
                             coordinates.append([point['lng'], point['lat']]) 
                         else:
                             logger.warning(f"Skipping invalid coordinate point: lng={point.get('lng')}, lat={point.get('lat')}")
            
            if not coordinates:
                logger.warning(f"Skipping result with no valid coordinates after processing: {location.get('description')}")
                continue

            severity = 'unknown'
            jam_factor = current_flow.get('jamFactor')
            current_speed = current_flow.get('speed')
            free_flow_speed = free_flow.get('speed') if free_flow else None
            
            if jam_factor is not None: 
                if jam_factor >= 8.0: severity = 'high'
                elif jam_factor >= 4.0: severity = 'medium'
                else: severity = 'low'
            elif current_speed is not None and free_flow_speed is not None and free_flow_speed > 0:
                ratio = current_speed / free_flow_speed
                if ratio < 0.4: severity = 'high'
                elif ratio < 0.7: severity = 'medium'
                else: severity = 'low'
            elif current_speed is not None and current_speed < 10: 
                 severity = 'high'

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coordinates
                },
                "properties": {
                    "description": location.get('description'),
                    "length": location.get('length'),
                    "jamFactor": jam_factor,
                    "currentSpeed": current_speed,
                    "freeFlowSpeed": free_flow_speed,
                    "severity": severity
                }
            }
            features.append(feature)
        except Exception as e:
            logger.error(f"Error processing HERE result item: {e}", exc_info=True)
            continue
            
    return {"type": "FeatureCollection", "features": features}

# --- Helper function to find the latest valid traffic file ---
def find_latest_traffic_file(data_dir, max_age_minutes=15):
    """Verilen dizindeki belirli bir süreden eski olmayan en son 'traffic_data_*.json' dosyasını bulur."""
    data_files = glob.glob(os.path.join(data_dir, "traffic_data_*.json"))
    if not data_files:
        return None
    latest_file = None
    try:
        potential_latest = max(data_files, key=os.path.getmtime) 
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(potential_latest))
        if datetime.now() - file_mod_time < timedelta(minutes=max_age_minutes):
            latest_file = potential_latest
        else:
             logger.info(f"Latest file {os.path.basename(potential_latest)} is older than {max_age_minutes} minutes.")
    except Exception as e:
        logger.error(f"Error finding/checking latest traffic file: {e}")
    return latest_file

@api_view(['GET'])
def get_latest_traffic_data(request):
    """En son toplanan trafik verilerini GeoJSON formatında getirir.
    Veri yoksa veya eski ise senkron olarak toplamayı tetikler."""
    latest_file = None
    try:
        # --- Mevcut ve yeterince yeni bir dosya var mı kontrol et ---
        latest_file = find_latest_traffic_file(DATA_DIR, max_age_minutes=15) # 15 dakikadan yeni dosya ara

        # --- Eğer uygun dosya yoksa, senkron olarak topla ---
        if not latest_file:
            logger.info("No recent traffic data file found. Triggering synchronous collection.")
            try:
                # Veriyi senkron olarak topla
                collect_traffic_data()
                logger.info("Synchronous data collection finished. Attempting to find the new file.")
                # Dosyayı tekrar ara (yaş kontrolü olmadan)
                data_files = glob.glob(os.path.join(DATA_DIR, "traffic_data_*.json"))
                if not data_files:
                     logger.error("Traffic data file still not found after synchronous collection attempt.")
                     return Response({"error": "Trafik verisi toplanamadı veya kaydedilemedi."},
                                     status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                latest_file = max(data_files, key=os.path.getctime)

            except Exception as collect_error:
                logger.exception("Error during synchronous traffic data collection")
                return Response({"error": f"Trafik verisi toplama sırasında hata oluştu: {collect_error}"},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- Dosyayı işle ---
        if not latest_file or not os.path.exists(latest_file):
             logger.error(f"File {latest_file} cannot be found or accessed.")
             return Response({"error": "Trafik veri dosyası bulunamadı."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info(f"Processing traffic data file: {os.path.basename(latest_file)}")

        try:
            with open(latest_file, 'r', encoding='utf-8') as f:
                raw_traffic_data = json.load(f)
        except json.JSONDecodeError as jde:
            logger.error(f"Error decoding JSON from file {os.path.basename(latest_file)}: {jde}")
            # ÖNEMLİ: Bozuk dosyayı silmeyi deneyebiliriz.
            try:
                os.remove(latest_file)
                logger.warning(f"Deleted corrupted file: {os.path.basename(latest_file)}")
            except OSError as del_err:
                logger.error(f"Could not delete corrupted file {os.path.basename(latest_file)}: {del_err}")
            return Response({"error": f"Bozuk trafik veri dosyası bulundu ve silindi: {os.path.basename(latest_file)}. Lütfen tekrar deneyin."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as read_err:
            logger.exception(f"Error reading file {os.path.basename(latest_file)}")
            return Response({"error": f"Trafik dosyası okunamadı: {os.path.basename(latest_file)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info("Transforming HERE data to GeoJSON...")
        geojson_data = transform_here_to_geojson(raw_traffic_data)
        feature_count = len(geojson_data.get('features', []))
        logger.info(f"Transformation complete. GeoJSON feature count: {feature_count}")

        if feature_count == 0:
             logger.warning(f"GeoJSON transformation resulted in 0 features for file {os.path.basename(latest_file)}.")

        filename = os.path.basename(latest_file)
        try:
            timestamp_str = filename.split('_')[2] + "_" + filename.split('_')[3].split('.')[0]
            collection_time = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
            collection_time_str = collection_time.strftime('%Y-%m-%d %H:%M:%S')
        except (IndexError, ValueError):
             logger.warning(f"Could not parse timestamp from filename: {filename}")
             collection_time_str = "unknown"

        response_data = {
            "meta": {
                "collection_time": collection_time_str,
                "geojson_feature_count": feature_count
            },
            "data": geojson_data
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception("An unexpected error occurred in get_latest_traffic_data")
        return Response({"error": f"Beklenmedik bir sunucu hatası oluştu: {e}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR) 