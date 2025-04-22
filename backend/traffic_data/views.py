import os
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status # status import'u eklendi
from datetime import datetime
import glob
from django.conf import settings
from .collector import DATA_DIR, collect_traffic_data # Arka plan görevi import edildi
import logging # Loglama için

logger = logging.getLogger(__name__) # Logger

def transform_here_to_geojson(here_data):
    """HERE API flow verisini GeoJSON FeatureCollection'a dönüştürür."""
    features = []
    if not here_data or 'results' not in here_data:
        logger.warning("HERE data is missing 'results' key.")
        return {"type": "FeatureCollection", "features": features}

    for result in here_data.get('results', []):
        try:
            location = result.get('location')
            current_flow = result.get('currentFlow')
            free_flow = result.get('freeFlow')
            shape = location.get('shape')

            if not location or not current_flow or not shape or not shape.get('links'):
                logger.warning(f"Skipping result due to missing data: {result.get('location', {}).get('description')}")
                continue

            # Tüm linklerdeki noktaları birleştir (GeoJSON LngLat formatında)
            coordinates = []
            for link in shape.get('links', []):
                points = link.get('points', [])
                # İlk nokta hariç diğer linklerin ilk noktasını atla (tekrarlamamak için)
                start_index = 1 if len(coordinates) > 0 and len(points) > 0 else 0 
                for point in points[start_index:]:
                    if 'lng' in point and 'lat' in point:
                         coordinates.append([point['lng'], point['lat']]) # Önce Lng, sonra Lat
            
            if not coordinates:
                logger.warning(f"Skipping result with no valid coordinates: {location.get('description')}")
                continue

            # Trafik yoğunluğunu belirle (jamFactor veya hız karşılaştırması)
            severity = 'unknown'
            jam_factor = current_flow.get('jamFactor')
            current_speed = current_flow.get('speed')
            free_flow_speed = free_flow.get('speed') if free_flow else None
            
            if jam_factor is not None: # 0-10 arası varsayılıyor HERE API için
                if jam_factor >= 8.0:
                    severity = 'high'
                elif jam_factor >= 4.0:
                    severity = 'medium'
                else:
                    severity = 'low'
            elif current_speed is not None and free_flow_speed is not None and free_flow_speed > 0:
                ratio = current_speed / free_flow_speed
                if ratio < 0.4: # %40'ın altı
                    severity = 'high'
                elif ratio < 0.7: # %70'in altı
                    severity = 'medium'
                else:
                    severity = 'low'

            # GeoJSON Feature oluştur
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
            logger.error(f"Error processing HERE result: {e}", exc_info=True)
            # Bir sonuçta hata olsa bile devam etmeye çalış
            continue
            
    return {"type": "FeatureCollection", "features": features}

@api_view(['GET'])
def get_latest_traffic_data(request):
    """En son toplanan trafik verilerini GeoJSON formatında getirir."""
    try:
        data_files = glob.glob(os.path.join(DATA_DIR, "traffic_data_*.json"))
        if not data_files:
            logger.info("No traffic data files found. Triggering background collection task.")
            # Arka plan görevini tetikle
            collect_traffic_data()
            # Frontend'e işlemin başladığını bildir
            return Response({"message": "Trafik verisi toplama işlemi başlatıldı. Lütfen birkaç dakika sonra tekrar deneyin."}, 
                            status=status.HTTP_202_ACCEPTED) # 202 Accepted döndür
        
        latest_file = max(data_files, key=os.path.getctime)
        logger.info(f"Reading latest traffic data file: {os.path.basename(latest_file)}")
        
        with open(latest_file, 'r', encoding='utf-8') as f:
            # Ham HERE verisini oku
            raw_traffic_data = json.load(f)
        
        # HERE verisini GeoJSON'a dönüştür
        logger.info("Transforming HERE data to GeoJSON...")
        geojson_data = transform_here_to_geojson(raw_traffic_data)
        logger.info(f"Transformation complete. GeoJSON feature count: {len(geojson_data['features'])}")
        
        filename = os.path.basename(latest_file)
        collection_time_str = filename.replace('traffic_data_', '').replace('.json', '')
        
        response_data = {
            "meta": {
                "collection_time": collection_time_str,
                "file_path": latest_file, # Sadece debug için
                "geojson_feature_count": len(geojson_data['features'])
                # Diğer meta veriler eklenebilir
            },
            # Dönüştürülmüş GeoJSON'u gönder
            "data": geojson_data 
        }
        
        return Response(response_data)
        
    except json.JSONDecodeError as jde:
        # latest_file değişkeni sadece data_files bulunduğunda tanımlanır.
        # Hatanın oluştuğu dosya adını loglamak için kontrol ekleyelim.
        error_file_msg = f" from file {os.path.basename(latest_file)}" if 'latest_file' in locals() else ""
        logger.error(f"Error decoding JSON{error_file_msg}: {jde}")
        error_filename = os.path.basename(latest_file) if 'latest_file' in locals() else "bilinmeyen bir dosya"
        return Response({"error": f"Bozuk trafik veri dosyası bulundu: {error_filename}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.exception("An unexpected error occurred in get_latest_traffic_data")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 