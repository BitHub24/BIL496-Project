import json
import os
import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import BicyclePoint
from .serializers import BicyclePointSerializer

# Logger ayarlaması
logger = logging.getLogger(__name__)

# JSON data dosyası yolu
BICYCLE_DATA_PATH = os.path.join(settings.BASE_DIR, 'bicycle_points', 'data', 'Bicycle.json')

class BicyclePointListView(APIView):
    """Bisiklet istasyonlarını listeleyen API endpoint"""
    
    def get(self, request):
        """Bisiklet istasyonlarını getir"""
        # Veritabanında Bisiklet istasyonları varsa onları döndür
        if BicyclePoint.objects.exists():
            bicycle_points = BicyclePoint.objects.filter(is_active=True)
            serializer = BicyclePointSerializer(bicycle_points, many=True)
            return Response(serializer.data)
        
        # Veritabanında Bisiklet istasyonu yoksa JSON dosyasından oku
        try:
            # JSON dosyasını oku
            with open(BICYCLE_DATA_PATH, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)
            
            # GeoJSON formatını uygun formata dönüştür
            bicycle_points = []
            for feature in geojson_data.get('features', []):
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                
                # Sadece MultiPoint tipindeki bisiklet istasyonlarını al
                if geometry.get('type') == 'MultiPoint':
                    coords = geometry.get('coordinates', [])
                    if coords and len(coords[0]) >= 2:
                        # Koordinatlar [longitude, latitude] formatında geliyor
                        longitude, latitude = coords[0][0], coords[0][1]
                        
                        bicycle_point = {
                            'name': properties.get('name', ''),
                            'global_id': properties.get('global_id', ''),
                            'is_active': True,
                            'latitude': latitude,
                            'longitude': longitude
                        }
                        bicycle_points.append(bicycle_point)
            
            return Response(bicycle_points)
            
        except Exception as e:
            logger.error(f"Bisiklet istasyonu veri okuma hatası: {str(e)}")
            return Response(
                {"error": "Bisiklet istasyonları yüklenirken bir hata oluştu"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Yeni bisiklet istasyonu ekle"""
        serializer = BicyclePointSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BicyclePointDetailView(APIView):
    """Bisiklet istasyonu detay API endpoint"""
    
    def get_object(self, pk):
        """ID ile bisiklet istasyonu getir"""
        try:
            return BicyclePoint.objects.get(pk=pk)
        except BicyclePoint.DoesNotExist:
            return None
    
    def get(self, request, pk):
        """Bisiklet istasyonu detaylarını getir"""
        bicycle_point = self.get_object(pk)
        if bicycle_point is None:
            return Response(
                {"error": "Bisiklet istasyonu bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = BicyclePointSerializer(bicycle_point)
        return Response(serializer.data)
    
    def put(self, request, pk):
        """Bisiklet istasyonu güncelle"""
        bicycle_point = self.get_object(pk)
        if bicycle_point is None:
            return Response(
                {"error": "Bisiklet istasyonu bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = BicyclePointSerializer(bicycle_point, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        """Bisiklet istasyonu sil"""
        bicycle_point = self.get_object(pk)
        if bicycle_point is None:
            return Response(
                {"error": "Bisiklet istasyonu bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
        bicycle_point.delete()
        return Response(status=status.HTTP_204_NO_CONTENT) 