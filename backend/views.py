from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from datetime import datetime
from .routing.service import RoutingService
from .search.geocoder import OSMGeocoder

# Initialize services
router = RoutingService("data/ankara.osm")
geocoder = OSMGeocoder("data/ankara.osm")

@csrf_exempt
@require_http_methods(["GET"])
def search_address(request):
    """Search for addresses and places."""
    try:
        query = request.GET.get('q', '').strip()
        limit = int(request.GET.get('limit', 10))
        
        if not query:
            return JsonResponse({
                'error': 'Query parameter "q" is required'
            }, status=400)
            
        if len(query) < 3:
            return JsonResponse({
                'error': 'Query must be at least 3 characters long'
            }, status=400)
        
        results = geocoder.search(query, limit)
        
        return JsonResponse({
            'results': results
        })
        
    except ValueError as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': 'Internal server error'
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def calculate_route(request):
    try:
        data = json.loads(request.body)
        
        # Extract coordinates
        start_lat = float(data['start_lat'])
        start_lon = float(data['start_lon'])
        end_lat = float(data['end_lat'])
        end_lon = float(data['end_lon'])
        
        # Get current time for traffic calculation
        current_time = datetime.now()
        
        # Calculate route
        route_geometry, time_cost = router.calculate_route(
            start_lat, start_lon,
            end_lat, end_lon,
            current_time
        )
        
        if not route_geometry:
            return JsonResponse({
                'error': 'No route found'
            }, status=404)
        
        # Convert time cost from hours to minutes
        time_minutes = int(time_cost * 60)
        
        # Format response
        response = {
            'route': {
                'geometry': route_geometry,
                'duration': time_minutes,
                'distance': calculate_total_distance(route_geometry)
            },
            'traffic_level': get_traffic_level(current_time)
        }
        
        return JsonResponse(response)
        
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': 'Internal server error'
        }, status=500)

def calculate_total_distance(geometry):
    """Calculate total distance of route in kilometers."""
    total = 0
    for i in range(len(geometry) - 1):
        lat1, lon1 = geometry[i]
        lat2, lon2 = geometry[i + 1]
        total += haversine_distance(lat1, lon1, lat2, lon2)
    return round(total, 2)

def get_traffic_level(current_time):
    """Get descriptive traffic level based on time."""
    hour = current_time.hour
    
    if 7 <= hour < 10:
        return "heavy"  # Morning rush hour
    elif 16 <= hour < 19:
        return "heavy"  # Evening rush hour
    elif 22 <= hour or hour < 5:
        return "light"  # Night time
    else:
        return "moderate"  # Normal daytime traffic 