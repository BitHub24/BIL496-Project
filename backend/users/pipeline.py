from .models import UserProfile
from django.shortcuts import redirect
from rest_framework.authtoken.models import Token
from django.conf import settings
import uuid
import random
import string
from social_core.pipeline.user import get_username as social_get_username
from django.contrib.auth.models import User
from social_core.exceptions import AuthException, AuthAlreadyAssociated

def generate_random_username(length=25):
    """
    Belirtilen uzunlukta tamamen rastgele bir kullanıcı adı oluşturur
    """
    # Harfler ve rakamlardan oluşan bir karakter seti
    characters = string.ascii_letters + string.digits
    # Rastgele bir dizi oluştur
    random_username = ''.join(random.choice(characters) for _ in range(length))
    return random_username

def get_existing_user_by_email(email):
    """
    E-posta adresine göre sistemde kayıtlı kullanıcıyı bulur
    """
    if not email:
        return None
    
    try:
        return User.objects.get(email=email)
    except User.DoesNotExist:
        return None
    except User.MultipleObjectsReturned:
        # Birden fazla kullanıcı varsa ilkini döndür
        return User.objects.filter(email=email).first()

def create_unique_username(strategy, details, backend, user=None, *args, **kwargs):
    """
    Google OAuth2 ile giriş yapan kullanıcılar için 25 karakter uzunluğunda
    benzersiz ve rastgele bir kullanıcı adı oluşturur
    """
    if user:
        return {'username': strategy.storage.user.get_username(user)}
    
    # E-posta adresiyle eşleşen kullanıcı var mı bak
    email = details.get('email')
    if email:
        try:
            existing_user = User.objects.get(email=email)
            # Eğer bu e-posta ile bir kullanıcı varsa, o kullanıcıyı kullan
            return {'username': existing_user.username}
        except User.DoesNotExist:
            pass
        except User.MultipleObjectsReturned:
            # Birden fazla varsa, ilkini kullan
            existing_user = User.objects.filter(email=email).first()
            return {'username': existing_user.username}
    
    # Kullanıcı modeli al
    # 25 karakterlik rastgele ve benzersiz bir kullanıcı adı oluştur
    username = generate_random_username(25)
    
    # Kullanıcı adının var olup olmadığını kontrol et ve benzersiz oluncaya kadar tekrar oluştur
    attempts = 0
    while User.objects.filter(username=username).exists() and attempts < 10:
        username = generate_random_username(25)
        attempts += 1
    
    print(f"Yeni kullanıcı oluşturuluyor, benzersiz rastgele kullanıcı adı: {username}")
    return {'username': username}

def associate_by_email(strategy, details, backend, user=None, *args, **kwargs):
    """
    E-posta adresine göre mevcut kullanıcıyı bul ve ilişkilendir
    Bu işlem, AuthAlreadyAssociated hatasını önlemeye yardımcı olur
    """
    if user:
        return {'user': user}
        
    email = details.get('email')
    if not email:
        return None
    
    # E-posta adresiyle eşleşen kullanıcıları bul
    try:
        existing_user = User.objects.get(email=email)
        return {'user': existing_user}
    except User.DoesNotExist:
        return None
    except User.MultipleObjectsReturned:
        existing_user = User.objects.filter(email=email).first()
        return {'user': existing_user}
    
    return None

def create_user_profile(backend, user, response, *args, **kwargs):
    """
    Kullanıcı profili oluşturur veya günceller
    """
    if backend.name == 'google-oauth2':
        if not hasattr(user, 'user_profile'):
            UserProfile.objects.create(user=user)
            print(f"Kullanıcı profili oluşturuldu: {user.username}")
        
        # Kullanıcının adı ve soyadını Google'dan güncelle (eğer boşsa)
        if not user.first_name and 'given_name' in response:
            user.first_name = response.get('given_name', '')
            user.save(update_fields=['first_name'])
        
        if not user.last_name and 'family_name' in response:
            user.last_name = response.get('family_name', '')
            user.save(update_fields=['last_name'])

def redirect_to_custom_complete(backend, user, response, *args, **kwargs):
    """
    Google OAuth2 ile giriş sonrası doğrudan frontend'e yönlendirir
    """
    try:
        # Token oluştur veya var olanı getir
        token, created = Token.objects.get_or_create(user=user)
        
        # Frontend URL'i oluştur
        if settings.DEBUG:
            frontend_url = 'http://localhost:3000'
        else:
            frontend_url = 'https://frontend-app-1094631205138.us-central1.run.app'
        
        # Token ve API anahtarlarını URL parametreleri olarak ekle
        complete_url = f"{frontend_url}/map?token={token.key}"
        
        # API anahtarları varsa ekle
        if hasattr(settings, 'HERE_API_KEY') and settings.HERE_API_KEY:
            complete_url += f"&here_api_key={settings.HERE_API_KEY}"
            
        if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
            complete_url += f"&google_api_key={settings.GOOGLE_API_KEY}"
        
        # Yeni kullanıcı bilgisini ekle
        user_is_new = kwargs.get('is_new', False)
        complete_url += f"&is_new_user={str(user_is_new).lower()}"
        
        # Kullanıcı e-postasını ekle
        if user.email:
            complete_url += f"&user_email={user.email}"
        
        print(f"Frontend'e yönlendiriliyor: {complete_url}")
        
        # Burada social-auth'un normal akışını kırıyoruz ve doğrudan frontend'e yönlendiriyoruz
        # Bu sayede backend'e hiç uğramadan doğrudan frontend'e gidilecek
        return redirect(complete_url)
    except Exception as e:
        print(f"redirect_to_custom_complete içinde hata: {e}")
        # Hata durumunda yine de frontend'e yönlendir
        return redirect(settings.SOCIAL_AUTH_LOGIN_ERROR_URL) 