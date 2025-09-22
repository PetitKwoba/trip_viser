import React from 'react';
import { authorizedFetch, setAccessToken } from './api';

// Helper to mock fetch responses in sequence
function mockFetchSequence(responses) {
  let call = 0;
  global.fetch = jest.fn(() => {
    const next = responses[Math.min(call, responses.length - 1)];
    call++;
    if (typeof next === 'function') return next();
    const { status = 200, ok = status >= 200 && status < 300, json = async () => ({}) } = next || {};
    return Promise.resolve({ status, ok, json });
  });
}

describe('authorizedFetch token refresh', () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
  });

  test('retries once after 401 by refreshing access token', async () => {
    // Seed tokens
    window.localStorage.setItem('refreshToken', 'refresh-xyz');
    setAccessToken('expired-token');

    // First call returns 401, refresh endpoint returns new access, retry returns 200
    mockFetchSequence([
      { status: 401, ok: false, json: async () => ({ detail: 'Unauthorized' }) },
      // Refresh call
      { status: 200, ok: true, json: async () => ({ access: 'new-access' }) },
      // Retried original call
      { status: 200, ok: true, json: async () => ({ success: true }) },
    ]);

    const res = await authorizedFetch('/api/protected/', { method: 'GET' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    // Ensure the new access token is stored
    expect(window.localStorage.getItem('accessToken')).toBe('new-access');
  });

  test('returns original 401 when refresh fails', async () => {
    setAccessToken('expired-token');
    // No refresh token -> refreshAccessToken will fail
    mockFetchSequence([
      { status: 401, ok: false, json: async () => ({ detail: 'Unauthorized' }) },
    ]);

    const res = await authorizedFetch('/api/protected/', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});
