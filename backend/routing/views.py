from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
import json
from .models import RoadSegment, UserRoadPreference, RoutePreferenceProfile
from .serializers import RoadSegmentSerializer, UserRoadPreferenceSerializer, RoutePreferenceProfileSerializer

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
