from django.shortcuts import render, get_object_or_404
from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer, FavoriteLocationSerializer, UserProfileSerializer
from .models import UserProfile, FavoriteLocation
from django.conf import settings
import uuid
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.contrib.auth.tokens import default_token_generator
from rest_framework.permissions import IsAuthenticated

User = get_user_model()

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
            'here_api_key':settings.HERE_API_KEY,
            'google_api_key':settings.GOOGLE_API_KEY
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

class UserDetailView(generics.RetrieveUpdateAPIView):
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

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PasswordResetRequestSerializer
    
    def post(self, request):
        try:
            serializer = self.serializer_class(data=request.data)
            if not serializer.is_valid():
                return Response({
                    "error": "Geçersiz istek formatı",
                    "details": serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            username = serializer.validated_data['username']
            
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({
                    "error": "Bu kullanıcı adına sahip bir kullanıcı bulunamadı."
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Kullanıcının e-posta adresinin olup olmadığını kontrol et
            if not user.email:
                return Response({
                    "error": "Bu kullanıcının kayıtlı bir e-posta adresi bulunmamaktadır. Lütfen yönetici ile iletişime geçin."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Benzersiz bir token oluştur
            token = str(uuid.uuid4())
            
            # 15 dakika içinde gönderilen istekleri sınırla (rate limiting)
            try:
                profile = user.user_profile
                # Son 15 dakika içinde bir token oluşturulmuş mu kontrol et
                if profile.reset_password_token_created_at and profile.reset_password_token_created_at > timezone.now() - timedelta(minutes=15):
                    return Response({
                        "error": "Çok fazla şifre sıfırlama isteği gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin."
                    }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                
                # Token'ı kullanıcının profilinde sakla
                profile.reset_password_token = token
                profile.reset_password_token_created_at = timezone.now()
                profile.save()
            except Exception as e:
                return Response({
                    "error": "Kullanıcı profili oluşturulurken bir hata oluştu",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Frontend URL'sini oluştur
            reset_url = f"http://localhost:3000/reset-password/{token}"
            
            # E-posta gönderme işlemi - sadece geliştirme için konsola yazdırma
            if settings.DEBUG:
                print(f"\n--------------------\nŞifre sıfırlama URL'si: {reset_url}\nKullanıcı: {username}\n--------------------\n")
                return Response({
                    "message": "Şifre sıfırlama talimatları konsola yazıldı. Token: " + token
                }, status=status.HTTP_200_OK)
            
            # Gerçek bir ortamda e-posta gönderme
            try:
                send_mail(
                    'Şifre Sıfırlama Talebi',
                    f'Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:\n\n{reset_url}\n\nBu bağlantı 24 saat süreyle geçerlidir.',
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
                return Response({
                    "message": "Şifre sıfırlama talimatları e-posta adresinize gönderildi."
                }, status=status.HTTP_200_OK)
            except Exception as e:
                # E-posta hatası durumunda sadece DEBUG=True iken token'ı göster
                if settings.DEBUG:
                    return Response({
                        "message": "E-posta gönderiminde bir hata oluştu. Lütfen sisteminizin SMTP ayarlarını kontrol edin.",
                        "error": str(e),
                        "token": token  # Sadece geliştirme amaçlı
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                else:
                    # Üretim ortamında detaylı hata bilgisini gizle
                    return Response({
                        "error": "E-posta gönderiminde bir hata oluştu. Lütfen daha sonra tekrar deneyin."
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            # Genel hata yakalama
            if settings.DEBUG:
                return Response({
                    "error": "Bir hata oluştu",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({
                    "error": "İşlem sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin."
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PasswordResetConfirmSerializer
    
    def post(self, request):
        try:
            serializer = self.serializer_class(data=request.data)
            if not serializer.is_valid():
                return Response({
                    "error": "Geçersiz istek formatı",
                    "details": serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']
            
            # Token formatını kontrol et (UUID formatı)
            try:
                uuid_obj = uuid.UUID(token)
                if str(uuid_obj) != token:
                    return Response({
                        "error": "Geçersiz token formatı."
                    }, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({
                    "error": "Geçersiz token formatı."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Token ile kullanıcıyı bul
            try:
                profile = UserProfile.objects.get(reset_password_token=token)
                user = profile.user
                
                # Token'ın süresi dolmuş mu kontrol et (24 saat)
                if not profile.reset_password_token_created_at:
                    return Response({
                        "error": "Geçersiz token. Lütfen yeni bir şifre sıfırlama isteği oluşturun."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if profile.reset_password_token_created_at < timezone.now() - timedelta(hours=24):
                    # Süresi dolmuş token'ı temizle
                    profile.reset_password_token = None
                    profile.reset_password_token_created_at = None
                    profile.save()
                    
                    return Response({
                        "error": "Şifre sıfırlama bağlantısının süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği oluşturun."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Şifre güvenlik kontrolü - özel karakterler, büyük-küçük harf ve sayı içermeli
                if len(new_password) < 8:
                    return Response({
                        "error": "Şifre en az 8 karakter uzunluğunda olmalıdır."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Yeni şifreyi ayarla ve token'ı temizle
                user.set_password(new_password)
                user.save()
                
                # Token'ı temizle
                profile.reset_password_token = None
                profile.reset_password_token_created_at = None
                profile.save()
                
                return Response({
                    "message": "Şifreniz başarıyla güncellendi."
                }, status=status.HTTP_200_OK)
                
            except UserProfile.DoesNotExist:
                return Response({
                    "error": "Geçersiz token. Lütfen yeni bir şifre sıfırlama isteği oluşturun."
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            # Genel hata yakalama
            if settings.DEBUG:
                return Response({
                    "error": "Bir hata oluştu",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({
                    "error": "İşlem sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin."
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PasswordResetVerifyTokenView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, token):
        try:
            # Token formatını kontrol et
            try:
                uuid_obj = uuid.UUID(token)
                if str(uuid_obj) != token:
                    return Response({"valid": False, "error": "Geçersiz token formatı."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({"valid": False, "error": "Geçersiz token formatı."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Token ile kullanıcıyı bul ve süresini kontrol et
            try:
                profile = UserProfile.objects.get(reset_password_token=token)
                if profile.reset_password_token_created_at and profile.reset_password_token_created_at >= timezone.now() - timedelta(hours=24):
                    # Token geçerli ve süresi dolmamış
                    return Response({"valid": True}, status=status.HTTP_200_OK)
                else:
                    # Token süresi dolmuş
                    return Response({"valid": False, "error": "Token süresi dolmuş."}, status=status.HTTP_400_BAD_REQUEST)
            except UserProfile.DoesNotExist:
                # Token bulunamadı
                return Response({"valid": False, "error": "Geçersiz token."}, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            if settings.DEBUG:
                return Response({
                    "valid": False, 
                    "error": "Token doğrulaması sırasında bir hata oluştu.",
                    "details": str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({
                    "valid": False, 
                    "error": "Token doğrulaması sırasında bir hata oluştu."
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserProfileView(generics.RetrieveUpdateAPIView):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # İsteği yapan kullanıcının profilini döndür
        return get_object_or_404(UserProfile, user=self.request.user)

# Yeni: FavoriteLocation için ViewSet
class FavoriteLocationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users' favorite locations to be viewed, created, or deleted.
    """
    serializer_class = FavoriteLocationSerializer
    permission_classes = [IsAuthenticated] # Sadece giriş yapmış kullanıcılar erişebilir

    def get_queryset(self):
        """
        This view should return a list of all the favorite locations
        for the currently authenticated user.
        """
        user = self.request.user
        return FavoriteLocation.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Save the favorite location instance, associating it with the current user.
        """
        serializer.save(user=self.request.user)
