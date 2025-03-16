from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import requests
from django.conf import settings

# Create your views here.

class DirectionsView(APIView):
    def post(self, request):
        try:
            # Extract coordinates from request
            start = request.data.get('start')
            end = request.data.get('end')
            
            if not start or not end:
                return Response(
                    {"error": "Start and end coordinates are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Format coordinates for OSRM
            coords = f"{start['lng']},{start['lat']};{end['lng']},{end['lat']}"
            
            # Make request to OSRM
            response = requests.get(
                f"{settings.OSRM_SERVER_URL}/route/v1/driving/{coords}",
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "true"
                }
            )
            
            if response.status_code != 200:
                return Response(
                    {"error": "Failed to get directions"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response(response.json())

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
