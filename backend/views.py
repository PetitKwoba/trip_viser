from rest_framework import viewsets, permissions, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required, user_passes_test
from django.middleware.csrf import get_token
from django.http import HttpResponse
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404, redirect
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, Q
from django.core.cache import cache
from django.conf import settings
from django.utils.html import escape
from .models import User, Driver, Supervisor, Trip, ELDLog, ApprovalRequest
from .serializers import UserSerializer, DriverSerializer, SupervisorSerializer, TripSerializer, ELDLogSerializer, ApprovalRequestSerializer
from .permissions import IsSelfOrSupervisor, IsSupervisor, IsSupervisorSelf
import os

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email']
    ordering_fields = ['username', 'email', 'id']

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def role(self, request, pk=None):
        user = self.get_object()
        return Response({'role': user.role})

    @action(detail=False, methods=['get'], url_path=r'by-username/(?P<username>[^/.]+)/role', permission_classes=[permissions.IsAuthenticated])
    def role_by_username(self, request, username=None):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Only self or supervisor can query roles
        req_user = request.user
        if not (req_user.is_superuser or req_user.role == 'supervisor' or req_user.username == username):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return Response({'role': user.role})

class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related('user').all()
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__username', 'user__email', 'license', 'truck', 'terminal', 'office']
    ordering_fields = ['mileage', 'tripsToday', 'cycleUsed', 'user__username', 'id']
    # Enable detail route lookup by username
    lookup_field = 'username'
    lookup_url_kwarg = 'username'

    def get_permissions(self):
        # Restrict retrieve (detail) to self or supervisor
        if getattr(self, 'action', None) == 'retrieve':
            return [IsSelfOrSupervisor()]
        return super().get_permissions()

    def get_object(self):
        # Resolve driver by related user's username
        username = self.kwargs.get(self.lookup_url_kwarg)
        return get_object_or_404(Driver.objects.select_related('user'), user__username=username)

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        # Supervisors only see their assigned drivers
        if user and getattr(user, 'role', '') == 'supervisor' and not getattr(user, 'is_superuser', False):
            try:
                sup = Supervisor.objects.select_related('user').get(user=user)
                qs = qs.filter(supervisor=sup)
            except Supervisor.DoesNotExist:
                qs = qs.none()
        return qs

    @action(detail=True, methods=['post'], url_path='assign-supervisor', permission_classes=[permissions.IsAuthenticated, IsSupervisor])
    def assign_supervisor(self, request, username=None):
        """Assign or change the supervisor for a driver (by driver's username)."""
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)
        sup_username = request.data.get('supervisor_username')
        if not sup_username:
            return Response({'detail': 'supervisor_username is required'}, status=status.HTTP_400_BAD_REQUEST)
        sup = Supervisor.objects.select_related('user').filter(user__username=sup_username).first()
        if not sup:
            return Response({'detail': 'Supervisor not found'}, status=status.HTTP_404_NOT_FOUND)
        driver.supervisor = sup
        driver.save(update_fields=['supervisor'])
        return Response(DriverSerializer(driver).data)

    @action(detail=False, methods=['get'], url_path='leaderboard', permission_classes=[permissions.IsAuthenticated])
    def leaderboard(self, request):
        """
        Return top N drivers by mileage (default 5) and the current user's position.
        Supports optional period filtering based on Trips:
        - period=week (last 7 days) | month (last 30 days). Defaults to total mileage field on Driver.
        Query params:
        - username (optional): if omitted, uses request.user.username
        - limit (optional): number of top entries (default 5, max 10)
        - period (optional): 'week' or 'month'
        """
        limit_param = request.query_params.get('limit')
        try:
            top_limit = max(1, min(10, int(limit_param))) if limit_param is not None else 5
        except (TypeError, ValueError):
            top_limit = 5

        username = request.query_params.get('username') or getattr(request.user, 'username', None)
        period = (request.query_params.get('period') or '').lower().strip()
        period_start = None
        if period == 'week':
            period_start = timezone.now().date() - timedelta(days=7)
        elif period == 'month':
            period_start = timezone.now().date() - timedelta(days=30)

        cache_key = f"leaderboard:top:{period or 'all'}:{top_limit}"
        top = cache.get(cache_key)
        if top is None:
            if period_start:
                # Top by period trips sum
                top_qs = (
                    Driver.objects.select_related('user')
                    .annotate(period_miles=Sum('trip__mileage', filter=Q(trip__date__gte=period_start)))
                    .order_by('-period_miles', 'id')[:top_limit]
                )
                top = []
                for idx, d in enumerate(top_qs, start=1):
                    miles = int(d.period_miles or 0)
                    top.append({
                        'username': d.user.username,
                        'name': d.user.get_full_name() or d.user.username,
                        'mileage': miles,
                        'rank': idx,
                    })
            else:
                # Top by total mileage field
                top_qs = Driver.objects.select_related('user').order_by('-mileage', 'id')[:top_limit]
                top = []
                for idx, d in enumerate(top_qs, start=1):
                    top.append({
                        'username': d.user.username,
                        'name': d.user.get_full_name() or d.user.username,
                        'mileage': int(d.mileage or 0),
                        'rank': idx,
                    })
            # Cache for a short interval (configurable)
            cache.set(cache_key, top, timeout=getattr(settings, 'LEADERBOARD_CACHE_TTL', 60))

        me_obj = None
        if username:
            try:
                me_driver = Driver.objects.select_related('user').get(user__username=username)
                if period_start:
                    # Compute my period miles and rank among drivers by period miles
                    me_period = (
                        Driver.objects.filter(pk=me_driver.pk)
                        .annotate(period_miles=Sum('trip__mileage', filter=Q(trip__date__gte=period_start)))
                        .values_list('period_miles', flat=True)
                        .first()
                    )
                    me_miles = int(me_period or 0)
                    higher = (
                        Driver.objects
                        .annotate(period_miles=Sum('trip__mileage', filter=Q(trip__date__gte=period_start)))
                        .filter(period_miles__gt=me_miles)
                        .count()
                    )
                    me_obj = {
                        'username': me_driver.user.username,
                        'name': me_driver.user.get_full_name() or me_driver.user.username,
                        'mileage': me_miles,
                        'rank': higher + 1,
                    }
                else:
                    # Rank by total mileage field
                    higher = Driver.objects.filter(mileage__gt=(me_driver.mileage or 0)).count()
                    me_obj = {
                        'username': me_driver.user.username,
                        'name': me_driver.user.get_full_name() or me_driver.user.username,
                        'mileage': int(me_driver.mileage or 0),
                        'rank': higher + 1,
                    }
            except Driver.DoesNotExist:
                me_obj = None

        # If me is in top already, don't duplicate
        in_top = me_obj and any(item['username'] == me_obj['username'] for item in top)
        payload = {'top': top}
        if me_obj and not in_top:
            payload['me'] = me_obj
        elif me_obj and in_top:
            payload['me'] = None
        else:
            payload['me'] = None

        return Response(payload)

    @action(detail=False, methods=['get'], url_path=r'by-username/(?P<username>[^/.]+)', permission_classes=[IsSelfOrSupervisor])
    def by_username(self, request, username=None):
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(driver)
        return Response(serializer.data)

