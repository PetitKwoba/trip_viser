import React from 'react';
import { render, screen } from '@testing-library/react';
import { wrapWithRouter } from './testUtils/router';
import App from './App';

test('renders login form', () => {
  render(wrapWithRouter(React.createElement(App, null)));
  // Be specific to avoid multiple matches (heading and button)
  expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
});
