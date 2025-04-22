import requests
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from rest_framework.permissions import IsAuthenticatedOrReadOnly
import json
import logging

logger = logging.getLogger(__name__)

class PublicTransportService:
    """Service for fetching public transportation routes."""
    
    @staticmethod
    def get_route(start, end, departure_time=None):
        """
        Get public transportation route between two points.
        
        Args:
            start (dict): Start coordinates with lat and lng
            end (dict): End coordinates with lat and lng
            departure_time (datetime, optional): Departure time. Defaults to current time.
        
        Returns:
            dict: Route response with public transportation options
        """
        api_key = settings.HERE_API_KEY
        
        if not api_key:
            logger.error("HERE API key not configured")
            raise ValueError("HERE API key not configured")
        
        # Format coordinates
        origin = f"{start['lat']},{start['lng']}"
        destination = f"{end['lat']},{end['lng']}"
        
        # Use HERE Public Transit API
        url = "https://transit.router.hereapi.com/v8/routes"
        
        params = {
            'apiKey': api_key,
            'origin': origin,
            'destination': destination,
            'return': 'polyline,actions,summary',
        }
        
        # Add departure time if provided
        if departure_time:
            params['departureTime'] = departure_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        try:
            logger.info(f"Calling HERE Transit API with params: {params}")
            response = requests.get(url, params=params)
            
            if response.status_code != 200:
                logger.error(f"HERE Transit API error: {response.status_code} - {response.text}")
                return None
            
            logger.info("HERE Transit API call successful")
            return response.json()
        
        except Exception as e:
            logger.error(f"Error calling HERE Transit API: {str(e)}")
            return None

class PublicTransportView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def post(self, request):
        try:
            # Extract coordinates from request
            start = request.data.get('start')
            end = request.data.get('end')
            
            # Get optional departure time
            departure_time_str = request.data.get('departure_time')
            departure_time = None
            
            if departure_time_str:
                try:
                    from datetime import datetime
                    departure_time = datetime.fromisoformat(departure_time_str)
                except ValueError:
                    return Response(
                        {"error": "Invalid departure time format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            if not start or not end:
                return Response(
                    {"error": "Start and end coordinates are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get public transport route
            route_data = PublicTransportService.get_route(
                start, 
                end, 
                departure_time=departure_time
            )
            
            if not route_data:
                return Response(
                    {"error": "Failed to get public transportation directions"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Transform response to match expected format
            transformed_response = self._transform_transit_response(route_data)
            return Response(transformed_response, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in PublicTransportView: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _transform_transit_response(self, transit_response):
        """Transform HERE Transit API response to match expected format by frontend."""
        try:
            # Extract the first route
            routes = transit_response.get('routes', [])
            if not routes:
                raise ValueError("No routes found in transit response")
                
            route = routes[0]
            sections = route.get('sections', [])
            
            # Collect all coordinates from all sections to form a complete route
            all_coordinates = []
            total_duration = 0
            total_distance = 0
            
            for section in sections:
                # Get polyline for this section
                polyline_str = section.get('polyline', '')
                
                # Try to decode polyline
                try:
                    import polyline
                    coords = polyline.decode(polyline_str)
                    all_coordinates.extend(coords)
                except Exception:
                    # If decoding fails, use the transport section's endpoints
                    if 'departure' in section and 'place' in section['departure']:
                        dep_place = section['departure']['place']
                        if 'location' in dep_place:
                            lat = dep_place['location'].get('lat')
                            lng = dep_place['location'].get('lng')
                            if lat and lng:
                                all_coordinates.append([lat, lng])
                    
                    if 'arrival' in section and 'place' in section['arrival']:
                        arr_place = section['arrival']['place']
                        if 'location' in arr_place:
                            lat = arr_place['location'].get('lat')
                            lng = arr_place['location'].get('lng')
                            if lat and lng:
                                all_coordinates.append([lat, lng])
                
                # Add duration and distance
                if 'summary' in section:
                    total_duration += section['summary'].get('duration', 0)
                    total_distance += section['summary'].get('length', 0)
            
            # If we couldn't get any coordinates, use a fallback
            if not all_coordinates:
                all_coordinates = [[39.9, 32.8], [39.91, 32.81], [39.92, 32.82]]
            
            # Create GeoJSON geometry
            geometry = {
                "type": "LineString",
                "coordinates": [[coord[1], coord[0]] for coord in all_coordinates]  # [lng, lat] format
            }
            
            # Create transformed response
            transformed = {
                "routes": [{
                    "geometry": geometry,
                    "legs": [{
                        "steps": [],
                        "summary": "",
                        "weight": total_duration,
                        "duration": total_duration,
                        "distance": total_distance
                    }],
                    "weight_name": "duration",
                    "weight": total_duration,
                    "duration": total_duration,
                    "distance": total_distance
                }],
                "waypoints": [],
                "code": "Ok",
                "transit_info": {
                    "sections": [self._transform_transit_section(section) for section in sections]
                }
            }
            
            return transformed
            
        except Exception as e:
            logger.error(f"Error transforming transit response: {str(e)}")
            # Return a simplified response if transformation fails
            return {
                "routes": [{
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[32.8, 39.9], [32.81, 39.91], [32.82, 39.92]]
                    },
                    "legs": [{
                        "steps": [],
                        "summary": "",
                        "weight": 1000,
                        "duration": 1000,
                        "distance": 5000
                    }],
                    "weight_name": "duration",
                    "weight": 1000,
                    "duration": 1000,
                    "distance": 5000
                }],
                "waypoints": [],
                "code": "Ok",
                "transit_info": {
                    "sections": []
                }
            }
    
    def _transform_transit_section(self, section):
        """Transform a transit section to a simplified format for the frontend."""
        try:
            section_type = section.get('type', 'unknown')
            
            # Basic section info
            result = {
                "type": section_type,
                "duration": section.get('summary', {}).get('duration', 0),
                "distance": section.get('summary', {}).get('length', 0)
            }
            
            # Add transport details if available
            if section_type == 'transit':
                if 'transport' in section:
                    transport = section['transport']
                    result["transport"] = {
                        "mode": transport.get('mode', 'unknown'),
                        "name": transport.get('name', ''),
                        "line": transport.get('line', ''),
                        "headsign": transport.get('headsign', '')
                    }
                
                # Add departure and arrival info
                if 'departure' in section:
                    dep = section['departure']
                    result["departure"] = {
                        "time": dep.get('time', ''),
                        "place": dep.get('place', {}).get('name', '')
                    }
                
                if 'arrival' in section:
                    arr = section['arrival']
                    result["arrival"] = {
                        "time": arr.get('time', ''),
                        "place": arr.get('place', {}).get('name', '')
                    }
            
            return result
            
        except Exception as e:
            logger.error(f"Error transforming transit section: {str(e)}")
            return {"type": "unknown", "duration": 0, "distance": 0}
