# Trip Viser

[![CI](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml/badge.svg)](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Full-stack app for trip routing and ELD log visualization.

- Backend: Django + DRF + SimpleJWT + Postgres
- Frontend: React + react-router-dom + react-leaflet
- Versioned API: /api/v1

## Features
- Trip submission with route polyline
- ELD log submission with accept/complete workflow
- Supervisor approvals with scoping to assigned drivers
- Map rendering, auto-refresh, tooltips, and printable daily sheet

## Quickstart (local)

Backend:
- python -m pip install -r requirements.txt
- python manage.py migrate
- python manage.py runserver 127.0.0.1:8000

Frontend:
- cd frontend
- npm install
- npm start

## Configuration
Backend (env):
- SECRET_KEY, DEBUG, ALLOWED_HOSTS
- DATABASE_URL (or POSTGRES_* envs)
- CORS_ALLOWED_ORIGINS

Frontend (env):
- REACT_APP_API_BASE

### Local dev tips (Windows PowerShell)

Set environment variables in PowerShell using `$env:`:

```powershell
$env:DEBUG = 'true'
python manage.py runserver 127.0.0.1:8000 --noreload
```

To unset later:

```powershell
Remove-Item Env:DEBUG
```

Apply migrations locally:

```powershell
python manage.py migrate
python manage.py createsuperuser
```

## Docs
- See docs/BACKEND.md, docs/FRONTEND.md, docs/DEPLOYMENT.md

## Tests
- python manage.py test backend -v 2

## Deployment
- Backend: Render or Fly.io (free tiers)
- DB: Neon or Supabase (free)
- Frontend: Vercel or Netlify (free)
- See docs/DEPLOYMENT.md for step-by-step

### Render (backend) environment

Set these environment variables in your Render Web Service:

- `DEBUG` = `false`
- `ALLOWED_HOSTS` = `trip-viser.onrender.com`
- `SECRET_KEY` = a long random string
- `DATABASE_URL` = your Render Postgres URL
- `FRONTEND_URL` = your deployed frontend URL (optional; if set, `GET /` redirects here)
- `CORS_ALLOWED_ORIGINS` = your frontend origin, e.g. `https://your-frontend.example`

Optional security flags (only if fully on HTTPS):

- `SECURE_SSL_REDIRECT` = `true`
- `SECURE_HSTS_SECONDS` = `31536000`
- `SECURE_HSTS_INCLUDE_SUBDOMAINS` = `true`
- `SECURE_HSTS_PRELOAD` = `true`

Health check path: `/api/health/`

Root path behavior:

- `GET /` serves a minimal landing page with links to `/api/health/`, `/api/schema/`, and `/admin/`.
- If `FRONTEND_URL` is set, `GET /` redirects to that URL (recommended when frontend is hosted on Vercel/Netlify).

## License

This project is licensed under the MIT License. See the LICENSE file for details.