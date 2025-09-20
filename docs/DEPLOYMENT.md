# Deployment Guide (Free Options)

This guide explains how to deploy Trip Viser for free, using popular free tiers.

## Components
- Backend: Django + DRF + SimpleJWT
- Database: PostgreSQL
- Frontend: React

## Free-tier options at a glance
- Backend hosting: Render (free web service), Fly.io (free allowances)
- Database: Neon.tech (serverless free tier) or Supabase (free tier)
- Frontend hosting: Vercel or Netlify (both free tiers)

---

## 1) Provision a free Postgres

Option A: Neon
- Create a project and database
- Create a database user/password
- Get the connection string (postgres://USER:PASSWORD@HOST/DB?sslmode=require)

Option B: Supabase
- Create a project
- Under Database > Connection, copy the connection string

Set DATABASE_URL for the backend:
- Example: DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require


## 2) Backend (Django) on Render (free)

- Create a new Web Service in Render
- Connect your Git repo
- Build command: pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
- Start command: python manage.py migrate --noinput && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
- Environment:
  - SECRET_KEY: (generate a strong random string)
  - DEBUG: false
  - ALLOWED_HOSTS: your-service.onrender.com
  - DATABASE_URL: from Neon/Supabase
  - CORS_ALLOWED_ORIGINS: https://your-frontend.vercel.app
- Add a Render “Environment” of Python 3.13 if available, else system Python is fine

Optional: render.yaml
- You can use the provided render.yaml to one-click set up the service with build/start commands and env vars. In Render, choose “Blueprint” and point to this file.

Static files
- Our settings include WhiteNoise to serve static files (collectstatic run is optional for APIs but safe to keep).


## 3) Backend (Django) on Fly.io (free allowances)

- Install flyctl
- fly launch (choose Dockerfile, set app name)
- Add env vars:
  - fly secrets set SECRET_KEY=... DEBUG=false ALLOWED_HOSTS=yourapp.fly.dev DATABASE_URL=...
- Deploy: fly deploy


## 4) Frontend (React) on Vercel (free)

- Push your frontend folder, or keep monorepo and specify the frontend path
- Framework preset: Create React App
- Build command: npm install && npm run build
- Output directory: frontend/build
- Environment variables:
  - REACT_APP_API_BASE=https://your-backend-host
  - Alternatively, rely on vercel.json rewrite for `/api/*` without setting this env

Node version note:
- Create React App v5 targets Node 14/16/18. For best compatibility with React 19 in CRA, pin Node 18 in Vercel project settings.

Alternatively on Netlify:
- Build command: npm run build
- Publish directory: frontend/build
- Set environment variables similarly


## 5) Local development parity

- Backend env file (.env):
  SECRET_KEY=dev-secret
  DEBUG=true
  ALLOWED_HOSTS=*
  DATABASE_URL=postgres://postgres:password@localhost:5432/tripviser
  CORS_ALLOWED_ORIGINS=http://localhost:3000

- Frontend env: .env
  REACT_APP_API_BASE=http://127.0.0.1:8000


## 6) Post-deploy checklist
- Confirm /api/health returns {"status": "ok"}
- Confirm JWT token issue/refresh endpoints work
- Ensure supervisor-only access enforced for ELD logs
- Confirm CORS works from frontend URL
- Create initial staff/superuser and login to /admin

