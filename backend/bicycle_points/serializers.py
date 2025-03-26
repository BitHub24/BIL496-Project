from rest_framework import serializers
from .models import BicyclePoint

class BicyclePointSerializer(serializers.ModelSerializer):
    """Bisiklet istasyonu serializer"""
    class Meta:
        model = BicyclePoint
        fields = '__all__' 