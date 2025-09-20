# Trip Viser

[![CI](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml/badge.svg)](https://github.com/PetitKwoba/trip_viser/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Note: Replace OWNER/REPO in the CI badge URL after pushing to GitHub.

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

## Docs
- See docs/BACKEND.md, docs/FRONTEND.md, docs/DEPLOYMENT.md

## Tests
- python manage.py test backend -v 2

## Deployment
- Backend: Render or Fly.io (free tiers)
- DB: Neon or Supabase (free)
- Frontend: Vercel or Netlify (free)
- See docs/DEPLOYMENT.md for step-by-step

## License

This project is licensed under the MIT License. See the LICENSE file for details.