
import React, { useState, useEffect } from "react";
import { getDrivers, getPendingApprovalRequestsBySupervisor, approveApprovalRequest, rejectApprovalRequest } from './api';
import './SupervisorDashboard.css';

const initialDrivers = [
  {
    id: 1,
    name: "John Doe",
    license: "A1234567",
    truck: "Truck 12",
    trailer: "Trailer 7",
    office: "Main Office",
    terminal: "Terminal 1",
    status: "Active"
  },
  {
    id: 2,
    name: "Jane Smith",
    license: "B7654321",
    truck: "Truck 8",
    trailer: "Trailer 3",
    office: "Branch Office",
    terminal: "Terminal 2",
    status: "Resting"
  }
];


export default function SupervisorDashboard({ role, username }) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  useEffect(() => {
    async function fetchDrivers() {
      try {
        const data = await getDrivers();
        setDrivers(data);
      } catch {
        setDrivers(initialDrivers);
      }
    }
    fetchDrivers();
  }, []);
  useEffect(() => {
    async function fetchApprovals() {
      if (!username) return;
      try {
        const data = await getPendingApprovalRequestsBySupervisor(username);
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
        setPendingApprovals(list);
      } catch {
        setPendingApprovals([]);
      }
    }
    fetchApprovals();
  }, [username]);
  async function handleApprove(id) {
    try {
      await approveApprovalRequest(id);
      setPendingApprovals(list => list.filter(a => a.id !== id));
    } catch {}
  }
  async function handleReject(id) {
    try {
      await rejectApprovalRequest(id);
      setPendingApprovals(list => list.filter(a => a.id !== id));
    } catch {}
  }
  if (!username) {
    return <div style={{textAlign:'center',marginTop:'4em',fontSize:'1.5em',color:'#d32f2f'}}>No user logged in.</div>;
  }
  // Derived values
  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter(d => d.status === 'Active').length;
  const restingDrivers = drivers.filter(d => d.status === 'Resting').length;
  const offDutyDrivers = drivers.filter(d => d.status === 'Off Duty').length;
  const totalMileage = drivers.reduce((sum, d) => sum + (d.mileage || 0), 0);
  const totalCycleUsed = drivers.reduce((sum, d) => sum + (d.cycleUsed || 0), 0);
  const totalTripsToday = drivers.reduce((sum, d) => sum + (d.tripsToday || 0), 0);
  const perDriverCycleLimit = 70;
  const totalCycleLimit = perDriverCycleLimit * totalDrivers;
  const cycleProgress = totalCycleLimit > 0 ? Math.round((totalCycleUsed / totalCycleLimit) * 100) : 0;
  return (
    <div className="dashboard-container" style={{maxWidth:'1200px',margin:'0 auto',padding:'2em 1em'}}>
      <h2 style={{fontWeight:'bold',fontSize:'2.2em',color:'#1976d2',marginBottom:'1.5em',letterSpacing:'1px'}}>Supervisor Dashboard</h2>
      <div style={{display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
        <div style={{background: '#e3eafc', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Total Drivers</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{totalDrivers}</div>
        </div>
        <div style={{background: '#d1fae5', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Active</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{activeDrivers}</div>
        </div>
        <div style={{background: '#fef3c7', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Resting</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{restingDrivers}</div>
        </div>
        <div style={{background: '#f3f4f6', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Off Duty</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{offDutyDrivers}</div>
        </div>
        <div style={{background: '#e0e7ff', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Total Mileage Today</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{totalMileage} mi</div>
        </div>
        <div style={{background: '#f1f5f9', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Cycle Hours Used</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{totalCycleUsed} hrs</div>
        </div>
        <div style={{background: '#fff7ed', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Trips Today</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{totalTripsToday}</div>
        </div>
        {/* Fleet Utilization */}
        <div style={{background: '#e0f2fe', borderRadius: '8px', padding: '1rem 2rem', minWidth: '180px'}}>
          <h4>Fleet Utilization</h4>
          <div style={{fontSize: '1.2rem'}}>Trucks: 5/8</div>
          <div style={{fontSize: '1.2rem'}}>Trailers: 4/6</div>
        </div>
      </div>
      {/* Trip Progress Bar */}
      <div style={{marginBottom: '2rem'}}>
        <h4>Trip Progress (Cycle Hours)</h4>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cycleProgress}
          aria-label="Cycle hours used"
        >
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, cycleProgress))}%` }} />
          </div>
        </div>
        <div className="progress-meta">
          <span className="progress-value">{cycleProgress}%</span>
          <span className="progress-desc">Total Used: {totalCycleUsed} / {totalCycleLimit} hrs (70 × {totalDrivers} drivers)</span>
        </div>
      </div>
      {/* Supervisor-only sections */}
      <div>
        <h3 style={{ color: '#1976d2', marginBottom: '0.5em' }}>Pending Approvals</h3>
        {(!Array.isArray(pendingApprovals) || pendingApprovals.length === 0) ? (
          <div style={{ color: '#888' }}>No pending approval requests.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1em' }}>
            {pendingApprovals.map(req => (
              <div key={req.id} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '1em' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5em' }}>Trip #{req.trip.id} - {req.trip.start} → {req.trip.end}</div>
                <div style={{ color: '#555', marginBottom: '0.5em' }}>Driver: {req.trip.driver?.name || req.trip.driver?.user?.username}</div>
                <div style={{ color: '#888', marginBottom: '0.5em' }}>Date: {req.trip.date}</div>
                <div style={{ display: 'flex', gap: '0.5em' }}>
                  <button onClick={() => handleApprove(req.id)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.4em 0.8em', borderRadius: '6px' }}>Approve</button>
                  <button onClick={() => handleReject(req.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.4em 0.8em', borderRadius: '6px' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

