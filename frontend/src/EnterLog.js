import React, { useMemo, useState, useRef, useEffect } from "react";
import PropTypes from 'prop-types';

// Hours of Service statuses aligned with common ELD categories
const statusOptions = ["Off Duty", "Sleeper Berth", "Driving", "On Duty"];

// Helper to compute metrics and compliance per HOS assumptions
function computeHosMetrics(logs) {
  const sorted = [...logs].sort((a, b) => a.start - b.start);
  let totalDriving = 0;
  let totalOnDuty = 0; // Driving + On Duty
  let firstOn = null;
  let lastOn = null;
  let maxContinuousDriving = 0;
  let run = 0;

  for (const seg of sorted) {
    const dur = Math.max(0, Number(seg.end) - Number(seg.start));
    const isDriving = seg.status === "Driving";
    const isOnDuty = isDriving || seg.status === "On Duty";
    if (isDriving) totalDriving += dur;
    if (isOnDuty) totalOnDuty += dur;
    if (isOnDuty) {
      if (firstOn === null) firstOn = seg.start;
      lastOn = seg.end;
    }
    if (isDriving) {
      run += dur;
      if (run > maxContinuousDriving) maxContinuousDriving = run;
    } else {
      run = 0; // reset driving streak when not driving
    }
  }

  const dutyWindow = firstOn !== null && lastOn !== null ? Math.max(0, lastOn - firstOn) : 0;

  return {
    totalDriving,
    totalOnDuty,
    dutyWindow,
    maxContinuousDriving,
  };
}

