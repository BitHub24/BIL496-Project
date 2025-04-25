from django.contrib import admin
from .models import TaxiStation

@admin.register(TaxiStation)
class TaxiStationAdmin(admin.ModelAdmin):
    list_display = ('name', 'place_id', 'rating', 'phone_number')
    search_fields = ('name', 'place_id')
    list_filter = ('rating',) 