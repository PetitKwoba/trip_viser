# Trip Viser

[![CI](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml/badge.svg)](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Full-stack app for trip routing and ELD log visualization.

- Backend: Django + DRF + SimpleJWT + Postgres
- Frontend: React + react-router-dom + react-leaflet
- Versioned API: /api/v1
 - Mobile-friendly UI with responsive navbar and tables

Demo video:
- Watch on Loom: https://www.loom.com/share/e47c6ea5b1014472a3d86b6fb52dc0aa?sid=106d0a04-3d3f-4da7-9bd9-5fd8d6590858

## Features
- Trip submission with route polyline
- ELD log submission with accept/complete workflow
- Supervisor approvals with scoping to assigned drivers
- Map rendering, auto-refresh, tooltips, and printable daily sheet
 - Responsive navigation (hamburger on small screens) and mobile-first layouts

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
	- When set, all frontend API calls are prefixed (e.g., https://trip-viser.onrender.com)
	- A `.env.sample` is provided in `frontend/` and `.env.development.local` can be used for local dev

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

### Seed demo users (23 total)

Run this to create or ensure 3 supervisors and 20 drivers with password `Test@1234`:

```powershell
python manage.py seed_demo
```

Accounts created/ensured:
- Supervisors: `supervisor1`, `supervisor2`, `supervisor3` (all staff+superuser, role=supervisor)
- Drivers: `driver1` … `driver20` (role=driver)

## Docs
- See docs/BACKEND.md, docs/FRONTEND.md, docs/DEPLOYMENT.md

## Tests
- python manage.py test backend -v 2

## Deployment
- Backend: Render or Fly.io (free tiers)
- DB: Neon or Supabase (free)
- Frontend: Vercel or Netlify (free)
- See docs/DEPLOYMENT.md for step-by-step

### Vercel (frontend) quick setup

1. Import this repo in Vercel → select Root Directory: `frontend/`.
2. Framework: Create React App (auto-detected). Node.js Version: 18.x.
3. Build Command: `npm run build` • Output Directory: `build`.
4. Env var optional: you can set `REACT_APP_API_BASE` to your backend URL, or rely on `frontend/vercel.json` rewrite which proxies `/api/*` to the backend.
5. Deploy, then add your Vercel origin to backend `CORS_ALLOWED_ORIGINS` (Render).
6. Optional: set `FRONTEND_URL` on the backend so GET `/` redirects to the UI.

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

### Seeding demo data on Render (no shell access)

If you cannot access Render Shell, you can trigger seeding during deploys:

1. In Render → Environment → add `SEED_DEMO=true` (temporarily).
2. Redeploy. During build, the service will run `python backend/seed_sample_data.py` and create:
	- 3 supervisors: `supervisor1..3` (password `Test@1234`)
	- 20 drivers: `driver1..20` (password `Test@1234`)
3. Remove `SEED_DEMO` or set it to `false` after seeding to avoid re-running on future deploys.

Notes:
- The auth endpoints are available under both unversioned (`/api/auth/token/`) and versioned (`/api/v1/auth/token/`) paths for compatibility.
- On cold starts (free tiers), the frontend retries token requests once to tolerate wake-up delays.

## Screenshots

### Supervisor Dashboard
![Supervisor Dashboard](docs/screenshots/supervisor%20dashboard.png)

### Driver Dashboard
![Driver Dashboard](docs/screenshots/driver%20dashboard.png)

### ELD Logs (with map polyline)
![ELD Logs](docs/screenshots/ELD%20logs.png)


## License

This project is licensed under the MIT License. See the LICENSE file for details.