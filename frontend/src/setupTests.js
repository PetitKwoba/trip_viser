// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock react-leaflet (ESM) for Jest (CommonJS) environment
jest.mock('react-leaflet', () => {
	const React = require('react');
	const Div = ({ children }) => React.createElement('div', null, children);
	return {
		MapContainer: Div,
		TileLayer: () => null,
		Polyline: () => null,
		Marker: Div,
		Popup: Div,
		useMap: () => ({ setView: () => {} }),
	};
});

// Stub Leaflet CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });

// Mock geolocation APIs used in ELDLogs
if (!global.navigator) {
	global.navigator = {};
}
if (!global.navigator.geolocation) {
	global.navigator.geolocation = {
		watchPosition: jest.fn(() => 1),
		clearWatch: jest.fn(() => {}),
	};
}

// Stub window.alert used in App.js during login failures
// Always override to avoid jsdom not-implemented error
// eslint-disable-next-line no-undef
window.alert = jest.fn();
