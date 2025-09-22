

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
from typing import Dict

"""
Seed/ensure demo supervisors and drivers using small template helpers
so the structure is consistent and easy to tweak.
"""

# Prefer role constants on the User model if available; fallback to literals
ROLE_SUPERVISOR = getattr(User, 'ROLE_SUPERVISOR', 'supervisor')
ROLE_DRIVER = getattr(User, 'ROLE_DRIVER', 'driver')


def supervisor_defaults(i: int, email: str) -> Dict[str, str]:
    return {
        'office': f'Office {i}',
        'email': email,
    }


def driver_defaults(i: int, supervisor: Supervisor) -> Dict[str, object]:
    # Rotate a simple status pattern: 0 -> Active, 1 -> Resting, 2 -> Off Duty
    mod = i % 3
    if mod == 0:
        status = 'Active'
    elif mod == 1:
        status = 'Resting'
    else:
        status = 'Off Duty'

    mileage = 1000 + i * 50
    cycle_used = (i * 3) % 70
    trips_today = (i % 5) + 1
    phone = f'(555) 123-{1000 + i:04d}'
    recent_trips = [f'Trip #{1200 + i - j} - 9/{18 - j}/2025' for j in range(3)]

    return {
        'license': f'DRV{i:03d}',
        'truck': f'Truck{i}',
        'trailer': f'Trailer{i}',
        'office': supervisor.office,
        'terminal': f'Terminal{i % 3 + 1}',
        'status': status,
        'mileage': mileage,
        'cycleUsed': cycle_used,
        'tripsToday': trips_today,
        'phone': phone,
        'recentTrips': recent_trips,
    }


def seed_supervisors():
    supervisors = []
    for i in range(1, 4):
        username = f'supervisor{i}'
        email = f'supervisor{i}@example.com'
        # Use custom manager to create supervisor with correct permissions
        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create_superuser(username=username, email=email, password='Test@1234')
        else:
            # Ensure demo supervisors have elevated flags
            changed = False
            if not user.is_staff:
                user.is_staff = True
                changed = True
            if not user.is_superuser:
                user.is_superuser = True
                changed = True
            if getattr(user, 'role', None) != ROLE_SUPERVISOR:
                user.role = ROLE_SUPERVISOR
                changed = True
            if changed:
                user.save(update_fields=['is_staff', 'is_superuser', 'role'])
        defaults = supervisor_defaults(i, email)
        supervisor, created = Supervisor.objects.get_or_create(
            user=user,
            defaults=defaults,
        )
        # If already existed, lightly ensure defaults (idempotent updates)
        if not created:
            updates = {}
            for k, v in defaults.items():
                if getattr(supervisor, k, None) != v:
                    setattr(supervisor, k, v)
                    updates[k] = v
            if updates:
                supervisor.save(update_fields=list(updates.keys()))
        supervisors.append(supervisor)
    return supervisors

def seed_drivers(supervisors):
    for i in range(1, 21):
        username = f'driver{i}'
        email = f'driver{i}@example.com'
        # Use custom manager to create driver with correct permissions
        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create_user(
                username=username,
                email=email,
                password='Test@1234',
                role=ROLE_DRIVER,
            )
        elif getattr(user, 'role', None) != ROLE_DRIVER:
            # Keep demo data consistent if role was altered
            user.role = ROLE_DRIVER
            user.save(update_fields=['role'])

        supervisor = supervisors[(i - 1) % len(supervisors)]
        defaults = driver_defaults(i, supervisor)
        driver, created = Driver.objects.get_or_create(
            user=user,
            defaults=defaults,
        )
        if not created:
            updates = {}
            for k, v in defaults.items():
                if getattr(driver, k, None) != v:
                    setattr(driver, k, v)
                    updates[k] = v
            if updates:
                driver.save(update_fields=list(updates.keys()))

if __name__ == '__main__':
    with transaction.atomic():
        supervisors = seed_supervisors()
        seed_drivers(supervisors)
    print('Sample data seeded.')