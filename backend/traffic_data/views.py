import os
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import datetime
import glob
from django.conf import settings
from .collector import DATA_DIR

@api_view(['GET'])
def get_latest_traffic_data(request):
    """
    En son toplanan trafik verilerini getiren API endpoint'i
    """
    try:
        # Dosya isimlerini al ve en yeni dosyayı bul
        data_files = glob.glob(os.path.join(DATA_DIR, "traffic_data_*.json"))
        
        if not data_files:
            return Response({"error": "Henüz trafik verisi toplanmamış"}, status=404)
        
        # En son oluşturulan dosyayı bul (en yeni zaman damgasına sahip olan)
        latest_file = max(data_files, key=os.path.getctime)
        
        # Dosyayı oku
        with open(latest_file, 'r', encoding='utf-8') as f:
            traffic_data = json.load(f)
        
        # İsteğe bağlı olarak veriyi filtreleyebilir veya işleyebiliriz
        # Örneğin, burada çok büyük veriyi küçültebiliriz
        
        # Dosya adından zaman bilgisini çıkar
        filename = os.path.basename(latest_file)
        collection_time = filename.replace('traffic_data_', '').replace('.json', '')
        
        # Yanıta meta verileri ekle
        response_data = {
            "meta": {
                "collection_time": collection_time,
                "file_size": os.path.getsize(latest_file),
                "items_count": len(traffic_data.get("results", [])),
                "bounds": {
                    "north": 39.9850,
                    "south": 39.7500,
                    "east": 32.9500,
                    "west": 32.6800
                }
            },
            "data": traffic_data
        }
        
        return Response(response_data)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500) 