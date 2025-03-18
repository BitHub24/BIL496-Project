from django.contrib import admin
from .models import Pharmacy

@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ['name', 'district', 'phone', 'date']
    list_filter = ['date', 'district']
    search_fields = ['name', 'address', 'district']
    date_hierarchy = 'date'
    ordering = ['-date', 'district', 'name'] 