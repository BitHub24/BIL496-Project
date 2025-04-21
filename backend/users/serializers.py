from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile
import uuid

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('phone_number', 'address')

class UserSerializer(serializers.ModelSerializer):
    user_profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'user_profile')
        read_only_fields = ('id',)
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False}
        }
    
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('user_profile', None)
        
        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update UserProfile fields if provided
        if profile_data and hasattr(instance, 'user_profile'):
            for attr, value in profile_data.items():
                setattr(instance.user_profile, attr, value)
            instance.user_profile.save()
            
        return instance

class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    
    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True}
        }
    
    def validate(self, attrs):
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "Bu e-posta adresi zaten kullanımda."})
        
        return attrs
    
    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name']
        )
        
        user.set_password(validated_data['password'])
        user.save()
        
        return user

class GoogleAuthSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    name = serializers.CharField(required=True)
    sub = serializers.CharField(required=True)
    family_name = serializers.CharField(required=True)
    given_name = serializers.CharField(required=True)
    picture = serializers.URLField(required=True)
    email_verified = serializers.BooleanField(required=True)
    
    class Meta:
        model = User
        fields = ('email', 'name', 'sub', 
                 'family_name', 'given_name', 'picture', 'email_verified')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'username': {'required': False},
            'password': {'required': False},
        }

    def create(self, validated_data):
        try:
            email = validated_data.get('email')
            user = User.objects.filter(email=email).first()  
            if user:
                self._created = False
                return user  # Existing user
                
            full_name = validated_data.get('name', '')
            unique_id = validated_data.get('sub', '')
            username = full_name + unique_id
            username = username.replace(" ", "").lower()
            
            # Create user with safe attribute access
            user = User(
                username=username,
                email=email,
                first_name=validated_data.get('given_name', ''),
                last_name=validated_data.get('family_name', '')
            )
            user.set_unusable_password()
            user.save()

            self._created = True
            return user
            
        except Exception as e:
            # Log the error for debugging
            print(f"Error creating user: {str(e)}")
            raise serializers.ValidationError(f"Failed to create user: {str(e)}")
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        return attrs

class PasswordResetRequestSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    
    def validate_username(self, value):
        if not User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Bu kullanıcı adına sahip bir kullanıcı bulunamadı.")
        return value

class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    
    def validate_token(self, value):
        # Token formatını doğrula
        try:
            uuid_obj = uuid.UUID(value)
            if str(uuid_obj) != value:
                raise serializers.ValidationError("Geçersiz token formatı.")
        except ValueError:
            raise serializers.ValidationError("Geçersiz token formatı.")
        return value
    
    def validate_new_password(self, value):
        # Şifre uzunluğu kontrolü
        if len(value) < 8:
            raise serializers.ValidationError("Şifre en az 8 karakter uzunluğunda olmalıdır.")
        
        # Şifre karmaşıklık kontrolü
        if not any(char.isdigit() for char in value):
            raise serializers.ValidationError("Şifre en az bir sayı içermelidir.")
            
        if not any(char.isupper() for char in value):
            raise serializers.ValidationError("Şifre en az bir büyük harf içermelidir.")
            
        if not any(char.islower() for char in value):
            raise serializers.ValidationError("Şifre en az bir küçük harf içermelidir.")
        
        if not any(char in "!@#$%^&*()_+-=[]{}|;:,.<>?/" for char in value):
            raise serializers.ValidationError("Şifre en az bir özel karakter içermelidir.")
        
        return value
    
    def validate(self, attrs):
        return attrs 