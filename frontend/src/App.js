import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import Navbar from './Navbar';
import { getUserRole, loginUser, submitTrip, submitELDLog, createApprovalRequest, obtainToken, clearAccessToken } from './api'; // Centralized API logic
import Leaderboard from './Leaderboard';
import DriverDashboard from './DriverDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import Drivers from './Drivers';
import Analytics from './Analytics';
import Calendar from './Calendar';
import Notifications from './Notifications';
import ExportReport from './ExportReport';
import Settings from './Settings';
import ELDLogs from './ELDLogs';

// DashboardRouter helper component
function DashboardRouter({ username, role, setRole }) {
  useEffect(() => {
    let isMounted = true;
    async function fetchRole() {
      try {
        const data = await getUserRole(username);
        if (isMounted && data?.role) setRole(data.role);
      } catch {
        if (isMounted) setRole('');
      }
    }
    if (username && !role) fetchRole();
    return () => { isMounted = false; };
  }, [username, role, setRole]);
  if (!role) return <div style={{ textAlign: 'center', marginTop: '4em', fontSize: '1.5em' }}>Loading dashboard...</div>;
  if (role === 'driver') return <DriverDashboard username={username} />;
  if (role === 'supervisor') return <SupervisorDashboard username={username} />;
  return <div style={{ textAlign: 'center', marginTop: '4em', fontSize: '1.5em' }}>Unknown role</div>;
}

