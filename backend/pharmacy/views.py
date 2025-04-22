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
from rest_framework.permissions import AllowAny, IsAuthenticated
import logging

from .models import Pharmacy
from .serializers import PharmacySerializer
from .scrapers.ankara import get_duty_pharmacies

# Helper function for scraping and saving (To avoid repetition)
def _fetch_and_save_pharmacies(target_date):
    """Fetches pharmacy data using the scraper and saves to DB."""
    print(f"[{__name__}] Attempting to scrape pharmacies for date: {target_date}")
    try:
        pharmacies_data = get_duty_pharmacies() # Scraper fonksiyonu çağrılıyor
        if pharmacies_data:
            Pharmacy.objects.filter(date=target_date).delete()
            print(f"[{__name__}] Cleared existing pharmacies for {target_date}")
            saved_count = 0
            for pharmacy_data in pharmacies_data:
                scraped_date = datetime.strptime(pharmacy_data['Tarih'], '%Y-%m-%d').date()
                if scraped_date == target_date:
                    pharmacy = Pharmacy(
                        name=pharmacy_data['Eczane Adı'],
                        address=pharmacy_data['Adres'],
                        phone=pharmacy_data['Telefon'],
                        district=pharmacy_data['Bölge'],
                        extra_info=pharmacy_data['Ek Bilgi'],
                        date=scraped_date
                    )
                    pharmacy.save()
                    saved_count += 1
                else:
                     print(f"[{__name__}] Warning: Scraped data date {scraped_date} does not match target date {target_date}. Skipping.")
            print(f"[{__name__}] Saved {saved_count} new pharmacies for {target_date}")
            return True
        else:
            print(f"[{__name__}] Scraper returned no data for {target_date}")
            return False
    except Exception as e:
        print(f"[{__name__}] Error during scraping or saving for {target_date}: {e}")
        return False

# Haversine formülü
def calculate_distance(lat1, lon1, lat2, lon2):
    radius = 6371.0
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = radius * c
    return distance

