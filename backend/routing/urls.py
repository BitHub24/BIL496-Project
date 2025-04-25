from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'road-segments', views.RoadSegmentViewSet)
router.register(r'preferences', views.UserRoadPreferenceViewSet, basename='preference')
router.register(r'profiles', views.RoutePreferenceProfileViewSet, basename='profile')

# Custom URL patterns for actions
urlpatterns = [
    path('', include(router.urls)),
]
