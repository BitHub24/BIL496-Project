"""
Django Social Auth için tamamen yeniden yazılmış pipeline.
Her Google girişinde kesinlikle yeni bir kullanıcı oluşturacak şekilde tasarlanmıştır.
"""

from django.shortcuts import redirect
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.conf import settings
from social_core.exceptions import AuthException
from .models import UserProfile
import uuid
import string
import random
import logging

# Logging yapılandırması
logger = logging.getLogger(__name__)

def social_details(strategy, details, backend, *args, **kwargs):
    """
    Sosyal giriş bilgilerini alır.
    Varsayılan social_details fonksiyonunun davranışı değiştirilmez.
    """
    # DjangoStrategy'de PARTIAL_PIPELINE_DATA yok, doğrudan details döndür
    return {'details': details}

def social_uid(backend, details, response, *args, **kwargs):
    """
    Kullanıcının sosyal platformdaki UID'sini alır.
    """
    # Normal akışı devam ettirir
    return {'uid': backend.get_user_id(details, response)}

def force_new_user(uid, *args, **kwargs):
    """
    Her seferinde yeni kullanıcı oluşturulmasını zorlar.
    Bu adım, mevcut kullanıcı kontrollerini atlar.
    """
    # Burada hiçbir eşleştirme yapma, doğrudan None döndür
    # Bu sayede her zaman yeni bir kullanıcı oluşturulacak
    logger.info(f"Yeni kullanıcı oluşturma zorlanıyor. UID: {uid}")
    return {'social_user': None, 'user': None, 'new_association': True}

def generate_username(strategy, details, user=None, *args, **kwargs):
    """
    Tamamen yeni ve benzersiz bir kullanıcı adı oluşturur.
    Her seferinde farklı ve random bir kullanıcı adı üretir.
    """
    if user:
        logger.info(f"Mevcut kullanıcı adı kullanılıyor: {user.username}")
        return {'username': user.username}
    
    # Google'dan e-posta al
    email = details.get('email', '')
    if email:
        email_prefix = email.split('@')[0] if '@' in email else ''
        safe_prefix = ''.join(c for c in email_prefix if c.isalnum() or c == '_')[:10]
        if safe_prefix:
            # E-posta öneki ve timestamp kullan
            timestamp = uuid.uuid4().hex[:6]
            random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=6))
            username = f"{safe_prefix}_{timestamp}_{random_str}"
        else:
            # Sadece timestamp ve random karakterler
            timestamp = uuid.uuid4().hex[:8]
            random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
            username = f"user_{timestamp}_{random_str}"
    else:
        # E-posta yoksa tamamen rastgele
        timestamp = uuid.uuid4().hex[:8]
        random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
        username = f"user_{timestamp}_{random_str}"
    
    # Maksimum uzunluğu sınırla (Django 150 karakter sınırı var ama 30 makul)
    username = username[:30]
    
    # Benzersizliği kontrol et
    attempts = 0
    base_username = username
    while User.objects.filter(username=username).exists() and attempts < 10:
        suffix = str(random.randint(1, 1000))
        username = f"{base_username[:26]}_{suffix}"
        attempts += 1
    
    logger.info(f"Benzersiz kullanıcı adı oluşturuldu: {username}")
    return {'username': username}

def create_new_user(strategy, details, backend, user=None, username=None, *args, **kwargs):
    """
    Her seferinde tamamen yeni bir kullanıcı oluşturur.
    """
    # Mevcut bir kullanıcı varsa ve zorla yeni kullanıcı oluşturma modu aktif DEĞİLSE
    if user:
        logger.info(f"Mevcut kullanıcı kullanılıyor: {user.username}")
        return {'user': user}
    
    # E-posta kontrolü
    email = details.get('email', '')
    if not email:
        logger.error("Kullanıcı oluşturulamadı: E-posta adresi eksik")
        email = f"no-email-{uuid.uuid4().hex[:8]}@example.com"  # Varsayılan e-posta oluştur
    
    # Kullanıcı adı kontrolü
    if not username:
        username_data = generate_username(strategy, details)
        username = username_data.get('username', '')
        if not username:
            username = f"user_{uuid.uuid4().hex[:15]}"
    
    # İsim ve soyisim bilgileri
    first_name = details.get('first_name', '')
    last_name = details.get('last_name', '')
    
    # E-posta adresi zaten kullanıldıysa benzersiz yap
    if User.objects.filter(email=email).exists():
        unique_suffix = uuid.uuid4().hex[:8]
        email_parts = email.split('@')
        if len(email_parts) == 2:
            email = f"{email_parts[0]}+{unique_suffix}@{email_parts[1]}"
        else:
            email = f"{username}@example.com"  # Yedek çözüm
    
    logger.info(f"Yeni kullanıcı oluşturuluyor: {username} ({email})")
    
    # Kullanıcı oluştur
    user = User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=uuid.uuid4().hex  # Rastgele şifre
    )
    
    # Kullanıcı profili oluştur - SADECE profil yoksa
    try:
        # Profil varsa getir
        from .models import UserProfile
        UserProfile.objects.get(user=user)
        logger.info(f"Kullanıcı profili zaten var: {user.username}")
    except UserProfile.DoesNotExist:
        # Profil yoksa oluştur
        UserProfile.objects.create(user=user)
        logger.info(f"Yeni kullanıcı profili oluşturuldu: {user.username}")
    
    return {
        'user': user,
        'is_new': True,
        'new_association': True
    }

