import json
import os
import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import WiFiPoint
from .serializers import WiFiPointSerializer

# Logger ayarlaması
logger = logging.getLogger(__name__)

# JSON data dosyası yolu
WIFI_DATA_PATH = os.path.join(settings.BASE_DIR, 'data', 'WifiPoint.json')

class WiFiPointListView(APIView):
    """WiFi noktalarını listeleyen API endpoint"""
    
    def get(self, request):
        """WiFi noktalarını getir"""
        # Veritabanında WiFi noktaları varsa onları döndür
        if WiFiPoint.objects.exists():
            wifi_points = WiFiPoint.objects.filter(is_active=True)
            serializer = WiFiPointSerializer(wifi_points, many=True)
            return Response(serializer.data)
        
        # Veritabanında WiFi noktası yoksa JSON dosyasından oku
        try:
            # JSON dosyasını oku
            with open(WIFI_DATA_PATH, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)
            
            # GeoJSON formatını uygun formata dönüştür
            wifi_points = []
            for feature in geojson_data.get('features', []):
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                
                # Sadece point tipindeki WiFi noktalarını al
                if geometry.get('type') == 'GeometryCollection':
                    for geo in geometry.get('geometries', []):
                        if geo.get('type') == 'Point':
                            coords = geo.get('coordinates', [])
                            if len(coords) >= 2:
                                # Koordinatlar [longitude, latitude] formatında geliyor
                                longitude, latitude = coords[0], coords[1]
                                
                                wifi_point = {
                                    'name': properties.get('adi', ''),
                                    'address': properties.get('adres', ''),
                                    'category': properties.get('kategori', 'Wifi Noktası'),
                                    'is_active': properties.get('aktif', True),
                                    'latitude': latitude,
                                    'longitude': longitude
                                }
                                wifi_points.append(wifi_point)
            
            return Response(wifi_points)
            
        except Exception as e:
            logger.error(f"WiFi veri okuma hatası: {str(e)}")
            return Response(
                {"error": "WiFi noktaları yüklenirken bir hata oluştu"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Yeni WiFi noktası ekle"""
        serializer = WiFiPointSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WiFiPointDetailView(APIView):
    """WiFi noktası detay API endpoint"""
    
    def get_object(self, pk):
        """ID ile WiFi noktası getir"""
        try:
            return WiFiPoint.objects.get(pk=pk)
        except WiFiPoint.DoesNotExist:
            return None
    
    def get(self, request, pk):
        """WiFi noktası detaylarını getir"""
        wifi_point = self.get_object(pk)
        if wifi_point is None:
            return Response(
                {"error": "WiFi noktası bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = WiFiPointSerializer(wifi_point)
        return Response(serializer.data)
    
    def put(self, request, pk):
        """WiFi noktası güncelle"""
        wifi_point = self.get_object(pk)
        if wifi_point is None:
            return Response(
                {"error": "WiFi noktası bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = WiFiPointSerializer(wifi_point, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        """WiFi noktası sil"""
        wifi_point = self.get_object(pk)
        if wifi_point is None:
            return Response(
                {"error": "WiFi noktası bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        wifi_point.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
