from django.contrib import admin
from .models import UserProfile, RoutePreference, SavedRoute

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at']
    search_fields = ['user__username', 'user__email']

@admin.register(RoutePreference)
class RoutePreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'route_type', 'traffic_priority', 'avoid_highways', 'avoid_tolls']
    list_filter = ['route_type', 'traffic_priority', 'avoid_highways', 'avoid_tolls']
    search_fields = ['user__username']

@admin.register(SavedRoute)
class SavedRouteAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'start_name', 'end_name', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'name', 'start_name', 'end_name']