def associate_user(backend, uid, user=None, social=None, *args, **kwargs):
    """
    Kullanıcıyı sosyal hesapla ilişkilendirir.
    """
    # Kullanıcı yoksa devam etme
    if not user:
        logger.error("İlişkilendirme başarısız: Kullanıcı mevcut değil")
        return None
    
    # Normal ilişkilendirme işlemi
    return {
        'social': backend.strategy.storage.user.create_social_auth(
            user, uid, backend.name
        ),
        'user': user,
        'new_association': True
    }

def load_extra_data(backend, details, response, uid, user=None, social=None, *args, **kwargs):
    """
    Sosyal hesaptan ek verileri yükler.
    """
    if not social:
        logger.warning("Ek veri yüklenemedi: Sosyal auth kaydı mevcut değil")
        return None
    
    # Normal ekstra veri yükleme işlemi
    extra_data = backend.extra_data(user, uid, response, details, *args, **kwargs)
    if extra_data and social:
        social.set_extra_data(extra_data)
    return {'social': social}

def user_details(backend, details, response, user=None, *args, **kwargs):
    """
    Kullanıcı detaylarını günceller.
    """
    if not user:
        logger.warning("Kullanıcı detayları güncellenemedi: Kullanıcı mevcut değil")
        return None
    
    # Kullanıcının adı ve soyadını güncelle (eğer boşsa)
    changed = False
    if details.get('first_name') and not user.first_name:
        user.first_name = details.get('first_name')
        changed = True
    
    if details.get('last_name') and not user.last_name:
        user.last_name = details.get('last_name')
        changed = True
    
    if changed:
        user.save()
    
    return {'user': user}

def create_token(backend, user, response, *args, **kwargs):
    """
    Kullanıcı için bir token oluşturur.
    """
    if not user:
        logger.error("Token oluşturulamadı: Kullanıcı mevcut değil")
        return None
    
    # Token oluştur veya var olanı getir
    token, created = Token.objects.get_or_create(user=user)
    if created:
        logger.info(f"Yeni token oluşturuldu: {user.username}")
    else:
        logger.info(f"Mevcut token kullanılıyor: {user.username}")
    
    return {'token': token}

def redirect_to_frontend(backend, user, response, *args, **kwargs):
    """
    İşlem tamamlandıktan sonra frontend'e yönlendirir.
    """
    if not user:
        logger.error("Frontend yönlendirmesi başarısız: Kullanıcı mevcut değil")
        return redirect('/login?error=auth_failed')
    
    # Frontend URL'ini belirle
    frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000'
    
    try:
        # Token'ı al
        token = kwargs.get('token')
        if not token:
            token, _ = Token.objects.get_or_create(user=user)
        
        # URL parametreleri oluştur
        params = {
            'token': token.key,
            'username': user.username,
            'is_new': str(kwargs.get('is_new', True)).lower()
        }
        
        # API anahtarlarını ekle
        if hasattr(settings, 'HERE_API_KEY') and settings.HERE_API_KEY:
            params['here_api_key'] = settings.HERE_API_KEY
            
        if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
            params['google_api_key'] = settings.GOOGLE_API_KEY
        
        # URL'i oluştur
        query_string = '&'.join([f"{key}={value}" for key, value in params.items()])
        redirect_url = f"{frontend_url}/map?{query_string}"
        
        logger.info(f"Frontend'e yönlendiriliyor: {redirect_url}")
        
        return redirect(redirect_url)
    except Exception as e:
        logger.error(f"Frontend yönlendirme hatası: {str(e)}")
        return redirect(f"{frontend_url}/login?error=redirect_error") 