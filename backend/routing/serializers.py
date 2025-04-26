from rest_framework import serializers
from .models import RoadSegment, UserRoadPreference, RoutePreferenceProfile, UserAreaPreference

class RoadSegmentSerializer(serializers.ModelSerializer):
    """Serializer for RoadSegment model."""
    class Meta:
        model = RoadSegment
        fields = ['id', 'osm_id', 'name', 'road_type', 'start_node', 'end_node', 'geometry']
        read_only_fields = ['id']

class UserRoadPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for UserRoadPreference model."""
    road_name = serializers.CharField(source='road_segment.name', read_only=True)
    
    class Meta:
        model = UserRoadPreference
        fields = ['id', 'user', 'road_segment', 'road_name', 'preference_type', 'reason', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class RoutePreferenceProfileSerializer(serializers.ModelSerializer):
    """Serializer for RoutePreferenceProfile model."""
    class Meta:
        model = RoutePreferenceProfile
        fields = ['id', 'user', 'name', 'is_default', 'description', 'prefer_multiplier', 'avoid_multiplier', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class UserAreaPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for UserAreaPreference model."""
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    preference_type_display = serializers.CharField(source='get_preference_type_display', read_only=True)

    class Meta:
        model = UserAreaPreference
        fields = [
            'id', 
            'user', 
            'preference_type', 
            'preference_type_display',
            'min_lat', 
            'min_lon', 
            'max_lat', 
            'max_lon', 
            'reason', 
            'created_at'
        ]
        read_only_fields = ['created_at']
