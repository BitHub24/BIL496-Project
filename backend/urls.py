from django.urls import path
from . import views

urlpatterns = [
    path('api/route', views.calculate_route, name='calculate_route'),
    path('api/search', views.search_address, name='search_address'),
] 