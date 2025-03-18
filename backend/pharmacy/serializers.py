from rest_framework import serializers
from .models import Pharmacy

class PharmacySerializer(serializers.ModelSerializer):
    """Serializer for the Pharmacy model."""
    
    class Meta:
        model = Pharmacy
        fields = ['id', 'name', 'address', 'phone', 'district', 'extra_info', 'date', 'location'] 