class SupervisorViewSet(viewsets.ModelViewSet):
    queryset = Supervisor.objects.select_related('user').all()
    serializer_class = SupervisorSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__username', 'user__email', 'office']
    ordering_fields = ['user__username', 'office', 'id']

class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.select_related('driver__user').all()
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['start', 'end', 'driver__user__username']
    ordering_fields = ['date', 'mileage', 'cycleUsed', 'id']
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=['post'], url_path='submit', permission_classes=[permissions.IsAuthenticated])
    def submit(self, request):
        username = request.data.get('username')
        start = request.data.get('start') or request.data.get('pickupLocation')
        end = request.data.get('end') or request.data.get('dropoffLocation')
        stops = request.data.get('stops')
        mileage = request.data.get('mileage')
        cycle_used = request.data.get('cycleUsed')
        polyline = request.data.get('polyline')

        if not username or not start or not end:
            return Response({'detail': 'username, start, and end are required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            mileage_val = int(mileage) if mileage is not None else 0
        except (TypeError, ValueError):
            mileage_val = 0
        try:
            cycle_val = int(cycle_used) if cycle_used is not None else 0
        except (TypeError, ValueError):
            cycle_val = 0

        if stops is None:
            current_loc = request.data.get('currentLocation')
            stops = [current_loc] if current_loc else []

        trip = Trip.objects.create(
            driver=driver,
            start=start,
            end=end,
            stops=stops,
            mileage=mileage_val,
            cycleUsed=cycle_val,
            polyline=polyline,
        )

        # Update simple driver aggregates and recent trips
        try:
            driver.mileage = (driver.mileage or 0) + mileage_val
            driver.tripsToday = (driver.tripsToday or 0) + 1
            driver.cycleUsed = max(driver.cycleUsed or 0, cycle_val)
            # Prepend a simple recent trip summary, keep max 5
            recent = driver.recentTrips or []
            summary = f"{start} -> {end} - {trip.date.isoformat()}"
            recent = [summary] + [r for r in recent if r != summary]
            driver.recentTrips = recent[:5]
            driver.save(update_fields=['mileage', 'tripsToday', 'cycleUsed', 'recentTrips'])
        except Exception:
            pass

        serializer = self.get_serializer(trip)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path=r'by-username/(?P<username>[^/.]+)', permission_classes=[IsSelfOrSupervisor])
    def trips_by_username(self, request, username=None):
        limit = request.query_params.get('limit')
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)
        qs = Trip.objects.filter(driver=driver).order_by('-date')
        if limit:
            try:
                qs = qs[:int(limit)]
            except ValueError:
                pass
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

