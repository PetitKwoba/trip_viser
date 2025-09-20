# Trip Viser Backend

Django backend for Trip Viser app.

## API Endpoints
- /api/users/
- /api/drivers/
- /api/supervisors/
- /api/trips/
- /api/eldlogs/
- /api/approvalrequests/
- /api/auth/login/

## Models
- User (role, email, password)
- Driver (user, license, truck, trailer, office, terminal, status, mileage, cycleUsed, tripsToday)
- Supervisor (user, office, email)
- Trip (driver, start, end, stops, date, mileage, cycleUsed, status)
- ELDLog (driver, date, logEntries)
- ApprovalRequest (trip, eldlog, supervisor, status, date)

## Setup
1. Install dependencies: `pip install django djangorestframework psycopg2-binary`
2. Configure PostgreSQL in settings.py
3. Run migrations: `python manage.py makemigrations backend && python manage.py migrate`
4. Create superuser: `python manage.py createsuperuser`
5. Start server: `python manage.py runserver`
