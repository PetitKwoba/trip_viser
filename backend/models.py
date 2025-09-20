
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, username, email, password=None, role=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        # Ensure role is always a valid choice; default to 'driver' if not provided/invalid
        valid_roles = {choice[0] for choice in self.model.ROLE_CHOICES}
        if role not in valid_roles:
            role = 'driver'
        user = self.model(username=username, email=email, role=role, **extra_fields)
        user.set_password(password)
        if role == 'supervisor':
            # Supervisors are staff, but not superusers by default
            user.is_staff = True
            user.is_superuser = False
        else:
            user.is_staff = False
            user.is_superuser = False
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'supervisor')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = (
        ('driver', 'Driver'),
        ('supervisor', 'Supervisor'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='driver')
    email = models.EmailField(unique=True)

    objects = UserManager()

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"

class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    supervisor = models.ForeignKey('Supervisor', on_delete=models.SET_NULL, null=True, blank=True, related_name='drivers')
    license = models.CharField(max_length=32)
    truck = models.CharField(max_length=32)
    trailer = models.CharField(max_length=32)
    office = models.CharField(max_length=64, blank=True)
    terminal = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, default='Active')
    mileage = models.IntegerField(default=0)
    cycleUsed = models.IntegerField(default=0)
    tripsToday = models.IntegerField(default=0)
    phone = models.CharField(max_length=32, blank=True)
    recentTrips = models.JSONField(default=list, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['supervisor']),
            models.Index(fields=['office']),
            models.Index(fields=['terminal']),
        ]

    def __str__(self) -> str:
        return f"Driver:{self.user.username}#{self.pk}"

class Supervisor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='supervisor_profile')
    office = models.CharField(max_length=64, blank=True)
    email = models.EmailField()

    def __str__(self) -> str:
        return f"Supervisor:{self.user.username}"

class Trip(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    start = models.CharField(max_length=128)
    end = models.CharField(max_length=128)
    stops = models.JSONField(default=list)
    date = models.DateField(auto_now_add=True)
    mileage = models.IntegerField(default=0)
    cycleUsed = models.IntegerField(default=0)
    status = models.CharField(max_length=32, default='Pending')
    # Optional encoded polyline (OSRM/Google-like) for the route geometry
    polyline = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['driver']),
            models.Index(fields=['date']),
            models.Index(fields=['status']),
        ]

    def __str__(self) -> str:
        return f"Trip:{self.driver.user.username}@{self.date} {self.start}->{self.end}"
class ELDLog(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    logEntries = models.JSONField(default=list)  # [{start, end, status}]
    trip = models.ForeignKey(Trip, on_delete=models.SET_NULL, null=True, blank=True, related_name='eldlogs')
    STATUS_CHOICES = (
        ('Submitted', 'Submitted'),
        ('Accepted', 'Accepted'),
        ('Completed', 'Completed'),
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='Submitted')

    class Meta:
        indexes = [
            models.Index(fields=['driver']),
            models.Index(fields=['date']),
            models.Index(fields=['status']),
            models.Index(fields=['trip']),
        ]

    def __str__(self) -> str:
        return f"ELDLog:{self.driver.user.username}@{self.date} [{self.status}]"

class ApprovalRequest(models.Model):
    trip = models.ForeignKey('Trip', on_delete=models.CASCADE)
    eldlog = models.ForeignKey(ELDLog, on_delete=models.CASCADE)
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE)
    status = models.CharField(max_length=32, default='Pending')
    date = models.DateField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['supervisor']),
            models.Index(fields=['status']),
            models.Index(fields=['date']),
        ]
        constraints = [
            # Prevent multiple Pending approvals for the same trip/log pair
            models.UniqueConstraint(
                fields=['trip', 'eldlog', 'status'],
                name='uniq_pending_trip_eldlog',
                condition=Q(status='Pending')
            )
        ]

    def __str__(self) -> str:
        return f"Approval:{self.eldlog_id}->{self.supervisor.user.username} [{self.status}]"