class ELDLogViewSet(viewsets.ModelViewSet):
    queryset = (
        ELDLog.objects.select_related('driver__user', 'trip')
        .prefetch_related('approvalrequest_set__trip')
        .all()
    )
    serializer_class = ELDLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['driver__user__username']
    ordering_fields = ['date', 'id']
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=['post'], url_path='submit', permission_classes=[permissions.IsAuthenticated])
    def submit(self, request):
        username = request.data.get('username')
        log_entries = request.data.get('logEntries', [])
        trip_id = request.data.get('tripId') or request.data.get('trip_id')
        if not username:
            return Response({'detail': 'username is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        trip_obj = None
        if trip_id:
            try:
                trip_obj = Trip.objects.get(pk=trip_id, driver=driver)
            except Trip.DoesNotExist:
                trip_obj = None

        eld = ELDLog.objects.create(driver=driver, logEntries=log_entries, trip=trip_obj)
        serializer = self.get_serializer(eld)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='accept', permission_classes=[permissions.IsAuthenticated])
    def accept(self, request, pk=None):
        eld = self.get_object()
        # Only the log's driver (self) can accept
        if request.user.username != eld.driver.user.username and not request.user.is_superuser:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        # Must be in Submitted state
        if eld.status != 'Submitted':
            return Response({'detail': 'Log must be in Submitted state to accept'}, status=status.HTTP_400_BAD_REQUEST)
        # Require an Approved approval request
        approved = eld.approvalrequest_set.filter(status='Approved').exists()
        if not approved:
            return Response({'detail': 'Supervisor approval required before accepting'}, status=status.HTTP_400_BAD_REQUEST)
        eld.status = 'Accepted'
        eld.save(update_fields=['status'])
        return Response({'status': eld.status})

    @action(detail=True, methods=['post'], url_path='complete', permission_classes=[permissions.IsAuthenticated])
    def complete(self, request, pk=None):
        eld = self.get_object()
        # Only the log's driver (self) can complete
        if request.user.username != eld.driver.user.username and not request.user.is_superuser:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        # Must be in Accepted state
        if eld.status != 'Accepted':
            return Response({'detail': 'Log must be Accepted before completion'}, status=status.HTTP_400_BAD_REQUEST)
        eld.status = 'Completed'
        eld.save(update_fields=['status'])
        return Response({'status': eld.status})

    @action(detail=False, methods=['get'], url_path=r'by-username/(?P<username>[^/.]+)', permission_classes=[IsSelfOrSupervisor])
    def logs_by_username(self, request, username=None):
        limit = request.query_params.get('limit')
        try:
            driver = Driver.objects.select_related('user').get(user__username=username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)
        # If requester is a supervisor, restrict access to only their assigned drivers
        req_user = request.user
        if getattr(req_user, 'role', '') == 'supervisor' and not getattr(req_user, 'is_superuser', False):
            try:
                sup = Supervisor.objects.select_related('user').get(user=req_user)
                if driver.supervisor_id != sup.id:
                    return Response({'detail': 'Forbidden: driver not assigned to this supervisor'}, status=status.HTTP_403_FORBIDDEN)
            except Supervisor.DoesNotExist:
                return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(driver=driver)
        # Optional date filters: exact date or from/to range
        date_str = request.query_params.get('date')
        from_str = request.query_params.get('from')
        to_str = request.query_params.get('to')
        try:
            if date_str:
                qs = qs.filter(date=date_str)
            else:
                if from_str:
                    qs = qs.filter(date__gte=from_str)
                if to_str:
                    qs = qs.filter(date__lte=to_str)
        except Exception:
            pass
        qs = qs.order_by('-date')
        if limit:
            try:
                qs = qs[:int(limit)]
            except ValueError:
                pass
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    queryset = ApprovalRequest.objects.select_related('trip__driver__user', 'eldlog__driver__user', 'supervisor__user').all()
    serializer_class = ApprovalRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['supervisor__user__username', 'trip__driver__user__username', 'eldlog__driver__user__username', 'status']
    ordering_fields = ['date', 'status', 'id']
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=['post'], url_path='create', permission_classes=[permissions.IsAuthenticated])
    def create_request(self, request):
        driver_username = request.data.get('driver_username') or request.data.get('username')
        supervisor_username = request.data.get('supervisor_username')
        if not driver_username:
            return Response({'detail': 'driver_username is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            driver = Driver.objects.select_related('user').get(user__username=driver_username)
        except Driver.DoesNotExist:
            return Response({'detail': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        # find latest trip and eld log for driver
        trip = Trip.objects.filter(driver=driver).order_by('-date', '-id').first()
        eld = ELDLog.objects.filter(driver=driver).order_by('-date', '-id').first()
        if not trip or not eld:
            return Response({'detail': 'Trip and ELDLog are required for approval request'}, status=status.HTTP_400_BAD_REQUEST)

        # choose supervisor
        supervisor = None
        if supervisor_username:
            supervisor = Supervisor.objects.select_related('user').filter(user__username=supervisor_username).first()
        if not supervisor:
            # pick supervisor with least pending approvals
            supervisors = list(Supervisor.objects.select_related('user').all())
            if not supervisors:
                return Response({'detail': 'No supervisors available'}, status=status.HTTP_400_BAD_REQUEST)
            supervisors.sort(key=lambda s: ApprovalRequest.objects.filter(supervisor=s, status='Pending').count())
            supervisor = supervisors[0]

        # prevent duplicate pending request for same trip/log
        existing = ApprovalRequest.objects.filter(trip=trip, eldlog=eld, status='Pending').first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        ar = ApprovalRequest.objects.create(trip=trip, eldlog=eld, supervisor=supervisor, status='Pending')
        # Explicitly link the ELDLog to the Trip for future lookups
        try:
            if not eld.trip:
                eld.trip = trip
                eld.save(update_fields=['trip'])
        except Exception:
            pass
        serializer = self.get_serializer(ar)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path=r'by-supervisor/(?P<username>[^/.]+)', permission_classes=[IsSupervisorSelf])
    def by_supervisor(self, request, username=None):
        status_filter = request.query_params.get('status', 'Pending')
        try:
            supervisor = Supervisor.objects.select_related('user').get(user__username=username)
        except Supervisor.DoesNotExist:
            return Response({'detail': 'Supervisor not found'}, status=status.HTTP_404_NOT_FOUND)
        qs = ApprovalRequest.objects.filter(supervisor=supervisor)
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.order_by('-date', '-id')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve', permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        ar = self.get_object()
        # Only assigned supervisor or superuser can approve
        if not request.user.is_superuser:
            sup = getattr(request.user, 'supervisor_profile', None)
            if not sup or ar.supervisor_id != sup.id:
                return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        ar.status = 'Approved'
        ar.save(update_fields=['status'])
        try:
            ar.trip.status = 'Approved'
            ar.trip.save(update_fields=['status'])
        except Exception:
            pass
        return Response({'status': 'Approved'})

    @action(detail=True, methods=['post'], url_path='reject', permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        ar = self.get_object()
        # Only assigned supervisor or superuser can reject
        if not request.user.is_superuser:
            sup = getattr(request.user, 'supervisor_profile', None)
            if not sup or ar.supervisor_id != sup.id:
                return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        ar.status = 'Rejected'
        ar.save(update_fields=['status'])
        try:
            ar.trip.status = 'Rejected'
            ar.trip.save(update_fields=['status'])
        except Exception:
            pass
        return Response({'status': 'Rejected'})

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    if user:
        return Response({'role': user.role, 'username': user.username})
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# Lightweight health check for uptime/load balancers
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({'status': 'ok'})


# Root landing page: redirect to FRONTEND_URL if configured, else show helpful links
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def index(request):
    frontend_url = getattr(settings, 'FRONTEND_URL', None) or os.environ.get('FRONTEND_URL')
    if frontend_url:
        return redirect(frontend_url)
    html = (
        "<html><head><title>Trip Viser</title></head><body>"
        "<h2>Trip Viser API</h2>"
        "<p>This is the backend service. Try these helpful links:</p>"
        "<ul>"
        "<li><a href='/api/health/'>/api/health/</a></li>"
        "<li><a href='/api/schema/'>/api/schema/</a></li>"
        "<li><a href='/admin/'>/admin/</a></li>"
        "</ul>"
        "</body></html>"
    )
    return HttpResponse(html, content_type='text/html; charset=utf-8')


# Minimal admin page to assign drivers to supervisors (for demo/admin convenience)
# Secure: login required and staff/superuser only. Includes CSRF protection.
@login_required
@user_passes_test(lambda u: u.is_staff or u.is_superuser)
def admin_assignments(request):
    csrf_token = get_token(request)
    if request.method == 'POST':
        d_username = (request.POST.get('driver_username') or '').strip()
        s_username = (request.POST.get('supervisor_username') or '').strip()
        err = ''
        if not d_username or not s_username:
            err = 'Both driver_username and supervisor_username are required.'
        else:
            try:
                driver = Driver.objects.select_related('user').get(user__username=d_username)
                sup = Supervisor.objects.select_related('user').get(user__username=s_username)
                driver.supervisor = sup
                driver.save(update_fields=['supervisor'])
            except Driver.DoesNotExist:
                err = 'Driver not found.'
            except Supervisor.DoesNotExist:
                err = 'Supervisor not found.'
        if err:
            html = (
                "<html><body><h3>Assign Driver to Supervisor</h3>"
                f"<p style='color:red'>{err}</p>" + _assignments_form(csrf_token) + _assignments_table() + "</body></html>"
            )
            return HttpResponse(html, content_type='text/html; charset=utf-8')
        html = (
            "<html><body><h3>Assign Driver to Supervisor</h3>"
            "<p style='color:green'>Assignment saved.</p>" + _assignments_form(csrf_token) + _assignments_table() + "</body></html>"
        )
        return HttpResponse(html, content_type='text/html; charset=utf-8')
    # GET
    html = (
        "<html><body><h3>Assign Driver to Supervisor</h3>" + _assignments_form(csrf_token) + _assignments_table() + "</body></html>"
    )
    return HttpResponse(html, content_type='text/html; charset=utf-8')


def _assignments_form(csrf_token: str):
    return (
        "<form method='post' style='margin:1em 0'>"
        f"<input type='hidden' name='csrfmiddlewaretoken' value='{csrf_token}' />"
    "<label>Driver username: <input name='driver_username' /></label>"
        "&nbsp;&nbsp;"
        "<label>Supervisor username: <input name='supervisor_username' /></label>"
        "&nbsp;&nbsp;"
        "<button type='submit'>Assign</button>"
        "</form>"
    )


def _assignments_table():
    rows = []
    for d in Driver.objects.select_related('user', 'supervisor__user').all().order_by('user__username'):
        supname = d.supervisor.user.username if d.supervisor and d.supervisor.user else '—'
        rows.append(
            f"<tr><td>{escape(d.user.username)}</td><td>{escape(supname)}</td><td>{escape(d.office or '')}</td><td>{escape(d.terminal or '')}</td></tr>"
        )
    table = (
        "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;margin-top:1em'>"
        "<thead><tr><th>Driver</th><th>Supervisor</th><th>Office</th><th>Terminal</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
    )
    return table
