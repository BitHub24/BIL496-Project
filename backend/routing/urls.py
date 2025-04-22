from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'road-segments', views.RoadSegmentViewSet)
router.register(r'preferences', views.UserRoadPreferenceViewSet)
router.register(r'profiles', views.RoutePreferenceProfileViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
