from django.urls import path
from . import views

urlpatterns = [
    path('latest/', views.get_latest_traffic_data, name='get_latest_traffic_data'),
] 