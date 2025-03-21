from rest_framework import serializers
from .models import WiFiPoint

class WiFiPointSerializer(serializers.ModelSerializer):
    """WiFi noktası serializer"""
    class Meta:
        model = WiFiPoint
        fields = '__all__'
