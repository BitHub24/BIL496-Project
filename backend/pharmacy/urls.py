from django.urls import path
from .views import DutyPharmacyView, NearestPharmacyView

urlpatterns = [
    path('', DutyPharmacyView.as_view(), name='duty_pharmacies'),
    path('nearest', NearestPharmacyView.as_view(), name='nearest_pharmacies'),
] 