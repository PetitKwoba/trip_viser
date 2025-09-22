import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the api.js functions BEFORE importing App so mocks are applied
jest.mock('./api', () => ({
  obtainToken: async () => ({ access: 'fake', refresh: 'fake' }),
  loginUser: async (username, password) => {
    if (username === 'testuser' && password === 'password') {
      return { role: 'driver', username: 'testuser' };
    }
    throw new Error('Invalid credentials');
  },
  getUserRole: async (username) => {
    if (username === 'testuser') return { role: 'driver' };
    return { role: 'supervisor' };
  },
}));

// Spy navigate to assert routing without relying on rendering the target page
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Import after mocks applied
const { wrapWithRouter } = require('./testUtils/router');
const App = require('./App').default;

beforeEach(() => {
  mockNavigate.mockReset();
  window.alert.mockClear?.();
});

describe('App authentication and routing', () => {
  test('renders login form and logs in with valid credentials', async () => {
    render(wrapWithRouter(React.createElement(App, null), { initialEntries: ['/login'] }));
    // Check the login heading specifically to avoid multiple matches
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    // After successful login, app will navigate to dashboard or role-based default
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
      const calls = mockNavigate.mock.calls.map(args => args[0]);
      expect(calls.some(d => d === '/dashboard' || d === '/driver')).toBe(true);
    });
  });

  test('shows error on invalid login', async () => {
    render(wrapWithRouter(React.createElement(App, null), { initialEntries: ['/login'] }));
    fireEvent.change(screen.getByPlaceholderText(/Username/i), { target: { value: 'wronguser' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    // Should not navigate on failed login; alert is shown
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalled();
    });
  });
});
