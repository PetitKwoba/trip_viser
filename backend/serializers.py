from rest_framework import serializers
from .models import User, Driver, Supervisor, Trip, ELDLog, ApprovalRequest

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']

class DriverSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    def get_name(self, obj):
        # Use full name if available, else username
        return obj.user.get_full_name() or obj.user.username

    def get_email(self, obj):
        return obj.user.email

    class Meta:
        model = Driver
        fields = ['id', 'user', 'name', 'email', 'license', 'truck', 'trailer', 'office', 'terminal', 'status', 'mileage', 'cycleUsed', 'tripsToday', 'phone', 'recentTrips']

class SupervisorSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    class Meta:
        model = Supervisor
        fields = ['id', 'user', 'office', 'email']

class TripSerializer(serializers.ModelSerializer):
    driver = DriverSerializer()
    class Meta:
        model = Trip
        fields = ['id', 'driver', 'start', 'end', 'stops', 'date', 'mileage', 'cycleUsed', 'status', 'polyline']

class ELDLogSerializer(serializers.ModelSerializer):
    driver = DriverSerializer()
    trip = serializers.SerializerMethodField()
    approvalStatus = serializers.SerializerMethodField()
    approvalInfo = serializers.SerializerMethodField()

    class Meta:
        model = ELDLog
        fields = ['id', 'driver', 'date', 'logEntries', 'trip', 'status', 'approvalStatus', 'approvalInfo']

    def get_trip(self, obj: ELDLog):
        # Prefer explicit FK linkage when available
        try:
            t = getattr(obj, 'trip', None)
            if t is not None:
                return {
                    'id': t.id,
                    'start': t.start,
                    'end': t.end,
                    'stops': t.stops or [],
                    'date': t.date,
                    'mileage': t.mileage,
                    'cycleUsed': t.cycleUsed,
                    'status': t.status,
                    'polyline': t.polyline,
                }
        except Exception:
            pass

        # Try to locate an explicitly linked trip via ApprovalRequest (prefer Approved)
        try:
            ar = obj.approvalrequest_set.select_related('trip').filter(status='Approved').order_by('-date', '-id').first()
            if not ar:
                ar = obj.approvalrequest_set.select_related('trip').filter(status='Pending').order_by('-date', '-id').first()
            if ar and ar.trip:
                t = ar.trip
                return {
                    'id': t.id,
                    'start': t.start,
                    'end': t.end,
                    'stops': t.stops or [],
                    'date': t.date,
                    'mileage': t.mileage,
                    'cycleUsed': t.cycleUsed,
                    'status': t.status,
                    'polyline': t.polyline,
                }
        except Exception:
            pass

        # Fallback: nearest trip for same driver on or before the log date
        try:
            t = (
                Trip.objects.filter(driver=obj.driver, date__lte=obj.date)
                .order_by('-date', '-id')
                .first()
            )
            if not t:
                t = (
                    Trip.objects.filter(driver=obj.driver, date__gte=obj.date)
                    .order_by('date', 'id')
                    .first()
                )
            if t:
                return {
                    'id': t.id,
                    'start': t.start,
                    'end': t.end,
                    'stops': t.stops or [],
                    'date': t.date,
                    'mileage': t.mileage,
                    'cycleUsed': t.cycleUsed,
                    'status': t.status,
                    'polyline': t.polyline,
                }
        except Exception:
            pass
        return None

    def get_approvalStatus(self, obj: ELDLog):
        try:
            # Prefer latest approval status
            ar = obj.approvalrequest_set.order_by('-date', '-id').first()
            return ar.status if ar else None
        except Exception:
            return None

    def get_approvalInfo(self, obj: ELDLog):
        try:
            ar = obj.approvalrequest_set.select_related('supervisor__user').order_by('-date', '-id').first()
            if not ar:
                return None
            sup_user = getattr(ar.supervisor, 'user', None)
            return {
                'status': ar.status,
                'date': ar.date,
                'supervisor': {
                    'username': getattr(sup_user, 'username', None),
                    'name': (sup_user.get_full_name() if sup_user and sup_user.get_full_name() else (getattr(sup_user, 'username', None)))
                }
            }
        except Exception:
            return None

class ApprovalRequestSerializer(serializers.ModelSerializer):
    trip = TripSerializer()
    eldlog = ELDLogSerializer()
    supervisor = SupervisorSerializer()
    class Meta:
        model = ApprovalRequest
        fields = ['id', 'trip', 'eldlog', 'supervisor', 'status', 'date']
