from rest_framework import serializers
from .models import TaxiStation

class TaxiStationSerializer(serializers.ModelSerializer):
    """TaxiStation modeli için serializer."""
    location = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxiStation
        fields = ['id', 'name', 'latitude', 'longitude', 'address', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
        
    def get_location(self, obj):
        """TaxiStation nesnesinin konum bilgisini frontend'in beklediği formatta döndürür."""
        return {
            'lat': obj.latitude,
            'lng': obj.longitude
        } 