# --- Yeni View --- 
class CheckAndFetchTodayPharmaciesView(APIView):
    """Checks if today's pharmacy data exists and fetches if not."""
    permission_classes = [AllowAny] # Veya IsAuthenticated, ihtiyaca göre

    def get(self, request):
        today_date = timezone.now().date()
        print(f"[{self.__class__.__name__}] Checking pharmacy data for today: {today_date}")
        
        pharmacies_exist = Pharmacy.objects.filter(date=today_date).exists()
        
        if pharmacies_exist:
            print(f"[{self.__class__.__name__}] Data already exists for {today_date}.")
            return Response({"status": "exists", "message": f"Pharmacy data for {today_date} already exists."}, status=status.HTTP_200_OK)
        else:
            print(f"[{self.__class__.__name__}] Data not found for {today_date}. Triggering fetch.")
            fetch_successful = _fetch_and_save_pharmacies(today_date)
            if fetch_successful:
                 print(f"[{self.__class__.__name__}] Fetch successful for {today_date}.")
                 # Tekrar kontrol et, belki scraper farklı tarihli veri getirdi
                 if Pharmacy.objects.filter(date=today_date).exists():
                     return Response({"status": "fetched", "message": f"Pharmacy data for {today_date} fetched successfully."}, status=status.HTTP_200_OK)
                 else:
                     print(f"[{self.__class__.__name__}] Fetch reported success, but no data found for {today_date} after re-check.")
                     # Bu durum scraper'ın yanlış tarihli veri getirmesi veya kaydetmemesi durumunda olabilir.
                     return Response({"status": "error", "message": f"Scraping might have failed to save data for {today_date} correctly."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                print(f"[{self.__class__.__name__}] Fetch failed for {today_date}.")
                return Response({"status": "failed", "message": f"Failed to fetch pharmacy data for {today_date}."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- DutyPharmacyView (Otomatik fetch kaldırıldı) --- 
class DutyPharmacyView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            date_param = request.GET.get('date')
            # force_refresh artık burada doğrudan fetch tetiklemiyor, sadece bilgi amaçlı olabilir
            # force_refresh = request.GET.get('force_refresh', 'false').lower() == 'true' 

            if date_param:
                try:
                    target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                target_date = timezone.now().date()

            existing_pharmacies = Pharmacy.objects.filter(date=target_date)

            # Sadece veritabanında var mı diye bakıyoruz
            if not existing_pharmacies.exists():
                 print(f"[{self.__class__.__name__}] No data found for {target_date}. Returning 404.")
                 return Response({"error": f"{target_date} için nöbetçi eczane verisi bulunamadı"}, status=status.HTTP_404_NOT_FOUND)

            serializer = PharmacySerializer(existing_pharmacies, many=True)
            return Response(serializer.data)

        except Exception as e:
            print(f"[{self.__class__.__name__}] Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- NearestPharmacyView (Otomatik fetch eklendi) ---
class NearestPharmacyView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            lat = request.GET.get('lat')
            lng = request.GET.get('lng')
            count = int(request.GET.get('count', 5))
            date_param = request.GET.get('date')

            if not lat or not lng:
                return Response({"error": "Latitude (lat) ve longitude (lng) parametreleri gereklidir"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                latitude = float(lat)
                longitude = float(lng)
            except ValueError:
                return Response({"error": "Geçersiz konum değerleri..."}, status=status.HTTP_400_BAD_REQUEST)

            if date_param:
                try:
                    target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                except ValueError:
                    return Response({"error": "Geçersiz tarih formatı..."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                target_date = timezone.now().date()

            pharmacies = Pharmacy.objects.filter(date=target_date)

            # Veritabanında veri yoksa, çekmeyi dene
            if not pharmacies.exists():
                logging.warning(f"[{self.__class__.__name__}] Data not found for {target_date}. Triggering fetch...")
                fetch_successful = _fetch_and_save_pharmacies(target_date) # Scraper'ı çağır

                if fetch_successful:
                    logging.info(f"[{self.__class__.__name__}] Fetch reported success for {target_date}. Re-querying database...")
                    # Fetch sonrası tekrar sorgula
                    pharmacies = Pharmacy.objects.filter(date=target_date)
                else:
                     logging.error(f"[{self.__class__.__name__}] Fetch failed for {target_date}. Returning error.")
                     # Fetch başarısız olduysa hata dön (500)
                     return Response({"error": f"Failed to fetch pharmacy data for {target_date}."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Fetch sonrası veya ilk sorguda hala veri yoksa, 404 dön
            if not pharmacies.exists():
                 logging.warning(f"[{self.__class__.__name__}] Data still not found for {target_date} after fetch attempt. Returning 404.")
                 return Response({"error": f"{target_date} için nöbetçi eczane verisi bulunamadı (fetch denendi)."}, status=status.HTTP_404_NOT_FOUND)

            # --- Veri bulunduysa, geri kalan mesafe hesaplama ve geocoding mantığı ---
            logging.info(f"[{self.__class__.__name__}] Data found for {target_date}. Proceeding with calculation...")
            pharmacies_without_location = []
            pharmacies_with_location = []

            for pharmacy in pharmacies:
                if pharmacy.latitude is not None and pharmacy.longitude is not None:
                    distance = calculate_distance(latitude, longitude, pharmacy.latitude, pharmacy.longitude)
                    pharmacies_with_location.append((pharmacy, distance))
                else:
                    pharmacies_without_location.append(pharmacy)

            # Konumu olmayanları geocode etmeyi dene (limitli sayıda)
            if pharmacies_without_location and len(pharmacies_with_location) < count:
                # Geocoding için HERE API anahtarını settings'den al (veya çevre değişkeninden)
                # here_api_key = getattr(settings, 'HERE_API_KEY', None)
                # if not here_api_key:
                #      logging.error("HERE API Key not configured for geocoding.")
                # else:
                #      logging.info(f"Attempting geocoding for {len(pharmacies_without_location)} pharmacies.")

                for pharmacy in pharmacies_without_location:
                    # Geocoding servisini burada kullanabiliriz. Örnek olarak HERE Geocoding kullanıldı.
                    # Kendi geocoding servisinizi (varsa /api/geocoding/search/) veya başka bir servisi kullanabilirsiniz.
                    # Dikkat: Harici API çağrıları yavaş olabilir ve rate limitlere tabi olabilir.
                    try:
                        query = f"{pharmacy.name}, {pharmacy.address}, {pharmacy.district}, Ankara" # Daha spesifik sorgu
                        # Örnek HERE Geocode API isteği (kendi API anahtarınızı kullanın)
                        # geocode_url = f"https://geocode.search.hereapi.com/v1/geocode?q={requests.utils.quote(query)}&apiKey={here_api_key}&in=countryCode:TUR&at={latitude},{longitude}" # Yakındaki sonuçları önceliklendir
                        # geocode_response = requests.get(geocode_url)
                        # geocode_response.raise_for_status() # HTTP hatalarını kontrol et
                        # geocode_data = geocode_response.json()

                        # VEYA kendi /api/geocoding/search/ endpoint'inizi kullanın:
                        geocoding_url = f"{request.scheme}://{request.get_host()}/api/geocoding/search/"
                        geocode_response = requests.get(
                             geocoding_url,
                             params={"q": query, "limit": 1}
                         )
                        geocode_response.raise_for_status()
                        geocode_data = geocode_response.json()


                        if geocode_data.get('items') and len(geocode_data['items']) > 0:
                            position = geocode_data['items'][0].get('position')
                            if position and 'lat' in position and 'lng' in position:
                                pharmacy.latitude = position['lat']
                                pharmacy.longitude = position['lng']
                                pharmacy.save(update_fields=['latitude', 'longitude', 'updated_at']) # Sadece değişen alanları kaydet
                                distance = calculate_distance(latitude, longitude, pharmacy.latitude, pharmacy.longitude)
                                pharmacies_with_location.append((pharmacy, distance))
                                logging.info(f"Geocoding successful for {pharmacy.name}")
                            else:
                                 logging.warning(f"Geocoding successful but position data missing or incomplete for {pharmacy.name}")
                        else:
                            logging.warning(f"Geocoding returned no items for {pharmacy.name} with query: {query}")
                    except requests.exceptions.RequestException as req_err:
                        logging.error(f"Geocoding request failed for {pharmacy.name}: {req_err}")
                    except Exception as e:
                        logging.error(f"Error during geocoding or saving for {pharmacy.name}: {e}")
                        pass # Bir eczane için hata olursa devam et

            pharmacies_with_location.sort(key=lambda x: x[1])
            nearest_pharmacies = pharmacies_with_location[:count]
            result = []
            for pharmacy, distance in nearest_pharmacies:
                pharmacy_data = PharmacySerializer(pharmacy).data
                pharmacy_data['distance'] = round(distance, 2)
                result.append(pharmacy_data)

            logging.info(f"[{self.__class__.__name__}] Returning {len(result)} nearest pharmacies for date {target_date}")
            return Response(result)

        except Exception as e:
            logging.exception(f"[{self.__class__.__name__}] General error in get method.") # Hatanın traceback'ini logla
            return Response({"error": "An unexpected server error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 