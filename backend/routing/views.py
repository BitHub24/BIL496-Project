from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
import json
from .models import RoadSegment, UserRoadPreference, RoutePreferenceProfile, UserAreaPreference
from .serializers import RoadSegmentSerializer, UserRoadPreferenceSerializer, RoutePreferenceProfileSerializer, UserAreaPreferenceSerializer
import networkx as nx
from rest_framework.views import APIView
from django.conf import settings
import os
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from django.http import JsonResponse
from django.core.exceptions import ObjectDoesNotExist

class RoadSegmentViewSet(viewsets.ModelViewSet):
    """API endpoint for road segments."""
    queryset = RoadSegment.objects.all()
    serializer_class = RoadSegmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter road segments by name or road type."""
        queryset = RoadSegment.objects.all()
        name = self.request.query_params.get('name', None)
        road_type = self.request.query_params.get('road_type', None)
        
        if name:
            queryset = queryset.filter(name__icontains=name)
        if road_type:
            queryset = queryset.filter(road_type=road_type)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search for road segments by name."""
        query = request.query_params.get('q', '')
        if not query or len(query) < 3:
            return Response(
                {"error": "Search query must be at least 3 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        roads = RoadSegment.objects.filter(name__icontains=query)[:10]
        serializer = self.get_serializer(roads, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def create_from_osm(self, request):
        """Create road segment from OSM data."""
        osm_id = request.data.get('osm_id')
        name = request.data.get('name', '')
        road_type = request.data.get('road_type', '')
        start_node = request.data.get('start_node')
        end_node = request.data.get('end_node')
        coordinates = request.data.get('coordinates', [])
        
        if not osm_id or not start_node or not end_node or not coordinates:
            return Response(
                {"error": "Missing required fields"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Convert coordinates to GeoJSON LineString string
            geometry_geojson_string = None
            if coordinates:
                geometry_geojson = {
                    "type": "LineString",
                    "coordinates": coordinates
                }
                geometry_geojson_string = json.dumps(geometry_geojson)

            # Create or update road segment
            road_segment, created = RoadSegment.objects.update_or_create(
                osm_id=osm_id,
                defaults={
                    'name': name,
                    'road_type': road_type,
                    'start_node': start_node,
                    'end_node': end_node,
                    'geometry': geometry_geojson_string
                }
            )
            
            serializer = self.get_serializer(road_segment)
            return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserRoadPreferenceViewSet(viewsets.ModelViewSet):
    """API endpoint for user road preferences."""
    queryset = UserRoadPreference.objects.all()
    serializer_class = UserRoadPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter preferences by current user."""
        return UserRoadPreference.objects.filter(user=self.request.user.profile)
    
    def create(self, request, *args, **kwargs):
        """Create a new road preference."""
        # Add user to request data
        data = request.data.copy()
        data['user'] = request.user.profile.id
        
        # Check if preference already exists
        road_segment_id = data.get('road_segment')
        existing = UserRoadPreference.objects.filter(
            user=request.user.profile,
            road_segment_id=road_segment_id
        ).first()
        
        if existing:
            # Update existing preference
            serializer = self.get_serializer(existing, data=data)
        else:
            # Create new preference
            serializer = self.get_serializer(data=data)
            
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='preferred')
    def preferred(self, request):
        """Get user's preferred roads."""
        preferences = UserRoadPreference.objects.filter(
            user=request.user.profile,
            preference_type='prefer'
        )
        serializer = self.get_serializer(preferences, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='avoided')
    def avoided(self, request):
        """Get user's avoided roads."""
        preferences = UserRoadPreference.objects.filter(
            user=request.user.profile,
            preference_type='avoid'
        )
        serializer = self.get_serializer(preferences, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Clear all user preferences."""
        with transaction.atomic():
            UserRoadPreference.objects.filter(user=request.user.profile).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoutePreferenceProfileViewSet(viewsets.ModelViewSet):
    """API endpoint for route preference profiles."""
    queryset = RoutePreferenceProfile.objects.all()
    serializer_class = RoutePreferenceProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter profiles by current user."""
        return RoutePreferenceProfile.objects.filter(user=self.request.user.profile)
    
    def create(self, request, *args, **kwargs):
        """Create a new preference profile."""
        # Add user to request data
        data = request.data.copy()
        data['user'] = request.user.profile.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='default')
    def default(self, request):
        """Get user's default profile."""
        profile = RoutePreferenceProfile.objects.filter(
            user=request.user.profile,
            is_default=True
        ).first()
        
        if not profile:
            # Create default profile if none exists
            profile = RoutePreferenceProfile.objects.create(
                user=request.user.profile,
                name="Default Profile",
                is_default=True,
                description="Default routing preferences"
            )
            
        serializer = self.get_serializer(profile)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='set-default')
    def set_default(self, request, pk=None):
        """Set profile as default."""
        profile = self.get_object()
        profile.is_default = True
        profile.save()  # This will trigger the save method to update other profiles
        
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

# Yeni GraphML Arama View'ı
class GraphMLSearchView(APIView):
    """API endpoint for searching roads within a GraphML file."""
    permission_classes = [permissions.AllowAny] # Veya IsAuthenticated, isteğe bağlı

    def get(self, request):
        query = request.query_params.get('q', '')
        if not query or len(query) < 3:
            return Response(
                {"error": "Search query must be at least 3 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )

        graphml_file_path = os.path.join(settings.BASE_DIR, 'data', 'ankara_drive.graphml')

        if not os.path.exists(graphml_file_path):
            return Response(
                {"error": "GraphML file not found."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            G = nx.read_graphml(graphml_file_path)
            results = []
            limit = 10 # Sonuç limiti
            count = 0

            # Kenarları (yolları) kontrol et
            for u, v, data in G.edges(data=True):
                road_name = data.get('name') # Yol isminin 'name' özniteliğinde olduğunu varsayıyoruz
                # Bazen isimler liste olabilir, kontrol edelim
                if isinstance(road_name, list):
                    road_name = road_name[0] if road_name else None
                
                if road_name and query.lower() in road_name.lower():
                    # Basit bir ID oluştur (u, v, key olabilir, şimdilik sadece isim)
                    # Frontend'in RoadSegment interface'ine benzer bir yapı döndür
                    results.append({
                        'id': f"{u}-{v}", # Benzersiz ID için başlangıç-bitiş düğümü kullanabiliriz
                        'osm_id': data.get('osmid'), # Varsa OSM ID
                        'name': road_name,
                        'road_type': data.get('highway'), # Yol tipi 'highway' olabilir
                        'geometry': None # Şimdilik geometri eklemiyoruz
                    })
                    count += 1
                    if count >= limit:
                        break
            
            # Eğer kenarlarda 'name' yoksa düğümleri de kontrol et (daha az olası)
            if not results:
                 for node, data in G.nodes(data=True):
                    node_name = data.get('name')
                    if node_name and query.lower() in node_name.lower():
                         results.append({
                            'id': node,
                            'osm_id': data.get('osmid'),
                            'name': node_name,
                            'road_type': 'node', # Tip olarak 'node' belirleyelim
                            'geometry': None
                        })
                         count += 1
                         if count >= limit:
                            break

            return Response(results)

        except Exception as e:
            # Hata loglama eklenebilir
            return Response(
                {"error": f"Error processing GraphML file: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Yeni Geocoding Arama View'ı
class GeocodingSearchView(APIView):
    """API endpoint for searching locations using Nominatim Geocoding service."""
    permission_classes = [permissions.AllowAny] # Herkesin erişimine açık

    def get(self, request):
        query = request.query_params.get('q', '')
        print(f"[GeocodingSearchView] Received query: {query}") # LOG 1: Gelen sorgu

        if not query or len(query) < 3:
            print("[GeocodingSearchView] Query too short.") # LOG
            return Response(
                {"error": "Search query must be at least 3 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )

        geolocator = Nominatim(user_agent="bil496_project_app")
        try:
            # viewbox'ı doğru formata getir: [(güney_lat, batı_lon), (kuzey_lat, doğu_lon)]
            # ankara_viewbox = [39.6, 32.5, 40.2, 33.2] # Eski hatalı format
            ankara_viewbox = [(39.6, 32.5), (40.2, 33.2)] # YENİ DOĞRU FORMAT
            
            print(f"[GeocodingSearchView] Querying Nominatim for: {query} with viewbox: {ankara_viewbox}") # Log güncellendi
            locations = geolocator.geocode(
                query,
                exactly_one=False,
                limit=5,
                country_codes='TR',
                viewbox=ankara_viewbox, # Doğru formatı kullan
                bounded=1,
                timeout=10
            )
            print(f"[GeocodingSearchView] Nominatim raw response: {locations}")

            results = []
            if locations:
                for loc in locations:
                    bbox = None
                    if loc.raw.get('boundingbox'):
                       bbox_raw = [float(b) for b in loc.raw['boundingbox']]
                       bbox = [bbox_raw[0], bbox_raw[1], bbox_raw[2], bbox_raw[3]]
                       
                    results.append({
                        'id': loc.raw.get('place_id') or loc.raw.get('osm_id'),
                        'name': loc.address,
                        'lat': loc.latitude,
                        'lon': loc.longitude,
                        'bbox': bbox,
                        'osm_id': loc.raw.get('osm_id'),
                        'road_type': loc.raw.get('type') or loc.raw.get('class'),
                        'geometry': None
                    })
            
            print(f"[GeocodingSearchView] Processed results: {results}") # LOG 4: İşlenmiş sonuçlar
            return Response(results)

        except GeocoderTimedOut:
            print("[GeocodingSearchView] Error: Geocoding service timed out") # LOG 5: Hata
            return Response({"error": "Geocoding service timed out"}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except GeocoderServiceError as e:
            print(f"[GeocodingSearchView] Error: Geocoding service error: {str(e)}") # LOG 6: Hata
            return Response({"error": f"Geocoding service error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            print(f"[GeocodingSearchView] Error: An unexpected error occurred: {str(e)}") # LOG 7: Hata
            # Hatanın tam izini görmek için traceback'i de yazdırabiliriz:
            # import traceback
            # print(traceback.format_exc())
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# YENİ: OSM ID ile Geometri Getirme View'ı
class RoadSegmentGeometryView(APIView):
    """API endpoint to retrieve the geometry of a road segment by its OSM ID."""
    permission_classes = [permissions.AllowAny] # Herkes erişebilir

    def get(self, request, osm_id):
        print(f"[RoadSegmentGeometryView] Received request for OSM ID: {osm_id}")
        try:
            # Veritabanından ilgili RoadSegment'ı bul
            road_segment = RoadSegment.objects.get(osm_id=osm_id)
            print(f"[RoadSegmentGeometryView] Found segment: {road_segment.name if road_segment else 'None'}")
            
            # Geometri verisi var mı ve geçerli mi kontrol et
            geometry_data = None
            if road_segment.geometry:
                try:
                    # Geometry alanının JSON string olduğunu varsayıyoruz
                    geometry_data = json.loads(road_segment.geometry)
                    print(f"[RoadSegmentGeometryView] Geometry data loaded: {geometry_data.get('type') if geometry_data else 'Invalid JSON'}")
                except json.JSONDecodeError:
                    print(f"[RoadSegmentGeometryView] Error: Could not decode geometry JSON for OSM ID: {osm_id}")
                    return JsonResponse({'error': 'Invalid geometry data format in database.'}, status=500)

            if geometry_data:
                return JsonResponse(geometry_data) # Direkt GeoJSON nesnesini döndür
            else:
                print(f"[RoadSegmentGeometryView] No geometry data found for OSM ID: {osm_id}")
                return JsonResponse({'error': 'Geometry not found for this road segment.'}, status=404)

        except ObjectDoesNotExist:
            print(f"[RoadSegmentGeometryView] Road segment with OSM ID {osm_id} not found in database.")
            return JsonResponse({'error': 'Road segment not found.'}, status=404)
        except Exception as e:
            print(f"[RoadSegmentGeometryView] Unexpected error: {str(e)}")
            # import traceback
            # print(traceback.format_exc())
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)

# YENİ VIEWSET: Kullanıcı Alan Tercihleri için
class UserAreaPreferenceViewSet(viewsets.ModelViewSet):
    """API endpoint for managing user area preferences (bounding boxes)."""
    serializer_class = UserAreaPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return preferences only for the current authenticated user."""
        if self.request.user.is_authenticated:
            return UserAreaPreference.objects.filter(user=self.request.user)
        return UserAreaPreference.objects.none() # Kullanıcı giriş yapmamışsa boş liste

    def perform_create(self, serializer):
        """Associate the preference with the logged-in user upon creation."""
        serializer.save(user=self.request.user)
        
    # İsteğe bağlı: Alanları temizlemek için özel bir action eklenebilir
    @action(detail=False, methods=['delete'], url_path='clear-all')
    def clear_all_area_preferences(self, request):
        """Clear all area preferences for the current user."""
        if request.user.is_authenticated:
            count, _ = UserAreaPreference.objects.filter(user=request.user).delete()
            return Response({'message': f'{count} area preferences deleted.'}, status=status.HTTP_204_NO_CONTENT)
        return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
