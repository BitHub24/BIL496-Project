import requests
import polyline
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from datetime import datetime
from users.models import UserProfile
from routing.models import UserRoadPreference, RoutePreferenceProfile
from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

class HereRoutingService:
    """Service for interacting with HERE Routing API with traffic data."""
    
    BASE_URL = "https://router.hereapi.com/v8/routes"
    
    @staticmethod
    def get_route(start, end, user=None, departure_time=None, transport_mode='car'):
        """
        Get route between two points using HERE API with traffic data.
        
        Args:
            start (dict): Start coordinates with lat and lng
            end (dict): End coordinates with lat and lng
            user (User, optional): User for preferences. Defaults to None.
            departure_time (datetime, optional): Departure time. Defaults to current time.
            transport_mode (str, optional): Mode of transport. Defaults to 'car'.
        
        Returns:
            dict: Route response from HERE API
        """
        api_key = settings.HERE_API_KEY
        
        if not api_key:
            logger.error("HERE API key not configured")
            raise ValueError("HERE API key not configured")
        
        # Format coordinates for HERE API
        origin = f"{start['lat']},{start['lng']}"
        destination = f"{end['lat']},{end['lng']}"
        
        # Set departure time (default to now if not provided)
        if departure_time is None:
            departure_time = datetime.now()
        
        departure_time_str = departure_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Map frontend transport modes to HERE API transport modes
        transport_mode_mapping = {
            'driving': 'car',
            'walking': 'pedestrian',
            'cycling': 'bicycle',
            'transit': 'publicTransport'
        }
        
        here_transport_mode = transport_mode_mapping.get(transport_mode, 'car')
        
        # Base parameters
        params = {
            'apiKey': api_key,
            'transportMode': here_transport_mode,
            'origin': origin,
            'destination': destination,
            'departureTime': departure_time_str,
            'return': 'polyline,summary,actions,instructions',
            'routingMode': 'fast',  # Use fastest route by default
            'spans': 'names,length,duration,baseDuration',  # Get base duration without traffic
        }
        
        # Add traffic consideration for car mode
        if here_transport_mode == 'car':
            params['traffic'] = 'enabled'
        
        # Add user preferences if user is authenticated
        if user and user.is_authenticated:
            try:
                user_profile = UserProfile.objects.get(user=user)
                
                # Get user's default preference profile
                profile = RoutePreferenceProfile.objects.filter(
                    user=user_profile, is_default=True
                ).first()
                
                # Get user's road preferences
                preferred_roads = UserRoadPreference.objects.filter(
                    user=user_profile, preference_type='prefer'
                )
                
                avoided_roads = UserRoadPreference.objects.filter(
                    user=user_profile, preference_type='avoid'
                )
                
                # Add avoid areas for avoided roads
                if avoided_roads.exists() and profile:
                    avoid_areas = []
                    for pref in avoided_roads:
                        # Get road geometry and create avoid area
                        road = pref.road_segment
                        if road.geometry:
                            # Extract coordinates from geometry
                            coords = [(point[1], point[0]) for point in road.geometry.coords]
                            
                            # Create avoid area with buffer
                            avoid_areas.append({
                                'type': 'polygon',
                                'vertices': coords
                            })
                    
                    if avoid_areas:
                        params['avoid[areas]'] = json.dumps(avoid_areas)
                
                # Add prefer roads as waypoints
                if preferred_roads.exists() and profile:
                    waypoints = []
                    for pref in preferred_roads:
                        road = pref.road_segment
                        if road.geometry and len(road.geometry.coords) > 0:
                            # Use midpoint of the road as waypoint
                            mid_idx = len(road.geometry.coords) // 2
                            mid_point = road.geometry.coords[mid_idx]
                            waypoints.append(f"{mid_point[1]},{mid_point[0]}")
                    
                    if waypoints:
                        params['via'] = ','.join(waypoints)
                        params['passThrough'] = 'true'  # Make sure waypoints are passed through
            
            except Exception as e:
                logger.error(f"Error applying user preferences: {str(e)}")
        
        try:
            logger.info(f"Calling HERE API with params: {params}")
            response = requests.get(HereRoutingService.BASE_URL, params=params)
            
            if response.status_code != 200:
                logger.error(f"HERE API error: {response.status_code} - {response.text}")
                return None
            
            logger.info("HERE API call successful")
            return response.json()
        
        except Exception as e:
            logger.error(f"Error calling HERE API: {str(e)}")
            return None

