import json
from django.core.management.base import BaseCommand
from rest_framework.test import APIClient


class Command(BaseCommand):
    help = "Smoke test JWT token flow: token obtain, submit trip/log, create and approve request"

    def handle(self, *args, **options):
        def out(label, value):
            self.stdout.write(f"{label}: {value}")

        # Driver token
        cl = APIClient()
        r = cl.post('/api/auth/token/', {'username': 'driver1', 'password': 'Test@1234'}, format='json')
        out('TOKEN_DRIVER_STATUS', r.status_code)
        d = {}
        try:
            d = r.json()
        except Exception:
            try:
                d = json.loads(r.content.decode() or '{}')
            except Exception:
                d = {}
        access = d.get('access')
        out('TOKEN_DRIVER_HAVE_ACCESS', bool(access))
        if not access:
            return
        cl.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

        # Submit Trip
        rt = cl.post('/api/trips/submit/', {
            'username': 'driver1',
            'currentLocation': 'Test Current',
            'pickupLocation': 'Test Pickup',
            'dropoffLocation': 'Test Drop',
            'cycleUsed': 5,
            'stops': []
        }, format='json')
        out('TRIP_SUBMIT_STATUS', rt.status_code)

        # Submit ELD Log
        re = cl.post('/api/eldlogs/submit/', {'username': 'driver1', 'logEntries': []}, format='json')
        out('ELD_SUBMIT_STATUS', re.status_code)

        # Create approval request
        ra = cl.post('/api/approvalrequests/create/', {'username': 'driver1', 'supervisor_username': 'supervisor1'}, format='json')
        out('APPROVAL_CREATE_STATUS', ra.status_code)

        # Supervisor token
        cl2 = APIClient()
        r2 = cl2.post('/api/auth/token/', {'username': 'supervisor1', 'password': 'Test@1234'}, format='json')
        s = {}
        try:
            s = r2.json()
        except Exception:
            try:
                s = json.loads(r2.content.decode() or '{}')
            except Exception:
                s = {}
        sacc = s.get('access')
        out('TOKEN_SUPERVISOR_STATUS', r2.status_code)
        out('TOKEN_SUPERVISOR_HAVE_ACCESS', bool(sacc))
        if not sacc:
            return
        cl2.credentials(HTTP_AUTHORIZATION=f'Bearer {sacc}')

        # List pending
        rp = cl2.get('/api/approvalrequests/by-supervisor/supervisor1/?status=Pending')
        out('PENDING_LIST_STATUS', rp.status_code)
        first_id = None
        if rp.status_code == 200:
            try:
                data = rp.json()
            except Exception:
                try:
                    data = json.loads(rp.content.decode() or '[]')
                except Exception:
                    data = []
            if isinstance(data, list) and data:
                first_id = data[0].get('id')
                out('FIRST_PENDING_ID', first_id)
            else:
                out('FIRST_PENDING_ID', None)

        if first_id:
            ra2 = cl2.post(f'/api/approvalrequests/{first_id}/approve/', {}, format='json')
            out('APPROVE_STATUS', ra2.status_code)
