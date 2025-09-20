from rest_framework.permissions import BasePermission


class IsSupervisor(BasePermission):
    """Allow only supervisors (or superusers)."""
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False):
            return True
        return getattr(user, 'role', '') == 'supervisor'


class IsSelfOrSupervisor(BasePermission):
    """Allow if requesting own resource (by username) or requester is supervisor/superuser."""
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False) or getattr(user, 'role', '') == 'supervisor':
            return True
        # Accept username in path kwargs or request data
        username = None
        if hasattr(view, 'kwargs'):
            username = view.kwargs.get('username') or view.kwargs.get('pk')
        if not username and request is not None:
            username = request.data.get('username') or request.data.get('driver_username')
        return username == getattr(user, 'username', None)


class IsSupervisorSelf(BasePermission):
    """Allow only a supervisor accessing their own resources using path param 'username'."""
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False):
            return True
        if getattr(user, 'role', '') != 'supervisor':
            return False
        username = getattr(view, 'kwargs', {}).get('username')
        return username == getattr(user, 'username', None)
