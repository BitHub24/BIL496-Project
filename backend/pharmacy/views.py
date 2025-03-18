from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import datetime, timedelta
import os
from django.conf import settings
from django.http import JsonResponse

from .models import Pharmacy
from .serializers import PharmacySerializer
from .scrapers.ankara import get_duty_pharmacies

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