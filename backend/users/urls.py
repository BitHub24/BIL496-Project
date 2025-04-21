from django.urls import path
from .views import GoogleAuthView, RegisterView, LoginView, LogoutView, UserDetailView, UserUpdateView, PasswordResetRequestView, PasswordResetConfirmView, PasswordResetVerifyTokenView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('google-auth/', GoogleAuthView.as_view(), name='google-auth'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', UserDetailView.as_view(), name='user-detail'),
    path('update/', UserUpdateView.as_view(), name='user-update'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password-reset/verify-token/<str:token>/', PasswordResetVerifyTokenView.as_view(), name='password-reset-verify-token'),
] 