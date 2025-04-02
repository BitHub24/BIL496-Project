"""
Bu komut, admin kullanıcısının e-posta adresini geçici olarak değiştirir.
Bu, Google OAuth ile otomatik ilişkilendirmeyi önlemek için kullanılabilir.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Admin kullanıcısının e-posta adresini geçici olarak değiştirir'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--new-email',
            dest='new_email',
            default=None,
            help='Yeni e-posta adresi'
        )
        
        parser.add_argument(
            '--list',
            action='store_true',
            dest='list_users',
            default=False,
            help='Tüm kullanıcıları listeler'
        )
        
        parser.add_argument(
            '--reset',
            action='store_true',
            dest='reset',
            default=False,
            help='Admin e-postasını varsayılana sıfırla'
        )
    
    def handle(self, *args, **options):
        list_users = options['list_users']
        new_email = options['new_email']
        reset = options['reset']
        
        # Kullanıcıları listele
        if list_users:
            users = User.objects.all().order_by('username')
            self.stdout.write("\nSistemde kayıtlı kullanıcılar:")
            for user in users:
                self.stdout.write(f"- {user.username}: {user.email} (Superuser: {user.is_superuser}, Staff: {user.is_staff})")
            return
        
        # Admin kullanıcısını bul
        try:
            admin_user = User.objects.get(username='admin')
            current_email = admin_user.email
            
            # E-postayı varsayılana sıfırla
            if reset:
                admin_user.email = 'admin@example.com'
                admin_user.save(update_fields=['email'])
                self.stdout.write(self.style.SUCCESS(f"Admin e-postası varsayılana sıfırlandı: {admin_user.email}"))
                return
            
            # Yeni e-posta ayarla
            if new_email:
                old_email = admin_user.email
                admin_user.email = new_email
                admin_user.save(update_fields=['email'])
                self.stdout.write(self.style.SUCCESS(f"Admin e-postası değiştirildi: {old_email} -> {new_email}"))
            else:
                self.stdout.write(f"Mevcut admin e-postası: {admin_user.email}")
                self.stdout.write("E-postayı değiştirmek için --new-email parametresini kullanın.")
                
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR("Admin kullanıcısı bulunamadı!")) 