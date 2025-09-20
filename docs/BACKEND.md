# Backend (Django + DRF)

## Overview
- Django 5 + DRF
- JWT via djangorestframework-simplejwt
- Postgres database
- Versioned API at /api/v1

## Models
- User (custom): role in {driver, supervisor}
- Driver: one-to-one with User; supervisor FK
- Supervisor: one-to-one with User
- Trip: driver FK, route fields, polyline
- ELDLog: driver FK, trip FK, status {Submitted, Accepted, Completed}
- ApprovalRequest: links trip + ELDLog to a supervisor with status

## Endpoints (high-level)
- Auth: /api/v1/auth/token, /refresh, /verify
- Users: /api/v1/users/
- Drivers: CRUD, by-username, leaderboard, assign-supervisor
- Trips: submit, by-username
- ELDLogs: submit, accept, complete, by-username
- ApprovalRequests: create, by-supervisor, approve, reject
- Health: /api/health
- OpenAPI: /api/schema (JSON)

## Permissions & workflow
- IsSelfOrSupervisor for driver/ELD retrieval
- Supervisors can only view ELD logs for their assigned drivers
- ELD accept requires Submitted + an Approved approval
- ELD complete requires Accepted
- Approve/Reject restricted to assigned supervisor or superuser

## Settings
- Env-based: SECRET_KEY, DEBUG, ALLOWED_HOSTS, DATABASE_URL
- SimpleJWT configured for access/refresh tokens
- WhiteNoise for static; CORS configured
- Cache defaults to locmem; can use Redis/Memcached via env

## Performance
- Database indexes on common filters
- Conditional unique constraint preventing duplicate pending approvals
- Queryset select_related/prefetch_related for hot-path endpoints

## Running locally
- python -m pip install -r requirements.txt
- python manage.py migrate
- python manage.py runserver 127.0.0.1:8000

## Tests
- Manage via Django test runner: python manage.py test backend -v 2
- Includes leaderboard and ELD workflow tests

