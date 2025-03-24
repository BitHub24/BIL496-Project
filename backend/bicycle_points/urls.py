from django.urls import path
from .views import BicyclePointListView, BicyclePointDetailView

urlpatterns = [
    path('', BicyclePointListView.as_view(), name='bicycle_point_list'),
    path('<int:pk>/', BicyclePointDetailView.as_view(), name='bicycle_point_detail'),
] 