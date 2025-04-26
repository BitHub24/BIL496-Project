from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoadSegmentViewSet,
    UserRoadPreferenceViewSet,
    RoutePreferenceProfileViewSet,
    GraphMLSearchView,  # Yeni view'ı import et
    GeocodingSearchView,  # Yeni view'ı import et
    RoadSegmentGeometryView,  # Yeni view'ı import et
    UserAreaPreferenceViewSet # Yeni ViewSet'i import et
)

router = DefaultRouter()
router.register(r'road-segments', RoadSegmentViewSet, basename='roadsegment')
router.register(r'preferences', UserRoadPreferenceViewSet, basename='userpreference')
router.register(r'profiles', RoutePreferenceProfileViewSet, basename='preferenceprofile')
router.register(r'area-preferences', UserAreaPreferenceViewSet, basename='areapreference') # Yeni ViewSet'i kaydet

# Custom URL patterns for actions
urlpatterns = [
    path('', include(router.urls)),
    # Yeni GraphML arama endpoint'i (Artık kullanılmayacaksa kaldırılabilir)
    path('graphml/search/', GraphMLSearchView.as_view(), name='graphml-search'),
    # Yeni Geocoding arama endpoint'i
    path('geocoding/search/', GeocodingSearchView.as_view(), name='geocoding-search'),
    # YENİ: OSM ID ile geometri getirme endpoint'i
    path('road-segments/geometry/<int:osm_id>/', RoadSegmentGeometryView.as_view(), name='roadsegment-geometry'),
]
