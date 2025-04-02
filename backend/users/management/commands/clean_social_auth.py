"""
Sosyal kimlik doğrulama kayıtlarını ve ilgili kullanıcıları temizlemek için Django yönetim komutu.
"""

from django.core.management.base import BaseCommand
from social_django.models import UserSocialAuth
from django.contrib.auth.models import User
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Sosyal kimlik doğrulama kayıtlarını ve ilgili kullanıcıları temizler.'
    
    def add_arguments(self, parser):
        # Admin kullanıcılarını koruma seçeneği
        parser.add_argument(
            '--no-preserve-admin',
            action='store_false',
            dest='preserve_admin',
            default=True,
            help='Admin kullanıcılarının sosyal kimlik doğrulama kayıtlarını da siler',
        )
        
        # Tüm kullanıcıları silme seçeneği (tehlikeli!)
        parser.add_argument(
            '--delete-users',
            action='store_true',
            dest='delete_users',
            default=False,
            help='Sosyal kimlik doğrulama kayıtlarıyla ilişkili kullanıcıları da siler (tehlikeli!)',
        )
        
        # Belirli bir e-posta hesabıyla ilişkili sosyal kayıtları silme seçeneği
        parser.add_argument(
            '--email',
            dest='email',
            help='Sadece belirtilen e-posta adresiyle ilişkili sosyal kayıtları siler',
        )
    
    def handle(self, *args, **options):
        preserve_admin = options['preserve_admin']
        delete_users = options['delete_users']
        email = options.get('email')
        
        self.stdout.write(self.style.SUCCESS('Sosyal kimlik doğrulama temizleme işlemi başlatılıyor...'))
        
        # Filtreleme
        social_auths = UserSocialAuth.objects.all()
        
        if email:
            # Belirli bir e-posta adresiyle ilişkili sosyal kayıtları bul
            users = User.objects.filter(email=email)
            social_auths = social_auths.filter(user__in=users)
            self.stdout.write(f"Sadece '{email}' e-posta adresine sahip kayıtlar işlenecek")
        
        # Kullanıcı bilgilerini göster
        total_social_auths = social_auths.count()
        self.stdout.write(f"Toplam {total_social_auths} sosyal kimlik doğrulama kaydı bulundu")
        
        # Admin olmayan kullanıcıları güvenli bir şekilde seç
        if preserve_admin:
            # is_staff veya is_superuser olan kullanıcıları hariç tut
            admin_social_auths = social_auths.filter(
                user__is_staff=True
            ) | social_auths.filter(
                user__is_superuser=True
            )
            admin_count = admin_social_auths.count()
            
            # Admin kullanıcıları koruyoruz
            social_auths = social_auths.exclude(
                user__is_staff=True
            ).exclude(
                user__is_superuser=True
            )
            
            self.stdout.write(f"{admin_count} admin sosyal kimlik doğrulama kaydı korunacak")
        
        # Kalan sosyal kimlik doğrulama kayıtlarının sayısı
        count = social_auths.count()
        self.stdout.write(f"{count} sosyal kimlik doğrulama kaydı silinecek")
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Silinecek sosyal kimlik doğrulama kaydı bulunamadı.'))
            return
        
        # Önce kullanıcı listesini tut (sosyal kayıtlar silinince bulamayız)
        users_to_delete = []
        if delete_users:
            for social_auth in social_auths:
                # Her kullanıcının sadece bir kez eklenmesini sağla
                if social_auth.user not in users_to_delete:
                    users_to_delete.append(social_auth.user)
        
        # Silme işlemini gerçekleştir
        for social_auth in social_auths:
            username = social_auth.user.username
            provider = social_auth.provider
            self.stdout.write(f"Siliniyor: {username} ({provider})")
            social_auth.delete()
        
        self.stdout.write(self.style.SUCCESS(f"{count} sosyal kimlik doğrulama kaydı başarıyla silindi."))
        
        # Kullanıcıları sil (eğer seçenek aktifse)
        if delete_users and users_to_delete:
            self.stdout.write(f"{len(users_to_delete)} kullanıcı silinecek...")
            for user in users_to_delete:
                self.stdout.write(f"Kullanıcı siliniyor: {user.username} ({user.email})")
                user.delete()
            self.stdout.write(self.style.SUCCESS(f"{len(users_to_delete)} kullanıcı başarıyla silindi."))
        
        self.stdout.write(self.style.SUCCESS('Sosyal kimlik doğrulama temizleme işlemi tamamlandı!')) 