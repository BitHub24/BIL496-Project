from django.shortcuts import render
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer
from .models import UserProfile
from django.conf import settings

# Create your views here.

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]  # Herkesin erişebilmesi için
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Token oluşturma
        token, created = Token.objects.get_or_create(user=user)
        
        # UserSerializer ile kullanıcı bilgilerini dönme
        user_serializer = UserSerializer(user)
        
        return Response({
            'user': user_serializer.data,
            'token': token.key
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]  # Herkesin erişebilmesi için
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        
        if not user:
            return Response({
                'error': 'Geçersiz kullanıcı adı veya parola'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Token oluşturma veya var olanı getirme
        token, created = Token.objects.get_or_create(user=user)
        
        # UserSerializer ile kullanıcı bilgilerini dönme
        user_serializer = UserSerializer(user)
        
        return Response({
            'user': user_serializer.data,
            'token': token.key,
            'api_key':settings.HERE_API_KEY
        })

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            # Token silme
            request.user.auth_token.delete()
            return Response({"message": "Başarıyla çıkış yapıldı."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user

class UserUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
