from django.urls import path
from .views import DutyPharmacyView

urlpatterns = [
    path('api/pharmacies', DutyPharmacyView.as_view(), name='duty_pharmacies'),
] 