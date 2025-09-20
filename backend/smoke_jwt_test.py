import json
from rest_framework.test import APIClient


def main():
    cl = APIClient()
    r = cl.post('/api/auth/token/', {'username': 'driver1', 'password': 'Test@1234'}, format='json')
    print('TOKEN_DRIVER', r.status_code)
    d = json.loads(r.content.decode() or '{}')
    access = d.get('access')
    print('TOKEN_DRIVER_HAVE_ACCESS', bool(access))
    if not access:
        return
    cl.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    rt = cl.post('/api/trips/submit/', {
        'username': 'driver1',
        'currentLocation': 'Test Current',
        'pickupLocation': 'Test Pickup',
        'dropoffLocation': 'Test Drop',
        'cycleUsed': 5,
        'stops': []
    }, format='json')
    print('TRIP_SUBMIT', rt.status_code)

    re = cl.post('/api/eldlogs/submit/', {'username': 'driver1', 'logEntries': []}, format='json')
    print('ELD_SUBMIT', re.status_code)

    ra = cl.post('/api/approvalrequests/create/', {'username': 'driver1', 'supervisor_username': 'supervisor1'}, format='json')
    print('APPROVAL_CREATE', ra.status_code)

    cl2 = APIClient()
    r2 = cl2.post('/api/auth/token/', {'username': 'supervisor1', 'password': 'Test@1234'}, format='json')
    s = json.loads(r2.content.decode() or '{}')
    sacc = s.get('access')
    print('TOKEN_SUPERVISOR', r2.status_code, bool(sacc))
    if not sacc:
        return
    cl2.credentials(HTTP_AUTHORIZATION=f'Bearer {sacc}')

    rp = cl2.get('/api/approvalrequests/by-supervisor/supervisor1/?status=Pending')
    print('PENDING_LIST', rp.status_code)
    first_id = None
    if rp.status_code == 200:
        try:
            data = json.loads(rp.content.decode() or '[]')
            if isinstance(data, list) and data:
                first_id = data[0].get('id')
                print('FIRST_PENDING_ID', first_id)
            else:
                print('NO_PENDING_ITEMS')
        except Exception as e:
            print('PARSE_ERR', e)

    if first_id:
        ra2 = cl2.post(f'/api/approvalrequests/{first_id}/approve/', {}, format='json')
        print('APPROVE', ra2.status_code)


if __name__ == '__main__':
    main()
