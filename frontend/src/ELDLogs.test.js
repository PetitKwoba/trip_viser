import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ELDLogs from './ELDLogs';

describe('ELDLogs component', () => {
  test('renders ELDLogs and route directions', async () => {
    render(
      React.createElement(ELDLogs, { username: 'testuser', role: 'driver', eldLogs: {}, windowWidth: 800 })
    );
    expect(screen.getByText(/ELD Logs for testuser/i)).toBeInTheDocument();
    expect(screen.getByText(/Route Directions/i)).toBeInTheDocument();
    expect(screen.getByText(/Start at New York, NY/i)).toBeInTheDocument();
  });
});