// TripInputField component for autocomplete and map picker
const TripInputField = ({ label, name, value, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const MapPicker = React.useMemo(() => {
    return React.lazy(() => import('./MapPicker'));
  }, []);

  const handleInput = async (e) => {
    const val = e.target.value;
    onChange(e);
    if (val.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&addressdetails=1&limit=5`);
        const data = await res.json();
        setSuggestions(data.map(item => item.display_name));
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  function handleSuggestionClick(s) {
    onChange({ target: { name, value: s } });
    setSuggestions([]);
  }

  const handleMapPick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowMap(true);
  };

  const handleMapSelect = (latlng, displayName) => {
    const locStr = displayName ? displayName : `Lat: ${latlng.lat}, Lng: ${latlng.lng}`;
    onChange({ target: { name, value: locStr } });
    setShowMap(false);
  };

  return (
    <div style={{ position: 'relative', marginBottom: '1.2em' }}>
      <label style={{ fontWeight: 'bold', marginBottom: '0.3em', display: 'block' }}>{label}</label>
      <input
        style={inputStyle}
        type="text"
        name={name}
        placeholder={label}
        value={value}
        onChange={handleInput}
        autoComplete="off"
      />
      <button
        type="button"
        style={{ marginLeft: '0.5em', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4em 1em', fontWeight: 'bold', cursor: 'pointer' }}
        onClick={handleMapPick}
      >
        Pick from Map
      </button>
      {suggestions.length > 0 && (
        <ul style={{ position: 'absolute', left: 0, top: '2.8em', background: '#fff', border: '1px solid #ccc', borderRadius: '6px', width: '100%', zIndex: 10, listStyle: 'none', margin: 0, padding: '0.5em 0' }}>
          {suggestions.map(s => (
            <li key={s} style={{ padding: '0.5em 1em', cursor: 'pointer' }} onClick={() => handleSuggestionClick(s)}>{s}</li>
          ))}
        </ul>
      )}
      {showMap && (
        <React.Suspense fallback={<div>Loading map...</div>}>
          <MapPicker onSelect={handleMapSelect} onCancel={() => setShowMap(false)} />
        </React.Suspense>
      )}
    </div>
  );
};

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  padding: '2rem',
  maxWidth: '420px',
  margin: '2rem auto',
};

const inputStyle = {
  padding: '0.7rem',
  borderRadius: '6px',
  border: '1px solid #ccc',
  marginBottom: '1rem',
  width: '100%',
  fontSize: '1rem',
};

const buttonStyle = {
  background: 'linear-gradient(90deg,#007bff,#00c6ff)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '0.8rem 1.5rem',
  fontWeight: 'bold',
  fontSize: '1rem',
  cursor: 'pointer',
  marginTop: '1rem',
};

function App() {
  const navigate = useNavigate();
  // Auth state
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [tripInput, setTripInput] = useState({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    cycleUsed: '',
    routeDistance: 0,
    suggestedDrivingHours: 0
  });
  const [tripSubmitted, setTripSubmitted] = useState(false);
  const [pendingLogs, setPendingLogs] = useState(null);
  const [logValidation, setLogValidation] = useState({ valid: true, failures: [], advisory: [] });
  // ELD log state: { [username]: { [date]: [logEntries] } }
  const [eldLogs, setEldLogs] = useState({});

  // Route calculation via free OSRM API: returns distance (miles) and polyline positions [[lat,lng], ...]
  const fetchRouteWithPolyline = useCallback(async (start, end) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates || [];
        const distanceMeters = data.routes[0].distance || 0;
        const positions = coords.map(([lng, lat]) => [lat, lng]);
        return { distanceMiles: distanceMeters / 1609.34, positions };
      }
    } catch (err) {
      console.error('Failed to fetch route', err);
    }
    return { distanceMiles: 0, positions: [] };
  }, []);

  // Auto-calc distance, suggested hours, and polyline
  useEffect(() => {
    let isMounted = true;
    async function updateDistanceAndHours() {
      const pickup = tripInput.pickupLocation.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
      const dropoff = tripInput.dropoffLocation.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
      if (pickup && dropoff) {
        const start = { lat: parseFloat(pickup[1]), lng: parseFloat(pickup[2]) };
        const end = { lat: parseFloat(dropoff[1]), lng: parseFloat(dropoff[2]) };
        const { distanceMiles, positions } = await fetchRouteWithPolyline(start, end);
        const hours = distanceMiles > 0 ? +(distanceMiles / 55).toFixed(2) : 0;
        if (isMounted) setTripInput(ti => ({ ...ti, routeDistance: distanceMiles, suggestedDrivingHours: hours, polyline: JSON.stringify(positions) }));
      } else {
        if (isMounted) setTripInput(ti => ({ ...ti, routeDistance: 0, suggestedDrivingHours: 0, polyline: '' }));
      }
    }
    updateDistanceAndHours();
    return () => { isMounted = false; };
    // eslint-disable-next-line
  }, [tripInput.pickupLocation, tripInput.dropoffLocation, fetchRouteWithPolyline]);

  // Trip input handler
  const handleTripInput = useCallback((e) => {
    setTripInput(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  // ELD log change handler
  const handleELDLogChange = useCallback((logEntries) => {
    setPendingLogs(logEntries);
  }, []);

  // Unified submit handler
  const handleUnifiedSubmit = useCallback(async (e) => {
    e.preventDefault();
    const errors = [];
    if (!tripInput.currentLocation.trim()) errors.push('Current Location is required.');
    if (!tripInput.pickupLocation.trim()) errors.push('Pickup Location is required.');
    if (!tripInput.dropoffLocation.trim()) errors.push('Dropoff Location is required.');
    if (!loggedIn || !username.trim()) errors.push('Please log in before submitting.');
    if (!logValidation.valid) {
      errors.push('HOS validation failed:');
      errors.push(...logValidation.failures);
    }
    if (errors.length) {
      setSubmitError(errors.join('\n'));
      return;
    }
    try {
      // Submit Trip and capture created trip id
      const trip = await submitTrip({
        username,
        currentLocation: tripInput.currentLocation,
        pickupLocation: tripInput.pickupLocation,
        dropoffLocation: tripInput.dropoffLocation,
        cycleUsed: tripInput.cycleUsed,
        stops: [],
        polyline: tripInput.polyline || undefined,
      });
      // Submit ELD Log
      const tripId = trip && typeof trip === 'object' ? trip.id : undefined;
      await submitELDLog({ username, logEntries: pendingLogs || [], ...(tripId ? { tripId } : {}) });
  // Create Approval Request (non-blocking)
  try { await createApprovalRequest({ username }); } catch (e) { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10);
      setEldLogs(prev => ({
        ...prev,
        [username]: {
          ...(prev[username] || {}),
          [today]: pendingLogs || []
        }
      }));
      setTripSubmitted(true);
      setSubmitError('');
    } catch (err) {
      setSubmitError('Failed to submit trip/log. Please try again.');
    }
  }, [tripInput, loggedIn, username, pendingLogs]);

  // Login handler using centralized API
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    if (usernameInput && password) {
      try {
        // Obtain JWT token first so protected routes work immediately
        const tokenPair = await obtainToken(usernameInput, password);
        const result = await loginUser(usernameInput, password);
        if (result?.role && result?.username) {
          setLoggedIn(true);
          setUsername(result.username);
          setRole(result.role); // Set role immediately after login
          setPassword('');
          // Persist session so refresh doesn't log out
          try {
            window.localStorage.setItem('username', result.username);
            window.localStorage.setItem('role', result.role);
            if (tokenPair?.refresh) window.localStorage.setItem('refreshToken', tokenPair.refresh);
          } catch {}
          navigate('/dashboard');
        } else {
          alert('Invalid credentials');
        }
      } catch {
        alert('Login failed');
      }
    }
  }, [usernameInput, password, navigate]);

  // Logout handler
  const handleLogout = useCallback(() => {
    setLoggedIn(false);
    setPassword('');
    setUsername('');
    setUsernameInput('');
    try { clearAccessToken(); } catch {}
    try {
      window.localStorage.removeItem('username');
      window.localStorage.removeItem('role');
      window.localStorage.removeItem('refreshToken');
    } catch {}
    navigate('/login');
  }, [navigate]);

  // Rehydrate session on refresh if token and username are present
  useEffect(() => {
    try {
      const token = window.localStorage.getItem('accessToken');
      const storedUser = window.localStorage.getItem('username');
      const storedRole = window.localStorage.getItem('role');
      if (token && storedUser) {
        setUsername(storedUser);
        if (storedRole) setRole(storedRole);
        setLoggedIn(true);
        // If role missing, fetch it
        if (!storedRole) {
          getUserRole(storedUser)
            .then((d) => {
              if (d?.role) {
                setRole(d.role);
                try { window.localStorage.setItem('role', d.role); } catch {}
              }
            })
            .catch(() => {});
        }
        // Redirect to dashboard if currently at root or login
        if (window.location && (window.location.pathname === '/' || window.location.pathname === '/login')) {
          navigate('/dashboard');
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fa' }}>
      {loggedIn && <Navbar role={role} onLogout={handleLogout} />}
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: 'calc(100vh - 56px)' }}>
        <div className="sidebar-brand" style={{ background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.6em', letterSpacing: '2px' }}>Trip Viser</div>
        <div style={{ flex: 1 }} className="container">
          <Routes>
              {!loggedIn ? (
                <>
                  <Route
                    path="/login"
                    element={
                      <div>
                        <div style={cardStyle}>
                          <h2>Login</h2>
                          <form onSubmit={handleLogin}>
                            <input
                              style={inputStyle}
                              type="text"
                              placeholder="Username"
                              value={usernameInput}
                              onChange={e => setUsernameInput(e.target.value)}
                            />
                            <input
                              style={inputStyle}
                              type="password"
                              placeholder="Password"
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                            />
                            <button style={buttonStyle} type="submit">Login</button>
                            <div style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
                              <a href="https://github.com/PetitKwoba/trip_viser" target="_blank" rel="noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>
                                View source on GitHub
                              </a>
                              <span style={{ margin: '0 0.5rem', color: '#aaa' }}>|</span>
                              <a href="https://www.loom.com/share/e47c6ea5b1014472a3d86b6fb52dc0aa?sid=106d0a04-3d3f-4da7-9bd9-5fd8d6590858" target="_blank" rel="noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>
                                Watch demo (Loom)
                              </a>
                            </div>
                          </form>
                        </div>
                      </div>
                    }
                  />
                  <Route path="*" element={<Navigate to="/login" />} />
                </>
              ) : (
                <>
                  <Route path="/dashboard" element={<DashboardRouter username={username} role={role} setRole={setRole} />} />
                  <Route path="/driver" element={<DriverDashboard username={username} />} />
                  <Route path="/supervisor" element={<SupervisorDashboard username={username} />} />
                  <Route path="/enter-log" element={
                    <div style={{ maxWidth: '520px', margin: '2em auto', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(76,110,245,0.08)', padding: '2em 2em 1em 2em' }}>
                      <h2 style={{ color: '#1976d2', marginBottom: '1em', fontWeight: 'bold' }}>Enter Trip Log</h2>
                      <p style={{ color: '#555', marginBottom: '1.5em' }}>Fill out your route details below. You can type locations or pick from the map. All fields are optional, but more info helps supervisors approve your log faster.</p>
                      {!tripSubmitted ? (
                        <>
                          <form onSubmit={handleUnifiedSubmit} autoComplete="off">
                            {submitError && <div style={{ color: '#e53935', fontWeight: 'bold', marginBottom: '1em', whiteSpace: 'pre-line' }}>{submitError}</div>}
                            <TripInputField
                              label="Current Location"
                              name="currentLocation"
                              value={tripInput.currentLocation}
                              onChange={handleTripInput}
                            />
                            <TripInputField
                              label="Pickup Location"
                              name="pickupLocation"
                              value={tripInput.pickupLocation}
                              onChange={handleTripInput}
                            />
                            <TripInputField
                              label="Dropoff Location"
                              name="dropoffLocation"
                              value={tripInput.dropoffLocation}
                              onChange={handleTripInput}
                            />
                            {tripInput.routeDistance > 0 && (
                              <div style={{ marginBottom: '1em', color: '#1976d2', fontWeight: 'bold' }}>
                                Road Distance: {tripInput.routeDistance.toFixed(1)} mi<br />
                                Suggested Driving Hours: {tripInput.suggestedDrivingHours} hrs (at 55 mph)
                              </div>
                            )}
                            <input
                              style={inputStyle}
                              type="number"
                              name="cycleUsed"
                              min="0"
                              max="70"
                              placeholder="Current Cycle Used (Hrs)"
                              value={tripInput.cycleUsed}
                              onChange={handleTripInput}
                            />
                          </form>
                          <div style={{ marginTop: '2em' }}>
                            <h3 style={{ color: '#1976d2' }}>Enter ELD Log</h3>
                            <React.Suspense fallback={<div>Loading...</div>}>
                              {React.createElement(require('./EnterLog').default, {
                                username,
                                onSubmit: handleELDLogChange,
                                onValidationChange: setLogValidation,
                                routeDistance: tripInput.routeDistance,
                                suggestedDrivingHours: tripInput.suggestedDrivingHours,
                                cycleUsed: tripInput.cycleUsed
                              })}
                            </React.Suspense>
                          </div>
                          <button style={buttonStyle} type="button" onClick={handleUnifiedSubmit}>Submit Trip & Log</button>
                        </>
                      ) : (
                        <div style={{ background: '#e3fcec', borderRadius: '12px', padding: '1.5em', marginTop: '1em', textAlign: 'center', boxShadow: '0 2px 8px rgba(76,110,245,0.06)' }}>
                          <h3 style={{ color: '#388e3c', fontWeight: 'bold' }}>Trip Submitted!</h3>
                          <p style={{ color: '#555' }}>Your trip log has been sent for supervisor approval.</p>
                          <div style={{ marginTop: '1em', textAlign: 'left' }}>
                            <div><strong>Current Location:</strong> {tripInput.currentLocation || <span style={{ color: '#888' }}>N/A</span>}</div>
                            <div><strong>Pickup Location:</strong> {tripInput.pickupLocation || <span style={{ color: '#888' }}>N/A</span>}</div>
                            <div><strong>Dropoff Location:</strong> {tripInput.dropoffLocation || <span style={{ color: '#888' }}>N/A</span>}</div>
                            <div><strong>Cycle Used:</strong> {tripInput.cycleUsed || <span style={{ color: '#888' }}>N/A</span>} hrs</div>
                          </div>
                          <button
                            style={{ marginTop: '1.5em', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6em 1.2em', fontWeight: 'bold', cursor: 'pointer' }}
                            onClick={() => {
                              setTripInput({ currentLocation: '', pickupLocation: '', dropoffLocation: '', cycleUsed: '', routeDistance: 0, suggestedDrivingHours: 0, polyline: '' });
                              setTripSubmitted(false);
                              setPendingLogs(null);
                            }}
                          >
                            Log Another Trip
                          </button>
                        </div>
                      )}
                    </div>
                  } />
                  <Route path="/eld-logs" element={<ELDLogs username={username} role={role} eldLogs={eldLogs} />} />
                  <Route path="/leaderboard" element={<Leaderboard username={username} />} />
                  <Route path="/drivers" element={<Drivers />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/export" element={<ExportReport />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to={role === 'driver' ? '/driver' : role === 'supervisor' ? '/supervisor' : '/dashboard'} />} />
                </>
              )}
            </Routes>
        </div>
      </div>
    </div>
  );
}

      export default App;
