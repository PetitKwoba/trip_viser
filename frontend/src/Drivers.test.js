import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// IMPORTANT: mock before importing the component so it picks up the mock
jest.mock('./api', () => ({
  // Use a plain async function instead of jest.fn so CRA's resetMocks doesn't clear implementation
  getDrivers: async () => ([
    { id: 1, name: 'John Doe', license: 'A1234567', truck: 'Truck 12', trailer: 'Trailer 7', office: 'Main Office', terminal: 'Terminal 1', status: 'Active' },
    { id: 2, name: 'Jane Smith', license: 'B7654321', truck: 'Truck 8', trailer: 'Trailer 3', office: 'Branch Office', terminal: 'Terminal 2', status: 'Resting' }
  ])
}));

import Drivers from './Drivers';

describe('Drivers component', () => {
  test('renders drivers table and displays driver names', async () => {
    render(React.createElement(Drivers, null));
    await waitFor(() => expect(screen.getByText(/john doe/i)).toBeInTheDocument());
    expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
  });

  test('shows loading and handles error', async () => {
    jest.spyOn(require('./api'), 'getDrivers').mockImplementationOnce(async () => { throw new Error('API error'); });
    render(React.createElement(Drivers, null));
    await waitFor(() => expect(screen.getByText(/failed to load drivers/i)).toBeInTheDocument());
  });
});
