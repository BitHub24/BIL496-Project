from django.contrib import admin
from .models import BicyclePoint

@admin.register(BicyclePoint)
class BicyclePointAdmin(admin.ModelAdmin):
    """Bisiklet İstasyonu Admin Paneli"""
    list_display = ('name', 'global_id', 'is_active', 'latitude', 'longitude', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'global_id')
    readonly_fields = ('created_at', 'updated_at') 