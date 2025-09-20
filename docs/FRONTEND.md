# Frontend (React)

## Overview
- React app consuming the versioned API at /api/v1
- Uses react-router-dom, react-leaflet for map, and auth-aware API client
 - Mobile-responsive UI and navbar (hamburger on small screens)

## Core screens
- Login
- Driver Dashboard: trip submission, ELD submission, daily timesheet print
- Supervisor Dashboard: pending approvals, driver selector, ELD logs by driver
- ELD Logs page: pagination, auto-refresh, tooltips, map with decoded polyline

## API integration
- Centralized api.js with token handling and refresh
- Endpoints for trips submit, ELD submit/accept/complete, drivers list, approvals create/list
 - API base is configurable via `REACT_APP_API_BASE`; if unset in production, `vercel.json` rewrites `/api/*` to the backend

## Map integration
- Decode saved polyline and render via react-leaflet Polyline
- OSRM used on submission stage to compute and store polyline

## Supervisor controls
- Driver selector visible only for supervisors
- Client-side gating mirrors server rules (Accept disabled until approved)

## Local dev
- cd frontend
- npm install
- npm start
- Ensure REACT_APP_API_BASE points to backend (http://127.0.0.1:8000) or copy `.env.sample` to `.env.development.local`

