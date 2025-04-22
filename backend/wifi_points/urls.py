from django.urls import path
from .views import WiFiPointListView, WiFiPointDetailView

urlpatterns = [
    path('', WiFiPointListView.as_view(), name='wifi_point_list'),
    path('<int:pk>/', WiFiPointDetailView.as_view(), name='wifi_point_detail'),
]
