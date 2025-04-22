from django.urls import path
from .views import DutyPharmacyView, NearestPharmacyView, CheckAndFetchTodayPharmaciesView

urlpatterns = [
    path('check-today/', CheckAndFetchTodayPharmaciesView.as_view(), name='check_today_pharmacies'),
    path('', DutyPharmacyView.as_view(), name='duty_pharmacies'),
    path('nearest/', NearestPharmacyView.as_view(), name='nearest_pharmacies'),
] 