from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import datetime, timedelta
import os
from django.conf import settings
from django.http import JsonResponse
import math
import requests
from rest_framework.permissions import AllowAny

from .models import Pharmacy
from .serializers import PharmacySerializer
from .scrapers.ankara import get_duty_pharmacies

# Haversine formülü ile iki konum arasındaki mesafeyi hesaplar (km cinsinden)
def calculate_distance(lat1, lon1, lat2, lon2):
    # Dünya'nın yarıçapı km cinsinden
    radius = 6371.0
    
    # Radyan cinsine dönüştürme
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Enlem ve boylam farkları
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    # Haversine formülü
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = radius * c
    
    return distance

class DutyPharmacyView(APIView):
    """API view for getting duty pharmacies."""
    
    def get(self, request):
        """
        Get duty pharmacies for today or a specific date.
        
        Query parameters:
        - date: Optional date in YYYY-MM-DD format
        - force_refresh: If 'true', forces a new scrape
        """
        try:
            # Get date parameter, default to today
            date_param = request.GET.get('date', None)
            force_refresh = request.GET.get('force_refresh', 'false').lower() == 'true'
            
            if date_param:
                try:
                    target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    return Response(
                        {"error": "Invalid date format. Use YYYY-MM-DD"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                target_date = timezone.now().date()
            
            # Check if we already have this data in the database
            existing_pharmacies = Pharmacy.objects.filter(date=target_date)
            
            # If we have data and no force refresh, return it
            if existing_pharmacies.exists() and not force_refresh:
                serializer = PharmacySerializer(existing_pharmacies, many=True)
                return Response(serializer.data)
            
            # Only fetch data for today (can't fetch future or past dates from the website)
            if target_date == timezone.now().date() or force_refresh:
                # Fetch fresh data
                pharmacies_data = get_duty_pharmacies()
                
                if pharmacies_data:
                    # Clear existing data for today
                    Pharmacy.objects.filter(date=target_date).delete()
                    
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
                    
                    # Return the newly saved data
                    updated_pharmacies = Pharmacy.objects.filter(date=target_date)
                    serializer = PharmacySerializer(updated_pharmacies, many=True)
                    return Response(serializer.data)
                else:
                    # If no data could be fetched but we have existing data
                    if existing_pharmacies.exists():
                        serializer = PharmacySerializer(existing_pharmacies, many=True)
                        return Response(serializer.data)
                    else:
                        return Response(
                            {"error": "Nöbetçi eczane verisi bulunamadı"},
                            status=status.HTTP_404_NOT_FOUND
                        )
            
            # If we have existing data but not for the requested date
            return Response(
                {"error": "Bu tarih için nöbetçi eczane verisi bulunamadı"},
                status=status.HTTP_404_NOT_FOUND
            )
                
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NearestPharmacyView(APIView):
    """API view for finding nearest duty pharmacies."""
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Get nearest duty pharmacies to a given location.
        
        Query parameters:
        - lat: Latitude (required)
        - lng: Longitude (required)
        - count: Number of pharmacies to return (default: 5)
        - date: Optional date in YYYY-MM-DD format (default: today)
        """
        try:
            # Get location parameters
            lat = request.GET.get('lat')
            lng = request.GET.get('lng')
            count = int(request.GET.get('count', 5))
            date_param = request.GET.get('date')
            
            # Validate location parameters
            if not lat or not lng:
                return Response(
                    {"error": "Latitude (lat) ve longitude (lng) parametreleri gereklidir"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                latitude = float(lat)
                longitude = float(lng)
            except ValueError:
                return Response(
                    {"error": "Geçersiz konum değerleri. Latitude ve longitude sayısal değerler olmalıdır"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set date
            if date_param:
                try:
                    target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    return Response(
                        {"error": "Geçersiz tarih formatı. YYYY-MM-DD formatında olmalıdır"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                target_date = timezone.now().date()
            
            # Get pharmacies for the target date
            pharmacies = Pharmacy.objects.filter(date=target_date)
            
            if not pharmacies.exists():
                return Response(
                    {"error": f"{target_date} için nöbetçi eczane verisi bulunamadı"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Process pharmacies without location data
            pharmacies_without_location = []
            pharmacies_with_location = []
            
            for pharmacy in pharmacies:
                if pharmacy.latitude is not None and pharmacy.longitude is not None:
                    # Calculate distance
                    distance = calculate_distance(latitude, longitude, pharmacy.latitude, pharmacy.longitude)
                    pharmacies_with_location.append((pharmacy, distance))
                else:
                    pharmacies_without_location.append(pharmacy)
            
            # If there are pharmacies without location data, try to geocode them
            if pharmacies_without_location and len(pharmacies_with_location) < count:
                for pharmacy in pharmacies_without_location:
                    # Geocode address using our own geocoding API
                    try:
                        query = f"{pharmacy.name} {pharmacy.address} {pharmacy.district}"
                        response = requests.get(
                            f"{request.scheme}://{request.get_host()}/api/geocoding/search/",
                            params={"q": query, "limit": 1}
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data.get('items') and len(data['items']) > 0:
                                position = data['items'][0].get('position')
                                if position:
                                    pharmacy.latitude = position['lat']
                                    pharmacy.longitude = position['lng']
                                    pharmacy.save()
                                    
                                    # Calculate distance
                                    distance = calculate_distance(latitude, longitude, pharmacy.latitude, pharmacy.longitude)
                                    pharmacies_with_location.append((pharmacy, distance))
                    except Exception as e:
                        # Hata olursa loglayabiliriz ama şimdilik devam edelim
                        pass
            
            # Sort pharmacies by distance
            pharmacies_with_location.sort(key=lambda x: x[1])
            
            # Limit to requested count
            nearest_pharmacies = pharmacies_with_location[:count]
            
            # Prepare response data
            result = []
            for pharmacy, distance in nearest_pharmacies:
                pharmacy_data = PharmacySerializer(pharmacy).data
                pharmacy_data['distance'] = round(distance, 2)  # km cinsinden mesafe, 2 ondalık haneye yuvarlanmış
                result.append(pharmacy_data)
            
            return Response(result)
                
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 