from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, RoutePreference, SavedRoute

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password": "Şifreler eşleşmiyor."})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        
        # Kullanıcı profili ve varsayılan rota tercihleri oluştur
        UserProfile.objects.create(user=user)
        RoutePreference.objects.create(user=user)
        
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ['user', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class RoutePreferenceSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = RoutePreference
        fields = ['id', 'user', 'route_type', 'avoid_highways', 'avoid_tolls', 
                 'avoid_ferries', 'traffic_priority', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class SavedRouteSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = SavedRoute
        fields = ['id', 'user', 'name', 'start_lat', 'start_lon', 'start_name',
                 'end_lat', 'end_lon', 'end_name', 'route_data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at'] 