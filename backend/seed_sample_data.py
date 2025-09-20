

import os
import sys
import django


# Ensure project root is in sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.models import User, Driver, Supervisor
from django.db import transaction



def seed_supervisors():
    supervisors = []
    for i in range(1, 4):
        username = f'supervisor{i}'
        email = f'supervisor{i}@example.com'
        # Use custom manager to create supervisor with correct permissions
        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create_superuser(username=username, email=email, password='Test@1234')
        supervisor, _ = Supervisor.objects.get_or_create(
            user=user,
            defaults={
                'office': f'Office {i}',
                'email': email
            }
        )
        supervisors.append(supervisor)
    return supervisors

def seed_drivers(supervisors):
    for i in range(1, 21):
        username = f'driver{i}'
        email = f'driver{i}@example.com'
        # Use custom manager to create driver with correct permissions
        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create_user(username=username, email=email, password='Test@1234', role='driver')
        supervisor = supervisors[(i - 1) % len(supervisors)]
        mileage = 1000 + i * 50
        cycle_used = (i * 3) % 70
        trips_today = i % 5 + 1
        status = 'Active' if i % 3 != 0 else 'Resting' if i % 3 == 1 else 'Off Duty'
        phone = f'(555) 123-{1000+i:04d}'
        recent_trips = [f'Trip #{1200+i-j} - 9/{18-j}/2025' for j in range(3)]
        Driver.objects.get_or_create(
            user=user,
            defaults={
                'license': f'DRV{i:03d}',
                'truck': f'Truck{i}',
                'trailer': f'Trailer{i}',
                'office': supervisor.office,
                'terminal': f'Terminal{i%3+1}',
                'status': status,
                'mileage': mileage,
                'cycleUsed': cycle_used,
                'tripsToday': trips_today,
                'phone': phone,
                'recentTrips': recent_trips,
            }
        )

if __name__ == '__main__':
    with transaction.atomic():
        supervisors = seed_supervisors()
        seed_drivers(supervisors)
    print('Sample data seeded.')