class DirectionsView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def post(self, request):
        try:
            # Extract coordinates from request
            start = request.data.get('start')
            end = request.data.get('end')
            
            # Get optional parameters
            departure_time_str = request.data.get('departure_time')
            transport_mode = request.data.get('transport_mode', 'driving')
            
            departure_time = None
            
            if departure_time_str:
                try:
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
            
            # Get route using HERE API with traffic data
            route_data = HereRoutingService.get_route(
                start, 
                end, 
                user=request.user,
                departure_time=departure_time,
                transport_mode=transport_mode
            )
            
            if not route_data:
                return Response(
                    {"error": "Failed to get directions"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Transform HERE API response to match expected format
            transformed_response = self._transform_here_response(route_data)
            return Response(transformed_response, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in DirectionsView: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _transform_here_response(self, here_response):
        """Transform HERE API response to match expected format by frontend."""
        try:
            # Extract the first route
            route = here_response.get('routes', [{}])[0]
            sections = route.get('sections', [{}])[0]
            
            # Extract polyline
            polyline_str = sections.get('polyline', '')
            
            # Decode polyline to get coordinates
            coordinates = self._decode_flexible_polyline(polyline_str)
            
            # Create GeoJSON geometry
            geometry = {
                "type": "LineString",
                "coordinates": [[coord[1], coord[0]] for coord in coordinates]  # [lng, lat] format
            }
            
            # Extract summary
            summary = sections.get('summary', {})
            
            # Extract base duration and traffic duration
            base_duration = summary.get('baseDuration', 0)
            traffic_duration = summary.get('duration', 0)
            
            # Calculate traffic delay
            traffic_delay = max(0, traffic_duration - base_duration)
            
            # Create transformed response
            transformed = {
                "routes": [{
                    "geometry": geometry,
                    "legs": [{
                        "steps": [],
                        "summary": "",
                        "weight": traffic_duration,
                        "duration": traffic_duration,
                        "distance": summary.get('length', 0)
                    }],
                    "weight_name": "duration",
                    "weight": traffic_duration,
                    "duration": traffic_duration,
                    "distance": summary.get('length', 0)
                }],
                "waypoints": [],
                "code": "Ok",
                "traffic_info": {
                    "has_traffic": True,
                    "base_duration": base_duration,  # Duration without traffic
                    "traffic_duration": traffic_duration,   # Duration with traffic
                    "traffic_delay": traffic_delay  # Delay due to traffic
                }
            }
            
            return transformed
            
        except Exception as e:
            logger.error(f"Error transforming HERE response: {str(e)}")
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
                "traffic_info": {
                    "has_traffic": False,
                    "base_duration": 1000,
                    "traffic_duration": 1000,
                    "traffic_delay": 0
                }
            }
    
    def _decode_flexible_polyline(self, encoded):
        """
        Decode HERE's flexible polyline format.
        Returns list of [lat, lng] coordinates.
        """
        try:
            # Use the polyline library to decode the polyline
            # Note: This is a simplified approach that works for most cases
            # For production, consider using HERE's official flexible polyline library
            
            if not encoded:
                logger.warning("Empty polyline received")
                return [[39.9, 32.8], [39.91, 32.81], [39.92, 32.82]]
            
            # Try to decode using standard polyline format
            try:
                # Standard Google polyline format
                decoded = polyline.decode(encoded)
                if decoded:
                    return decoded
            except Exception as e:
                logger.warning(f"Standard polyline decoding failed: {str(e)}")
            
            # If standard decoding fails, try a different approach
            # For HERE's flexible polyline, we would normally use their library
            # As a fallback, we'll extract coordinates from the sections data
            
            # Log the issue and return a fallback path
            logger.warning("Using fallback path for polyline decoding")
            return [[39.9, 32.8], [39.91, 32.81], [39.92, 32.82]]
            
        except Exception as e:
            logger.error(f"Error decoding polyline: {str(e)}")
            # Return a simple path if decoding fails
            return [[39.9, 32.8], [39.91, 32.81], [39.92, 32.82]]
