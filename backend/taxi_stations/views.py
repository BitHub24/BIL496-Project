import os
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import TaxiStation
from .serializers import TaxiStationSerializer
from rest_framework import generics

class TaxiStationsView(APIView):
    """
    Taksi istasyonlarını almak için API view.
    
    GET istekleri için taksi istasyonlarını Google Places API'den alıp döndürür.
    """
    
    def get(self, request):
        """
        Verilen konum etrafındaki taksi istasyonlarını döndürür.
        
        Query parametreleri:
        - location: Konum (lat,lng formatında)
        - radius: Arama yarıçapı (metre cinsinden, varsayılan: 5000)
        """
        # API anahtarını ayarlardan al
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            return Response(
                {"error": "Google API anahtarı bulunamadı."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Query parametrelerini al
        location = request.query_params.get('location', '39.92998004533543,32.88643073729896')
        radius = request.query_params.get('radius', '5000')
        
        # İlk istekle taksi duraklarını al
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            'location': location,
            'radius': radius,
            'type': 'taxi_stand',
            'key': api_key
        }
        
        try:
            response = requests.get(url, params=params)
            places_data = response.json()
            
            if places_data.get('status') != 'OK':
                return Response(
                    {"error": f"Google Places API hatası: {places_data.get('status')}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Sonuçları topla ve telefon numaralarını al
            taxi_stations = []
            
            for place in places_data.get('results', []):
                # Temel bilgileri al
                taxi_station = {
                    'name': place.get('name'),
                    'place_id': place.get('place_id'),
                    'location': {
                        'lat': place.get('geometry', {}).get('location', {}).get('lat'),
                        'lng': place.get('geometry', {}).get('location', {}).get('lng')
                    },
                    'rating': place.get('rating'),
                    'phoneNumber': None  # Varsayılan olarak None
                }
                
                # Place details API'yi çağırarak telefon numarasını al
                details_url = "https://maps.googleapis.com/maps/api/place/details/json"
                details_params = {
                    'place_id': place.get('place_id'),
                    'fields': 'name,formatted_phone_number',
                    'key': api_key
                }
                
                details_response = requests.get(details_url, params=details_params)
                details_data = details_response.json()
                
                if details_data.get('status') == 'OK':
                    taxi_station['phoneNumber'] = details_data.get('result', {}).get('formatted_phone_number')
                
                taxi_stations.append(taxi_station)
            
            return Response(taxi_stations, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": f"API hatası: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TaxiStationList(generics.ListCreateAPIView):
    queryset = TaxiStation.objects.all()
    serializer_class = TaxiStationSerializer

class TaxiStationDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = TaxiStation.objects.all()
    serializer_class = TaxiStationSerializer 