export default function EnterLog({ username, onSubmit, onValidationChange, routeDistance = 0, cycleUsed = 0, suggestedDrivingHours = 0 }) {
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([
    { start: 0, end: 6, status: "Off Duty" },
    { start: 6, end: 7, status: "On Duty" }, // Pickup (1h)
    { start: 7, end: 11, status: "Driving" },
    { start: 11, end: 12, status: "Off Duty" }, // Break (>= 30m; modeled as 1h)
    { start: 12, end: 18, status: "Driving" },
    { start: 18, end: 19, status: "On Duty" }, // Drop-off (1h)
    { start: 19, end: 24, status: "Off Duty" }
  ]);
  const userEditedRef = useRef(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const lastTripSignatureRef = useRef("");
  const [showFuelToast, setShowFuelToast] = useState(false);

  function handleChange(idx, field, value) {
    userEditedRef.current = true;
    setLogs(logs => logs.map((log, i) => i === idx ? { ...log, [field]: value } : log));
  }

  function handleAdd() {
    userEditedRef.current = true;
    setLogs([...logs, { start: 0, end: 0, status: "Off Duty" }]);
  }

  function handleRemove(idx) {
    userEditedRef.current = true;
    setLogs(logs => logs.filter((_, i) => i !== idx));
  }

  // Derived metrics and HOS validations
  const metrics = useMemo(() => computeHosMetrics(logs), [logs]);
  const fuelingRequired = routeDistance >= 1000; // At least one fuel stop per 1000 miles
  const cycleLimit = 70; // 70hrs/8days (property-carrying)

  // Simple compliance checks mapped to assumptions
  const checks = useMemo(() => {
    const items = [];
    // 11-hour driving limit
    items.push({
      label: "Daily driving time ≤ 11 hours",
      ok: metrics.totalDriving <= 11,
      detail: `Driving: ${metrics.totalDriving}h`
    });
    // 14-hour on-duty window
    items.push({
      label: "On-duty window ≤ 14 hours",
      ok: metrics.dutyWindow <= 14,
      detail: `Window: ${metrics.dutyWindow}h`
    });
    // 30-minute break after 8 hours driving (modeled as no continuous driving > 8h)
    items.push({
      label: "Break present before exceeding 8h continuous driving",
      ok: metrics.maxContinuousDriving <= 8,
      detail: `Max continuous driving: ${metrics.maxContinuousDriving}h`
    });
    // Cycle remaining ≤ 70h
    const todaysOnDuty = metrics.totalOnDuty;
    items.push({
      label: "Cycle total (8 days) ≤ 70 hours",
      ok: (Number(cycleUsed) || 0) + todaysOnDuty <= cycleLimit,
      detail: `Used: ${(Number(cycleUsed) || 0)}h + Today On-Duty: ${todaysOnDuty}h ≤ ${cycleLimit}h`
    });
    // Pickup/Drop-off 1h each (we approximate by requiring ≥2h of On Duty non-driving total)
    items.push({
      label: "Pickup & Drop-off: at least 1h each (≈2h On Duty total)",
      ok: metrics.totalOnDuty - metrics.totalDriving >= 2,
      detail: `On Duty (ND): ${Math.max(0, metrics.totalOnDuty - metrics.totalDriving)}h`
    });
    // Fueling if > 1000 miles (advisory)
    items.push({
      label: "Fueling stop for trips ≥ 1000 miles",
      ok: !fuelingRequired || true, // advisory only; we prompt if needed
      advisory: fuelingRequired,
      detail: fuelingRequired ? "Recommended: add ~1h On Duty fueling segment" : "Not required"
    });
    return items;
  }, [metrics, cycleUsed, fuelingRequired]);

  const colorForStatus = (status) => {
    switch (status) {
      case 'Driving': return '#1976d2';
      case 'On Duty': return '#ff9800';
      case 'Sleeper Berth': return '#6a1b9a';
      case 'Off Duty':
      default: return '#9e9e9e';
    }
  };

  // Validate logs before passing up (block submit if any hard rule fails) and surface specific failures
  React.useEffect(() => {
    const baseInvalid = logs.some(log =>
      log.start === "" || log.end === "" || log.status === "" || Number(log.end) <= Number(log.start)
    );
    const hardFailures = checks.filter(c => !c.ok && !c.advisory);
    const failureMessages = [];
    if (baseInvalid) {
      failureMessages.push("All log fields are required and End must be after Start.");
    }
    for (const f of hardFailures) failureMessages.push(`${f.label} — ${f.detail}`);

    const valid = !baseInvalid && hardFailures.length === 0;
    setError(valid ? "" : failureMessages.join(" \n"));
    if (onValidationChange) {
      const advisory = checks.filter(c => c.advisory && !c.ok);
      onValidationChange({ valid, failures: failureMessages, advisory });
    }
    if (onSubmit) {
      if (valid) onSubmit(logs); else onSubmit([]);
    }
    // eslint-disable-next-line
  }, [logs, checks]);

  function generateHosDraft() {
    // Build a simple HOS-compliant template for the day
    const driveTarget = Math.min(11, Math.max(0, Math.round(Number(suggestedDrivingHours) || 10))); // cap to 11
    const dayStart = 6; // 6 AM typical start
    const segments = [];
    // Off Duty before work
    if (dayStart > 0) segments.push({ start: 0, end: dayStart, status: "Off Duty" });
    // Pickup (1h On Duty)
    segments.push({ start: dayStart, end: dayStart + 1, status: "On Duty" });
    let current = dayStart + 1;
    let remainingDrive = driveTarget;
    if (remainingDrive > 8) {
      // First driving block up to 4-5 hours before mid-day break
      const firstBlock = Math.min(4, remainingDrive);
      segments.push({ start: current, end: current + firstBlock, status: "Driving" });
      current += firstBlock;
      remainingDrive -= firstBlock;
      // Mid-day break (>= 30 min; model as 1h)
      segments.push({ start: current, end: current + 1, status: "Off Duty" });
      current += 1;
    }
    // Remaining driving (not exceeding 11 total)
    if (remainingDrive > 0) {
      segments.push({ start: current, end: current + remainingDrive, status: "Driving" });
      current += remainingDrive;
    }
    // Optional fueling stop (advisory)
    if (routeDistance >= 1000) {
      segments.push({ start: current, end: Math.min(24, current + 1), status: "On Duty" });
      current = Math.min(24, current + 1);
    }
    // Drop-off (1h On Duty) if time permits
    if (current < 24) {
      segments.push({ start: current, end: Math.min(24, current + 1), status: "On Duty" });
      current = Math.min(24, current + 1);
    }
    // Off Duty remainder
    if (current < 24) segments.push({ start: current, end: 24, status: "Off Duty" });
    setLogs(segments);
  }

  // Auto-generate a draft once on mount so fields are pre-filled
  useEffect(() => {
    generateHosDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-generate when trip context changes, unless user already edited
  useEffect(() => {
    const sig = `${Math.round(routeDistance||0)}|${Math.round(suggestedDrivingHours||0)}|${cycleUsed}`;
    const prev = lastTripSignatureRef.current;
    if (prev !== sig) {
      lastTripSignatureRef.current = sig;
      if (!userEditedRef.current) {
        generateHosDraft();
      } else {
        setShowRegeneratePrompt(true);
      }
      // Fueling advisory toast
      if (routeDistance >= 1000) setShowFuelToast(true); else setShowFuelToast(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDistance, suggestedDrivingHours, cycleUsed]);

  function handleRegenerateConfirm() {
    userEditedRef.current = false;
    setShowRegeneratePrompt(false);
    generateHosDraft();
  }
  function handleRegenerateKeep() {
    setShowRegeneratePrompt(false);
  }

  return (
    <div style={{maxWidth:700,margin:'2em auto',background:'#fff',padding:'2em',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)'}}>
      {showFuelToast && (
        <div role="status" aria-live="polite" style={{position:'sticky', top:'0.5em', zIndex: 1, background:'#e8f4fd', color:'#0c5460', border:'1px solid #bee5eb', borderRadius:'8px', padding:'0.6em 0.8em', marginBottom:'0.8em', boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <span style={{marginRight:'0.8em'}}>ℹ Fueling recommended: trips ≥ 1,000 miles should include a ~1h On Duty fueling stop.</span>
          <button type="button" onClick={() => setShowFuelToast(false)} style={{background:'transparent', border:'none', color:'#0c5460', cursor:'pointer', fontWeight:'bold'}}>Dismiss</button>
        </div>
      )}
      {showRegeneratePrompt && (
        <div style={{background:'#fff3cd', color:'#856404', border:'1px solid #ffeeba', borderRadius:'8px', padding:'0.8em 1em', marginBottom:'1em'}}>
          <div style={{marginBottom:'0.5em', fontWeight:'bold'}}>Trip details changed</div>
          <div style={{marginBottom:'0.6em'}}>Do you want to regenerate the HOS draft to match the latest trip info, or keep your manual edits?</div>
          <div style={{display:'flex', gap:'0.6em'}}>
            <button type="button" onClick={handleRegenerateKeep} style={{background:'#6c757d', color:'#fff', border:'none', borderRadius:'6px', padding:'0.4em 0.8em'}}>Keep my edits</button>
            <button type="button" onClick={handleRegenerateConfirm} style={{background:'#1976d2', color:'#fff', border:'none', borderRadius:'6px', padding:'0.4em 0.8em'}}>Regenerate</button>
          </div>
        </div>
      )}
      {error && <div style={{color:'#e53935',fontWeight:'bold',marginBottom:'1em', whiteSpace:'pre-line'}}>{error}</div>}
      <h2>Enter Daily Log</h2>
      <div style={{ background:'#f6f8fa', borderRadius:'10px', padding:'1em', margin:'0.5em 0 1.2em 0', color:'#333' }}>
        <div style={{ fontWeight:'bold', marginBottom:'0.5em', color:'#1976d2' }}>Assumptions:</div>
        <ul style={{ margin:'0 0 0.5em 1.2em' }}>
          <li>Property-carrying driver, 70 hrs/8 days, no adverse driving conditions</li>
          <li>Fueling at least once every 1,000 miles</li>
          <li>1 hour for pickup and 1 hour for drop-off (On Duty, not driving)</li>
        </ul>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'1em', fontSize:'0.95em' }}>
          <div>Planned distance: {Math.round(routeDistance || 0)} mi</div>
          <div>Suggested driving: {Math.round(suggestedDrivingHours || 0)} h</div>
          <div>Cycle used: {Number(cycleUsed) || 0} h</div>
        </div>
      </div>

      <div style={{ margin:'0.5em 0 1em 0' }}>
        <div style={{ fontWeight:'bold', color:'#1976d2', marginBottom:'0.3em' }}>HOS checks</div>
        <ul style={{ margin:'0 0 1em 1.2em' }}>
          {checks.map((c, i) => (
            <li key={i} style={{ color: c.ok ? '#2e7d32' : (c.advisory ? '#8a6d3b' : '#c62828') }}>
              {c.ok ? '✔' : (c.advisory ? 'ℹ' : '✖')} {c.label} — {c.detail}
            </li>
          ))}
        </ul>
        <button type="button" onClick={generateHosDraft} style={{background:'#1976d2',color:'#fff',borderRadius:'0.5em',padding:'0.5em 1.2em',fontWeight:'bold',marginRight:'1em'}}>Generate HOS Draft</button>
      </div>

      {/* 24-hour timeline visualization */}
      <div style={{ margin:'1em 0 1.5em 0' }}>
        <div style={{ fontWeight:'bold', color:'#1976d2', marginBottom:'0.4em' }}>Daily timeline</div>
        <div style={{ position:'relative', height:'18px', background:'#e0e0e0', borderRadius:'9px' }}>
          {logs.map((seg, idx) => {
            const startPct = (Math.max(0, Math.min(24, seg.start)) / 24) * 100;
            const endPct = (Math.max(0, Math.min(24, seg.end)) / 24) * 100;
            const width = Math.max(0, endPct - startPct);
            return (
              <div key={idx} title={`${seg.status} ${seg.start}:00–${seg.end}:00`} style={{ position:'absolute', left:`${startPct}%`, width:`${width}%`, top:0, bottom:0, background: colorForStatus(seg.status), borderRadius:'9px' }}></div>
            );
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8em', color:'#555', marginTop:'0.3em' }}>
          {Array.from({ length: 7}, (_, i) => i * 4).map(h => (
            <div key={h} style={{ transform:'translateX(-50%)' }}>{h}:00</div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'1em', alignItems:'center', marginTop:'0.4em', fontSize:'0.85em' }}>
          <span><span style={{display:'inline-block',width:'12px',height:'12px',background:'#1976d2',borderRadius:'3px',marginRight:'0.3em'}}></span>Driving</span>
          <span><span style={{display:'inline-block',width:'12px',height:'12px',background:'#ff9800',borderRadius:'3px',marginRight:'0.3em'}}></span>On Duty</span>
          <span><span style={{display:'inline-block',width:'12px',height:'12px',background:'#6a1b9a',borderRadius:'3px',marginRight:'0.3em'}}></span>Sleeper Berth</span>
          <span><span style={{display:'inline-block',width:'12px',height:'12px',background:'#9e9e9e',borderRadius:'3px',marginRight:'0.3em'}}></span>Off Duty</span>
        </div>
      </div>
      {logs.map((log, idx) => (
        <div key={idx} style={{display:'flex',gap:'1em',marginBottom:'1em',alignItems:'center'}}>
          <label>Start:
            <input type="number" min={0} max={23} value={log.start} onChange={e => handleChange(idx, 'start', Number(e.target.value))} style={{marginLeft:'0.5em',width:'60px'}} required />
          </label>
          <label>End:
            <input type="number" min={log.start+1} max={24} value={log.end} onChange={e => handleChange(idx, 'end', Number(e.target.value))} style={{marginLeft:'0.5em',width:'60px'}} required />
          </label>
          <label>Status:
            <select value={log.status} onChange={e => handleChange(idx, 'status', e.target.value)} style={{marginLeft:'0.5em'}} required>
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => handleRemove(idx)} style={{background:'#e53935',color:'#fff',border:'none',borderRadius:'4px',padding:'0.3em 0.8em'}}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={handleAdd} style={{background:'#1976d2',color:'#fff',borderRadius:'0.5em',padding:'0.5em 1.2em',fontWeight:'bold',marginRight:'1em'}}>Add Log Entry</button>
  {/* Submit button removed; main form handles submission */}
  </div>
  );
}

EnterLog.propTypes = {
  username: PropTypes.string,
  onSubmit: PropTypes.func,
  onValidationChange: PropTypes.func,
  routeDistance: PropTypes.number,
  cycleUsed: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  suggestedDrivingHours: PropTypes.number,
};
