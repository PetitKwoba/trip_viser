import PropTypes from 'prop-types';
import React, { useState, useEffect, useMemo } from "react";
import { getELDLogsByUsername, acceptELDLog, completeELDLog, getDrivers } from './api';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// import { getELDLogs } from './api'; // For future centralized API usage

// Helper function to generate directions from trip data
function getRouteDirections(trip) {
  if (!trip || !trip.start || !trip.end) return [];
  const directions = [];
  const startName = typeof trip.start === 'string' ? trip.start : (trip.start.name || 'Start');
  const endName = typeof trip.end === 'string' ? trip.end : (trip.end.name || 'End');
  directions.push(`Start at ${startName}.`);
  (trip.stops || []).forEach(stop => {
    const stopName = typeof stop === 'string' ? stop : (stop?.name || 'Stop');
    const stopType = (typeof stop === 'object' && stop?.type) ? String(stop.type).toLowerCase() : 'stop';
    directions.push(`Drive and take a ${stopType} at ${stopName}.`);
  });
  directions.push(`Continue to your destination: ${endName}.`);
  return directions;
}

// Live driver marker component
function LiveDriverMarker({ onLocationUpdate }) {
  const [position, setPosition] = useState([40.7128, -74.006]); // Default: New York
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition([lat, lng]);
        map.setView([lat, lng]);
        if (onLocationUpdate) onLocationUpdate([lat, lng]);
      },
      (err) => {
        // Optional: surface error for debugging; keeps param used
        if (process.env.NODE_ENV !== 'production') console.warn('Geolocation error', err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, onLocationUpdate]);

  return (
    <Marker position={position}>
      <Popup>Driver's Live Location</Popup>
    </Marker>
  );
}

// OSRMRoutePolyline component: fetches and draws route using OSRM free API
function OSRMRoutePolyline() {
  const [route, setRoute] = useState([]);
  useEffect(() => {
    // Example coordinates: NY -> Rest Stop -> Boston
    const coords = [
      [-74.006, 40.7128],   // New York
      [-77.1945, 41.2033],  // Lock Haven (rest stop)
      [-71.0589, 42.3601]   // Boston
    ];
    const url = `https://router.project-osrm.org/route/v1/driving/${coords.map(c => c.join(',')).join(';')}?overview=full&geometries=geojson`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
        }
      })
      .catch(() => {
        setRoute([]); // fail silently
      });
  }, []);
  return route.length > 0 ? <Polyline positions={route} color="#1976d2" weight={5} /> : null;
}

