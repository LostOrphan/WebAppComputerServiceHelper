from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .throttles import LoginRateThrottle, RefreshTokenRateThrottle


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [RefreshTokenRateThrottle]
