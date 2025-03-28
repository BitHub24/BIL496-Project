from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
# Bu kısmı kaldırıyorum çünkü model social_django tarafından zaten kaydediliyor
# from social_django.models import UserSocialAuth
from .models import UserProfile

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Kullanıcı Profili'

class CustomUserAdmin(UserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_social_providers')
    
    def get_social_providers(self, obj):
        providers = obj.social_auth.all().values_list('provider', flat=True)
        return ", ".join(providers) if providers else "-"
    
    get_social_providers.short_description = 'Sosyal Hesaplar'

# Admin'de özel kullanıcı admin sınıfını kullan
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

# Bu kısmı kaldırıyorum çünkü model social_django tarafından zaten kaydediliyor
# @admin.register(UserSocialAuth)
# class SocialAuthAdmin(admin.ModelAdmin):
#     list_display = ('user', 'provider', 'uid')
#     list_filter = ('provider',)
#     search_fields = ('user__username', 'user__email', 'uid')
#     raw_id_fields = ('user',)
