from django.urls import path, include
from .views import RegisterView, LoginView, LogoutView, UserDetailView, UserUpdateView, PasswordResetRequestView, PasswordResetConfirmView, PasswordResetVerifyTokenView, SocialAuthCompleteView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', UserDetailView.as_view(), name='user-detail'),
    path('update/', UserUpdateView.as_view(), name='user-update'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password-reset/verify-token/<str:token>/', PasswordResetVerifyTokenView.as_view(), name='password-reset-verify-token'),
    path('social-auth/', include('social_django.urls', namespace='social')),
    path('social-auth/complete/', SocialAuthCompleteView.as_view(), name='social-auth-complete'),
] 