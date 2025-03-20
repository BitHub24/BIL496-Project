from django.urls import path
from .views import GeocodeView

urlpatterns = [
    path('search/', GeocodeView.as_view(), name='geocode_search'),
] 