from django.contrib import admin
from .models import WiFiPoint

@admin.register(WiFiPoint)
class WiFiPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'category', 'is_active', 'latitude', 'longitude', 'created_at')
    list_filter = ('is_active', 'category')
    search_fields = ('name', 'address')
    ordering = ('-created_at',) 