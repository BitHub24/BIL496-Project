from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import requests
from django.conf import settings

class GeocodeView(APIView):
    """
    HERE Geocoding API kullanarak adres/konum araması yapan view
    """
    def get(self, request):
        try:
            # URL parametrelerinden sorgu metnini al
            query = request.query_params.get('q', '')
            
            if not query:
                return Response(
                    {"error": "Arama sorgusu gerekli (q parametresi)"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # HERE Geocoding API'sine istek gönder
            params = {
                'q': query,
                'apiKey': settings.HERE_API_KEY,
                'lang': 'tr'  # Türkçe sonuçlar için
            }
            
            # İsteğe bağlı parametreler
            limit = request.query_params.get('limit')
            if limit:
                params['limit'] = limit
            
            # Belirli bir ülkede arama yapmak için (örneğin sadece Türkiye'de)
            country_code = request.query_params.get('countryCode', 'TUR')  # Varsayılan olarak Türkiye
            if country_code:
                params['in'] = f'countryCode:{country_code}'
                
            response = requests.get(
                settings.HERE_API_BASE_URL,
                params=params
            )
            
            if response.status_code != 200:
                return Response(
                    {"error": "HERE API hatası", "details": response.text},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # HERE API yanıtını doğrudan döndür
            return Response(response.json())
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
