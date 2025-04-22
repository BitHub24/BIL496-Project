from django.urls import path
from .views import DirectionsView
from .public_transport import PublicTransportView

urlpatterns = [
    path('route/', DirectionsView.as_view(), name='directions'),
    path('transit/', PublicTransportView.as_view(), name='transit'),
]
