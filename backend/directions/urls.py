from django.urls import path
from .views import DirectionsView

urlpatterns = [
    path('route/', DirectionsView.as_view(), name='get_directions'),
] 