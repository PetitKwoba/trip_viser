from django.core.management.base import BaseCommand
from django.db import transaction

from backend.seed_sample_data import seed_supervisors, seed_drivers
from backend.models import User, Driver, Supervisor


class Command(BaseCommand):
    help = "Seed 3 supervisors and 20 drivers for demo (idempotent). Password: Test@1234"

    def handle(self, *args, **options):
        with transaction.atomic():
            supervisors = seed_supervisors()
            seed_drivers(supervisors)

        self.stdout.write(self.style.SUCCESS("Demo users seeded or ensured."))

        # Report counts
        total_users = User.objects.count()
        total_supervisors = Supervisor.objects.count()
        total_drivers = Driver.objects.count()
        self.stdout.write(f"Users: {total_users} | Supervisors: {total_supervisors} | Drivers: {total_drivers}")
