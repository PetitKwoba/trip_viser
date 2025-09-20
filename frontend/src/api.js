// Get a single driver by username from backend API
export async function getDriverByUsername(username) {
  try {
    // Use RESTful username detail route (backed by lookup_field on DriverViewSet)
    const res = await authorizedFetch(`/api/v1/drivers/${encodeURIComponent(username)}/`);
    if (!res.ok) throw new Error('Failed to fetch driver');
    return await res.json();
  } catch (err) {
    console.error('Get driver error:', err);
    throw err;
  }
}
// Get all supervisors from backend API (future use)
export async function getSupervisors() {
  try {
    const res = await authorizedFetch('/api/supervisors/');
    if (!res.ok) throw new Error('Failed to fetch supervisors');
    return await res.json();
  } catch (err) {
    console.error('Get supervisors error:', err);
    throw err;
  }
}
// Get all approval requests from backend API (future use)
export async function getApprovalRequests() {
  try {
    const res = await authorizedFetch('/api/approvalrequests/');
    if (!res.ok) throw new Error('Failed to fetch approval requests');
    return await res.json();
  } catch (err) {
    console.error('Get approval requests error:', err);
    throw err;
  }
}
// Get all trips from backend API (future use)
export async function getTrips() {
  try {
    const res = await authorizedFetch('/api/trips/');
    if (!res.ok) throw new Error('Failed to fetch trips');
    return await res.json();
  } catch (err) {
    console.error('Get trips error:', err);
    throw err;
  }
}
// Get all ELD logs from backend API (future use)
export async function getELDLogs() {
  try {
    const res = await authorizedFetch('/api/v1/eldlogs/');
    if (!res.ok) throw new Error('Failed to fetch ELD logs');
    return await res.json();
  } catch (err) {
    console.error('Get ELD logs error:', err);
    throw err;
  }
}
// Get a user's recent trips by username
export async function getTripsByUsername(username, limit = 5, page, pageSize) {
  try {
    const qs = new URLSearchParams();
    if (limit != null) qs.set('limit', String(limit));
    if (page != null) qs.set('page', String(page));
    if (pageSize != null) qs.set('page_size', String(pageSize));
    const res = await authorizedFetch(`/api/trips/by-username/${encodeURIComponent(username)}/?${qs.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch user trips');
    return await res.json();
  } catch (err) {
    console.error('Get trips by username error:', err);
    throw err;
  }
}

// Get a user's ELD logs by username
export async function getELDLogsByUsername(username, limit = 5, page, pageSize, opts = {}) {
  try {
    const qs = new URLSearchParams();
    if (limit != null) qs.set('limit', String(limit));
    if (page != null) qs.set('page', String(page));
    if (pageSize != null) qs.set('page_size', String(pageSize));
    if (opts.date) qs.set('date', String(opts.date));
    if (opts.from) qs.set('from', String(opts.from));
    if (opts.to) qs.set('to', String(opts.to));
    const res = await authorizedFetch(`/api/v1/eldlogs/by-username/${encodeURIComponent(username)}/?${qs.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch user logs');
    return await res.json();
  } catch (err) {
    console.error('Get ELD logs by username error:', err);
    throw err;
  }
}

// --- Auth helpers ---
// Allow overriding the API base (e.g., point to live backend) via env var
const API_BASE = process.env.REACT_APP_API_BASE || '';
const withBase = (url) => (API_BASE && url.startsWith('/')) ? `${API_BASE}${url}` : url;
let accessToken = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('accessToken') : null;
export function setAccessToken(token) {
  accessToken = token;
  try { window.localStorage.setItem('accessToken', token); } catch {}
}
export function clearAccessToken() {
  accessToken = null;
  try { window.localStorage.removeItem('accessToken'); } catch {}
}
function authHeaders() {
  return accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {};
}

// Attempt to refresh access token using stored refresh token
export async function refreshAccessToken() {
  try {
    const refresh = window.localStorage.getItem('refreshToken');
    if (!refresh) return false;
    const doFetch = async () => fetch(withBase('/api/auth/token/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    let res = await doFetch();
    // Handle Render waking interstitial (non-JSON or 5xx)
    let data;
    try {
      const isJson = res.headers.get('content-type')?.includes('application/json');
      data = isJson ? await res.json() : null;
    } catch {}
    if (!res.ok || !data) {
      await new Promise(r => setTimeout(r, 1500));
      res = await doFetch();
      try {
        const isJson2 = res.headers.get('content-type')?.includes('application/json');
        data = isJson2 ? await res.json() : null;
      } catch {}
      if (!res.ok || !data) return false;
    }
    if (data?.access) {
      setAccessToken(data.access);
      return true;
    }
  } catch (err) {
    console.error('Refresh token error:', err);
  }
  return false;
}

// Wrapper to add Authorization and retry once on 401 by refreshing token
export async function authorizedFetch(url, options = {}, retry = true) {
  const opts = { ...(options || {}) };
  const headers = { ...(opts.headers || {}), ...authHeaders() };
  opts.headers = headers;
  const res = await fetch(withBase(url), opts);
  if (res.status !== 401 || !retry) return res;
  // Try refresh and retry once
  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;
  const retryOpts = { ...(options || {}) };
  retryOpts.headers = { ...(retryOpts.headers || {}), ...authHeaders() };
  return fetch(withBase(url), retryOpts);
}

// Obtain JWT token pair and store access token
export async function obtainToken(username, password) {
  try {
    const doFetch = async () => fetch(withBase('/api/auth/token/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    let res = await doFetch();
    let data;
    try {
      const isJson = res.headers.get('content-type')?.includes('application/json');
      data = isJson ? await res.json() : null;
    } catch {}
    if (!res.ok || !data) {
      // Likely backend waking up; retry once after short delay
      await new Promise(r => setTimeout(r, 1500));
      res = await doFetch();
      try {
        const isJson2 = res.headers.get('content-type')?.includes('application/json');
        data = isJson2 ? await res.json() : null;
      } catch {}
      if (!res.ok || !data) throw new Error('Failed to obtain token');
    }
    // { access, refresh }
    if (data?.access) setAccessToken(data.access);
    return data;
  } catch (err) {
    console.error('Obtain token error:', err);
    throw err;
  }
}

// --- Approval Requests API ---
export async function createApprovalRequest({ username, supervisorUsername }) {
  try {
    const res = await authorizedFetch('/api/approvalrequests/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, supervisor_username: supervisorUsername })
    });
    if (!res.ok) throw new Error('Failed to create approval request');
    return await res.json();
  } catch (err) {
    console.error('Create approval request error:', err);
    throw err;
  }
}

export async function getPendingApprovalRequestsBySupervisor(supervisorUsername) {
  try {
    const res = await authorizedFetch(`/api/approvalrequests/by-supervisor/${encodeURIComponent(supervisorUsername)}/?status=Pending`);
    if (!res.ok) throw new Error('Failed to fetch pending approval requests');
    return await res.json();
  } catch (err) {
    console.error('Get pending approvals error:', err);
    throw err;
  }
}

export async function approveApprovalRequest(id) {
  try {
    const res = await authorizedFetch(`/api/approvalrequests/${encodeURIComponent(id)}/approve/`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to approve request');
    return await res.json();
  } catch (err) {
    console.error('Approve request error:', err);
    throw err;
  }
}

export async function rejectApprovalRequest(id) {
  try {
    const res = await authorizedFetch(`/api/approvalrequests/${encodeURIComponent(id)}/reject/`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reject request');
    return await res.json();
  } catch (err) {
    console.error('Reject request error:', err);
    throw err;
  }
}
// Submit a trip for a username
export async function submitTrip(payload) {
  try {
    const res = await authorizedFetch('/api/trips/submit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to submit trip');
    return await res.json();
  } catch (err) {
    console.error('Submit trip error:', err);
    throw err;
  }
}

// Submit an ELD log for a username
export async function submitELDLog(payload) {
  try {
    const res = await authorizedFetch('/api/eldlogs/submit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to submit ELD log');
    return await res.json();
  } catch (err) {
    console.error('Submit ELD log error:', err);
    throw err;
  }
}

// Accept an ELD log (driver self)
export async function acceptELDLog(id) {
  try {
    const res = await authorizedFetch(`/api/v1/eldlogs/${encodeURIComponent(id)}/accept/`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to accept ELD log');
    return await res.json();
  } catch (err) {
    console.error('Accept ELD log error:', err);
    throw err;
  }
}

// Complete an ELD log (driver self)
export async function completeELDLog(id) {
  try {
    const res = await authorizedFetch(`/api/v1/eldlogs/${encodeURIComponent(id)}/complete/`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to complete ELD log');
    return await res.json();
  } catch (err) {
    console.error('Complete ELD log error:', err);
    throw err;
  }
}
// Get all drivers from backend API
export async function getDrivers() {
  try {
    const res = await authorizedFetch('/api/drivers/');
    if (!res.ok) throw new Error('Failed to fetch drivers');
    return await res.json();
  } catch (err) {
    console.error('Get drivers error:', err);
    throw err;
  }
}
// Get leaderboard (top N and current user rank)
export async function getLeaderboard(username, limit = 5, period) {
  try {
    const qs = new URLSearchParams();
    if (username) qs.set('username', username);
    if (limit != null) qs.set('limit', String(limit));
    if (period) qs.set('period', String(period));
    const res = await authorizedFetch(`/api/v1/drivers/leaderboard/?${qs.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return await res.json();
  } catch (err) {
    console.error('Get leaderboard error:', err);
    throw err;
  }
}
// Centralized API utility for Trip Viser frontend
// All API calls should be made through these functions for consistency and error handling

export async function loginUser(username, password) {
  try {
    const res = await fetch(withBase('/api/auth/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    // Expecting { role, username } in response
    return data;
  } catch (err) {
    // Log error for debugging
    console.error('Login error:', err);
    throw err;
  }
}

export async function getUserRole(username) {
  try {
    const res = await authorizedFetch(`/api/users/by-username/${encodeURIComponent(username)}/role/`);
    if (!res.ok) throw new Error('Failed to fetch user role');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Get user role error:', err);
    throw err;
  }
}

// Add more API functions as needed for drivers, supervisors, trips, approvalrequests, eldlogs, etc.
