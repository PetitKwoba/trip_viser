import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Wraps children in MemoryRouter with React Router v7 future flags enabled
export function wrapWithRouter(children, options = {}) {
  const future = { v7_startTransition: true, v7_relativeSplatPath: true };
  const props = { future, ...options };
  return React.createElement(MemoryRouter, props, children);
}
