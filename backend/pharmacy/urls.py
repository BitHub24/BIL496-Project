from django.urls import path
from .views import DutyPharmacyView, NearestPharmacyView

urlpatterns = [
    path('api/pharmacies', DutyPharmacyView.as_view(), name='duty_pharmacies'),
    path('api/pharmacies/nearest', NearestPharmacyView.as_view(), name='nearest_pharmacies'),
] 