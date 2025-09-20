
from django.urls import path, include
from django.contrib import admin
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet,
    DriverViewSet,
    SupervisorViewSet,
    TripViewSet,
    ELDLogViewSet,
    ApprovalRequestViewSet,
    login_view,
    health,
    admin_assignments,
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from rest_framework.schemas import get_schema_view
from rest_framework.renderers import JSONOpenAPIRenderer

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'drivers', DriverViewSet, basename='driver')
router.register(r'supervisors', SupervisorViewSet)
router.register(r'trips', TripViewSet)
router.register(r'eldlogs', ELDLogViewSet)
router.register(r'approvalrequests', ApprovalRequestViewSet)

urlpatterns = [
    # Health check
    path('api/health/', health, name='health'),

    # Auth (backward compatible unversioned)
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # API routes (unversioned - keep for backward compatibility)
    path('api/', include((router.urls, 'api'), namespace='v0')),

    # Versioned API v1
    path('api/v1/auth/login/', login_view, name='v1_login'),
    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='v1_token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='v1_token_refresh'),
    path('api/v1/auth/token/verify/', TokenVerifyView.as_view(), name='v1_token_verify'),
    path('api/v1/', include((router.urls, 'api'), namespace='v1')),

    # API schema and docs
    path(
        'api/schema/',
        get_schema_view(
            title="Trip Viser API",
            description="OpenAPI schema for Trip Viser",
            version="1.0.0",
            renderer_classes=[JSONOpenAPIRenderer],
        ),
        name='openapi-schema',
    ),

        # Lightweight admin page for driver-supervisor assignment (place before Django admin to avoid shadowing)
        path('admin/assignments/', admin_assignments, name='admin-assignments'),

    # Django admin
    path('admin/', admin.site.urls),
]
