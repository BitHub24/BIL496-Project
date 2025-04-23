from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GoogleAuthView, RegisterView, LoginView, LogoutView, UserDetailView,
    PasswordResetRequestView, PasswordResetConfirmView,
    FavoriteLocationViewSet, UserProfileView, PasswordResetVerifyTokenView
)

router = DefaultRouter()
router.register(r'favorites', FavoriteLocationViewSet, basename='favoritelocation')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('google-auth/', GoogleAuthView.as_view(), name='google-auth'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('user/', UserDetailView.as_view(), name='user-detail'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm_post'),
    path('password-reset/verify/<token>/', PasswordResetVerifyTokenView.as_view(), name='password_reset_verify_token'),
    path('', include(router.urls)),
] 