export default function ELDLogs({ username = '', role = 'driver', windowWidth = 800 }) {
  const [userLogs, setUserLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDirections, setShowDirections] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [driverOptions, setDriverOptions] = useState([]);
  const [targetUsername, setTargetUsername] = useState('');

  // When supervisor, fetch list of drivers for selection
  useEffect(() => {
    let cancelled = false;
    async function loadDrivers() {
      if (role !== 'supervisor') return;
      try {
        const data = await getDrivers();
        if (!cancelled) setDriverOptions(Array.isArray(data) ? data : (data?.results || []));
      } catch {
        if (!cancelled) setDriverOptions([]);
      }
    }
    loadDrivers();
    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      const effectiveUsername = role === 'supervisor' ? targetUsername : username;
      if (!effectiveUsername) return;
      setLoading(true);
      setError("");
      try {
        const logs = await getELDLogsByUsername(effectiveUsername, pageSize, page, pageSize);
        if (!cancelled) {
          setUserLogs(Array.isArray(logs) ? logs : (logs?.results || []));
        }
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load ELD logs. Please retry.');
          setUserLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLogs();
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 15000);
    }
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [username, role, targetUsername, page, pageSize, autoRefresh, reloadTick, pageSize]);

  // Preselect first log when userLogs change if none selected
  useEffect(() => {
    if (!selectedLog && userLogs && userLogs.length > 0) {
      setSelectedLog(userLogs[0]);
    }
  }, [userLogs, selectedLog]);

  // Compute directions from selected log if trip info available
  const directions = useMemo(() => {
    const trip = selectedLog?.trip;
    return getRouteDirections(trip);
  }, [selectedLog]);

  // Decode polyline if provided as a string (Google polyline or JSON array), else pass-through arrays
  const decodedRoute = useMemo(() => {
    const poly = selectedLog?.trip?.polyline;
    if (!poly) return [];
    // If already an array of [lat,lng] or [lng,lat]
    if (Array.isArray(poly)) {
      // If elements look like [lat,lng]
      if (Array.isArray(poly[0])) return poly;
      try {
        const parsed = JSON.parse(poly);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed;
      } catch {}
      return [];
    }
    if (typeof poly === 'string') {
      // Try JSON first
      try {
        const parsed = JSON.parse(poly);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed;
      } catch {}
      // Fall back to Google-style encoded polyline decode
      return decodePolyline(poly);
    }
    return [];
  }, [selectedLog]);

  // Future: useEffect(() => { setLoading(true); getELDLogs().then(...).catch(...).finally(() => setLoading(false)); }, []);

  return (
    <div className="dashboard-container" style={{ maxWidth: windowWidth < 600 ? '100%' : 800, margin: '0 auto', padding: windowWidth < 600 ? '0.5em' : '1em' }}>
      <h3 style={{ marginTop: 0 }}>
        ELD Logs {role === 'supervisor' ? (targetUsername ? `for ${targetUsername}` : '(select a driver)') : (username ? `for ${username}` : '')} {role ? `(${role})` : ''}
      </h3>
      {role === 'supervisor' && (
        <div style={{display:'flex', gap:'0.5em', alignItems:'center', marginBottom:'0.6em'}}>
          <label>
            Driver:
            <select value={targetUsername} onChange={e=>{ setTargetUsername(e.target.value); setPage(1); }} style={{marginLeft:'0.4em'}}>
              <option value="">-- Select driver --</option>
              {driverOptions.map(d => {
                const uname = d?.user?.username || d?.username || '';
                const name = d?.name || uname;
                return <option key={uname} value={uname}>{name}</option>;
              })}
            </select>
          </label>
          {driverOptions.length === 0 && (
            <span style={{marginLeft:'0.5em', color:'#888'}}>No assigned drivers found.</span>
          )}
        </div>
      )}
      <div aria-live="polite" style={{ minHeight: '1.2em' }}>
        {loading && <div style={{color:'#1976d2',fontWeight:'bold',marginBottom:'1em'}}>Loading logs...</div>}
        {error && (
          <div style={{color:'#e53935',fontWeight:'bold',marginBottom:'1em', display:'flex', alignItems:'center', gap:'0.6em'}}>
            <span>{error}</span>
            <button onClick={()=> setReloadTick(t=>t+1)} style={{padding:'0.2em 0.6em'}}>Retry</button>
          </div>
        )}
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5em'}}>
        <div />
        <label style={{fontSize:'0.9em'}}>
          <input type="checkbox" checked={autoRefresh} onChange={e=> setAutoRefresh(e.target.checked)} /> Auto-refresh
        </label>
      </div>

      {/* Simple list of fetched ELD logs */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1em', boxShadow: '0 2px 12px rgba(76,110,245,0.08)', marginBottom: '1em' }}>
        <h4 style={{ color: '#1976d2', marginTop: 0 }}>Recent ELD Logs</h4>
        {/* Pagination controls */}
        <div style={{ display:'flex', gap:'0.5em', alignItems:'center', marginBottom:'0.6em' }}>
          <button disabled={page<=1} onClick={() => setPage(p=>Math.max(1, p-1))} style={{padding:'0.2em 0.6em'}}>Prev</button>
          <span>Page {page}</span>
          <button onClick={() => setPage(p=>p+1)} style={{padding:'0.2em 0.6em'}}>Next</button>
          <label style={{ marginLeft:'1em' }}>
            Page size:
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1);}} style={{marginLeft:'0.4em'}}>
              {[5,10,20].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {userLogs.length === 0 ? (
          <div style={{ color: '#888' }}>No logs found.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {userLogs.map(log => (
              <li key={log.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1em' }}>
                <div>
                  <strong>{log.date}</strong> — {Array.isArray(log.logEntries) ? `${log.logEntries.length} entries` : 'details available'}
                </div>
                <button onClick={()=> setSelectedLog(log)} style={{padding:'0.2em 0.6em'}}>View</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {directions.length > 0 && (
        <div style={{ background: '#fffde7', borderRadius: '8px', padding: '1em', marginBottom: '1em', color: '#795548' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#ff9800' }}>Route Directions</h4>
            {selectedLog.status === 'Completed' && (
              <button onClick={()=> setTimesheetOpen(true)} style={{padding:'0.3em 0.8em'}}>Print Daily Sheet</button>
            )}
            <button
              onClick={() => setShowDirections(v => !v)}
              style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 6, padding: '0.2em 0.6em', cursor: 'pointer' }}
              aria-expanded={showDirections}
              aria-controls="route-directions"
            >
              {showDirections ? 'Hide' : 'Show'}
            </button>
          </div>
          {showDirections && (
            <div id="route-directions">
              <ol style={{ marginTop: '0.6em' }}>
                {directions.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
              <div style={{ marginTop: '0.5em', fontSize: '0.95em', color: '#888' }}>
                The map below shows your route and stops.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log actions for driver */}
      {selectedLog && username && (
        <div style={{ display:'flex', gap:'0.5em', marginBottom:'1em' }}>
          <button
            disabled={selectedLog.status === 'Accepted' || selectedLog.status === 'Completed' || selectedLog.approvalStatus !== 'Approved'}
            title={selectedLog.approvalStatus !== 'Approved' ? 'Waiting for supervisor approval' : (selectedLog.status !== 'Submitted' ? 'Already processed' : '')}
            onClick={async()=>{
              try {
                await acceptELDLog(selectedLog.id);
                setSelectedLog(s=> s ? { ...s, status: 'Accepted' } : s);
                setUserLogs(list=> list.map(l=> l.id===selectedLog.id ? { ...l, status: 'Accepted' } : l));
              } catch { alert('Failed to accept log'); }
            }}
            style={{padding:'0.3em 0.8em'}}
          >Accept</button>
          <button
            disabled={selectedLog.status !== 'Accepted'}
            title={selectedLog.status !== 'Accepted' ? 'You must accept before completing' : ''}
            onClick={async()=>{
              try {
                await completeELDLog(selectedLog.id);
                setSelectedLog(s=> s ? { ...s, status: 'Completed' } : s);
                setUserLogs(list=> list.map(l=> l.id===selectedLog.id ? { ...l, status: 'Completed' } : l));
                setTimesheetOpen(true);
              } catch { alert('Failed to complete log'); }
            }}
            style={{padding:'0.3em 0.8em'}}
          >Complete</button>
          <div style={{alignSelf:'center', color:'#555'}}>Status: <strong>{selectedLog.status || '—'}</strong> {selectedLog.approvalStatus ? `(Supervisor: ${selectedLog.approvalStatus})` : ''}</div>
        </div>
      )}

      <div style={{ marginBottom: '2em' }}>
        <h3 style={{ color: '#1976d2', fontWeight: 'bold' }}>Route & Stops</h3>
        <MapContainer center={[40.7128, -74.006]} zoom={6} style={{ height: '320px', width: '100%', borderRadius: '12px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* If selectedLog has trip geometry, render it; else fallback demo */}
          {decodedRoute.length > 0 ? (
            <Polyline positions={decodedRoute} color="#1976d2" weight={5} />
          ) : (
            <OSRMRoutePolyline />
          )}
          {selectedLog?.trip?.start?.coords && Array.isArray(selectedLog.trip.start.coords) && selectedLog.trip.start.coords.length === 2 && (
            <Marker position={selectedLog.trip.start.coords}>
              <Popup>Start: {selectedLog.trip.start.name}</Popup>
            </Marker>
          )}
          {Array.isArray(selectedLog?.trip?.stops) && selectedLog.trip.stops.map((s, i) => (
            s?.coords && Array.isArray(s.coords) && s.coords.length === 2 ? (
            <Marker key={i} position={s.coords}>
              <Popup>Stop: {s.name}</Popup>
            </Marker>) : null
          ))}
          {selectedLog?.trip?.end?.coords && Array.isArray(selectedLog.trip.end.coords) && selectedLog.trip.end.coords.length === 2 && (
            <Marker position={selectedLog.trip.end.coords}>
              <Popup>End: {selectedLog.trip.end.name}</Popup>
            </Marker>
          )}
          <LiveDriverMarker onLocationUpdate={() => {}} />
        </MapContainer>
      </div>

      {/* Read-only timeline and HOS checks based on selected log (if entries present) */}
      {selectedLog && Array.isArray(selectedLog.logEntries) && selectedLog.logEntries.length > 0 && (
        <div style={{ background:'#fff', borderRadius:'12px', padding:'1em', boxShadow:'0 2px 12px rgba(76,110,245,0.08)', marginBottom:'2em' }}>
          <h4 style={{ color:'#1976d2', marginTop:0 }}>Daily Timeline & HOS (Read-only)</h4>
          {/* Reuse timeline colors and layout inline to avoid cross-file deps */}
          <div style={{ margin:'0.4em 0 0.8em 0' }}>
            <div style={{ position:'relative', height:'16px', background:'#e0e0e0', borderRadius:'8px' }}>
              {selectedLog.logEntries.map((seg, idx) => {
                const startPct = (Math.max(0, Math.min(24, seg.start)) / 24) * 100;
                const endPct = (Math.max(0, Math.min(24, seg.end)) / 24) * 100;
                const width = Math.max(0, endPct - startPct);
                const color = seg.status === 'Driving' ? '#1976d2' : seg.status === 'On Duty' ? '#ff9800' : seg.status === 'Sleeper Berth' ? '#6a1b9a' : '#9e9e9e';
                return (
                  <div key={idx} title={`${seg.status} ${seg.start}:00–${seg.end}:00`} style={{ position:'absolute', left:`${startPct}%`, width:`${width}%`, top:0, bottom:0, background: color, borderRadius:'8px' }}></div>
                );
              })}
            </div>
          </div>
          <HOSChecksInline entries={selectedLog.logEntries} cycleUsed={selectedLog.cycleUsed || 0} />
        </div>
      )}

      {timesheetOpen && selectedLog && (
        <DailyTimesheetModal log={selectedLog} onClose={()=> setTimesheetOpen(false)} />
      )}
    </div>
  );
}

function HOSChecksInline({ entries, cycleUsed }) {
  const metrics = useMemo(() => computeHosMetrics(entries), [entries]);
  const cycleLimit = 70;
  const checks = [
    { label: 'Daily driving time ≤ 11 hours', ok: metrics.totalDriving <= 11, detail: `Driving: ${metrics.totalDriving}h` },
    { label: 'On-duty window ≤ 14 hours', ok: metrics.dutyWindow <= 14, detail: `Window: ${metrics.dutyWindow}h` },
    { label: 'Break present before exceeding 8h continuous driving', ok: metrics.maxContinuousDriving <= 8, detail: `Max continuous driving: ${metrics.maxContinuousDriving}h` },
    { label: 'Cycle total (8 days) ≤ 70 hours', ok: (Number(cycleUsed)||0) + metrics.totalOnDuty <= cycleLimit, detail: `Used: ${(Number(cycleUsed)||0)}h + Today On-Duty: ${metrics.totalOnDuty}h ≤ ${cycleLimit}h` },
  ];
  return (
    <ul style={{ margin:'0.2em 0 0 1.2em' }}>
      {checks.map((c,i)=>(
        <li key={i} style={{ color: c.ok ? '#2e7d32' : '#c62828' }}>{c.ok ? '✔' : '✖'} {c.label} — {c.detail}</li>
      ))}
    </ul>
  );
}

function computeHosMetrics(logs) {
  const sorted = [...logs].sort((a, b) => a.start - b.start);
  let totalDriving = 0;
  let totalOnDuty = 0;
  let firstOn = null;
  let lastOn = null;
  let maxContinuousDriving = 0;
  let run = 0;
  for (const seg of sorted) {
    const dur = Math.max(0, Number(seg.end) - Number(seg.start));
    const isDriving = seg.status === 'Driving';
    const isOnDuty = isDriving || seg.status === 'On Duty';
    if (isDriving) totalDriving += dur;
    if (isOnDuty) totalOnDuty += dur;
    if (isOnDuty) { if (firstOn===null) firstOn = seg.start; lastOn = seg.end; }
    if (isDriving) { run += dur; maxContinuousDriving = Math.max(maxContinuousDriving, run); } else { run = 0; }
  }
  const dutyWindow = firstOn!==null && lastOn!==null ? Math.max(0, lastOn - firstOn) : 0;
  return { totalDriving, totalOnDuty, dutyWindow, maxContinuousDriving };
}

ELDLogs.propTypes = {
  username: PropTypes.string,
  role: PropTypes.string,
  windowWidth: PropTypes.number
};

// Minimal Google Encoded Polyline decoder
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  while (index < str.length) {
    let result = 0, shift = 0, b;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0; shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

// Simple daily timesheet modal based on attached template
function DailyTimesheetModal({ log, onClose }) {
  const trip = log.trip || {};
  const entries = Array.isArray(log.logEntries) ? log.logEntries : [];
  const total = (k) => entries.filter(e=> (k==='Driving'? e.status==='Driving' : (k==='On Duty'? (e.status==='Driving'||e.status==='On Duty') : e.status===k))).reduce((acc,e)=> acc + Math.max(0, Number(e.end)-Number(e.start)), 0);
  const totalOff = total('Off Duty');
  const totalSB = total('Sleeper Berth');
  const totalDriving = total('Driving');
  const totalOnDuty = total('On Duty');
  const hourCell = (h) => {
    const active = entries.some(e=> Number(e.start) <= h && Number(e.end) > h);
    return <td key={h} style={{border:'1px solid #ccc', background: active? '#bbdefb':'#fff', width:10}} />
  };
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>
      <div style={{background:'#fff', width:'900px', maxWidth:'95%', borderRadius:'8px', padding:'1em', boxShadow:'0 8px 24px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Driver's Daily Log — {log.date}</h3>
          <button onClick={onClose} style={{border:'1px solid #ccc', background:'#fafafa', padding:'0.3em 0.8em'}}>Close</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1em', fontSize:'0.95em', marginTop:'0.6em'}}>
          <div>
            <div><strong>From:</strong> {typeof trip.start==='string'? trip.start : trip.start?.name || '—'}</div>
            <div><strong>To:</strong> {typeof trip.end==='string'? trip.end : trip.end?.name || '—'}</div>
            <div><strong>Total Miles Driving Today:</strong> {Math.round((trip.mileage || 0))}</div>
            <div><strong>Truck/Trailer:</strong> —</div>
          </div>
          <div>
            <div><strong>Carrier:</strong> —</div>
            <div><strong>Office:</strong> —</div>
            <div><strong>Home Terminal:</strong> —</div>
          </div>
        </div>
        <div style={{marginTop:'1em'}}>
          <table style={{width:'100%', borderCollapse:'collapse', tableLayout:'fixed'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>1. Off Duty</th>
                <th style={{textAlign:'left'}}>2. Sleeper Berth</th>
                <th style={{textAlign:'left'}}>3. Driving</th>
                <th style={{textAlign:'left'}}>4. On Duty (not driving)</th>
              </tr>
            </thead>
          </table>
          <table style={{width:'100%', borderCollapse:'collapse', tableLayout:'fixed', marginTop:'0.4em'}}>
            <tbody>
              <tr>
                {Array.from({length:24}).map((_,i)=> hourCell(i))}
                <td style={{width:60, textAlign:'center', border:'1px solid #ccc'}}>{totalOff}h</td>
              </tr>
              <tr>
                {Array.from({length:24}).map((_,i)=> hourCell(i))}
                <td style={{width:60, textAlign:'center', border:'1px solid #ccc'}}>{totalSB}h</td>
              </tr>
              <tr>
                {Array.from({length:24}).map((_,i)=> hourCell(i))}
                <td style={{width:60, textAlign:'center', border:'1px solid #ccc'}}>{totalDriving}h</td>
              </tr>
              <tr>
                {Array.from({length:24}).map((_,i)=> hourCell(i))}
                <td style={{width:60, textAlign:'center', border:'1px solid #ccc'}}>{totalOnDuty}h</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{marginTop:'0.8em', fontSize:'0.95em'}}>
          <div><strong>Remarks:</strong> —</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'0.6em', marginTop:'0.4em'}}>
            <div>On-duty hrs today: {totalOnDuty}h</div>
            <div>Driving hrs today: {totalDriving}h</div>
            <div>Off Duty hrs: {totalOff}h</div>
            <div>Sleeper Berth hrs: {totalSB}h</div>
          </div>
        </div>
        <div style={{marginTop:'1em', textAlign:'right'}}>
          <button onClick={()=> window.print()} style={{background:'#1976d2', color:'#fff', border:'none', borderRadius:6, padding:'0.5em 1em'}}>Print</button>
        </div>
      </div>
    </div>
  );
}