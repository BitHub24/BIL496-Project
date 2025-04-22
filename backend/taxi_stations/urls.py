from django.urls import path
from .views import TaxiStationsView

urlpatterns = [
    path('', TaxiStationsView.as_view(), name='taxi_stations'),
] 