from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/pharmacies/', include('pharmacy.urls')),
    path('api/traffic/', include('traffic.urls')),
    path('api/wifi-points/', include('wifi_points.urls')),
    path('api/bicycle-stations/', include('bicycle_points.urls')),
] 