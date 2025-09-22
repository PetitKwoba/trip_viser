import React, { useState, useEffect } from "react";
import { getDriverByUsername, getTripsByUsername } from './api';
import './SupervisorDashboard.css'; // Reuse styles for now

const initialDriver = {
  id: 1,
  name: "John Doe",
  license: "A1234567",
  truck: "Truck 12",
  trailer: "Trailer 7",
  office: "Main Office",
  terminal: "Terminal 1",
  status: "Active",
  mileage: 1200,
  cycleUsed: 45,
  tripsToday: 3
};

export default function DriverDashboard({ username }) {
  const [driver, setDriver] = useState(initialDriver);
  useEffect(() => {
    async function fetchDriver() {
      if (username) {
        try {
          const data = await getDriverByUsername(username);
          setDriver(data);
        } catch {
          setDriver(initialDriver);
        }
      }
    }
    fetchDriver();
  }, [username]);
  useEffect(() => {
    async function fetchRecentTrips() {
      if (!username) return;
      try {
        const trips = await getTripsByUsername(username, 5);
        if (trips && Array.isArray(trips) && trips.length > 0) {
          const summaries = trips.map(t => `${t.start} -> ${t.end} - ${t.date}`);
          setDriver(d => ({ ...d, recentTrips: summaries }));
        }
      } catch {
        // ignore; fallback remains
      }
    }
    fetchRecentTrips();
  }, [username]);
  const [showSummary, setShowSummary] = useState(false);
  if (!username) {
    return <div style={{textAlign:'center',marginTop:'4em',fontSize:'1.5em',color:'#d32f2f'}}>No user logged in.</div>;
  }
  // Anonymous leaderboard
  const leaderboard = [
    { name: 'Driver A', mileage: 1200 },
    { name: 'Driver B', mileage: 1100 },
    { name: 'You', mileage: driver.mileage || 0 }
  ];
  function getAvatar(name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{
          width: 36,
          height: 36,
          background: '#1976d2',
          color: '#fff',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.2em',
          marginRight: '0.5em'
        }}>{initials}</span>
      </span>
    );
  }
  return (
    <div className="dashboard-container" style={{maxWidth:'1200px',margin:'0 auto',padding:'2em 1em'}}>
      <h2 style={{fontWeight:'bold',fontSize:'2.2em',color:'#1976d2',marginBottom:'1.5em',letterSpacing:'1px'}}>Driver Dashboard</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'2em',marginBottom:'2em'}}>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em',display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',transition:'box-shadow 0.2s'}} onClick={()=>setShowSummary(true)}>
          {getAvatar(driver.name || (driver.user && driver.user.username) || initialDriver.name)}
          <div style={{fontWeight:'bold',fontSize:'1.3em',marginTop:'0.5em'}}>{driver.name || (driver.user && driver.user.username) || initialDriver.name}</div>
          <div style={{marginTop:'0.7em',fontSize:'1.1em'}}>Status: <span style={{fontWeight:'bold',color:driver.status==='Active'?'#388e3c':driver.status==='Resting'?'#ffa000':'#888'}}>{driver.status}</span></div>
          <div style={{marginTop:'0.7em',fontSize:'1em'}}>Mileage: <span style={{fontWeight:'bold'}}>{driver.mileage || 0}</span> mi</div>
          <div style={{marginTop:'0.7em',fontSize:'1em'}}>Cycle Used: <span style={{fontWeight:'bold'}}>{driver.cycleUsed || 0}</span> hrs</div>
        </div>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em'}}>
          <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'1em'}}>Leaderboard</h4>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'1.05em'}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th style={{textAlign:'left',padding:'0.5em'}}>Driver</th>
                <th style={{textAlign:'left',padding:'0.5em'}}>Mileage</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(stat => (
                <tr key={stat.name} style={{fontWeight:stat.name==='You'?'bold':'normal',color:stat.name==='You'?'#1976d2':'#333'}}>
                  <td style={{padding:'0.5em 0'}}>{stat.name}</td>
                  <td style={{padding:'0.5em 0'}}>{stat.mileage} mi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Show only driver summary when clicked */}
      {showSummary && (
        <>
          {/* Overlay */}
          <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(25, 118, 210, 0.18)',zIndex:1000,transition:'opacity 0.3s',animation:'fadeIn 0.3s'}} tabIndex={-1} aria-label="Profile Modal Overlay" onClick={()=>setShowSummary(false)}></div>
          {/* Modal Popup */}
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',borderRadius:'18px',boxShadow:'0 8px 32px rgba(76,110,245,0.18)',padding:'2.5em 2em 2em 2em',maxWidth:'420px',width:'95vw',zIndex:1001,transition:'all 0.3s',animation:'slideUp 0.3s',outline:'none'}} role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex={0}>
            <button style={{position:'absolute',top:'1.2em',right:'1.2em',background:'#1976d2',color:'#fff',borderRadius:'50%',padding:'0.5em 0.7em',fontWeight:'bold',fontSize:'1.2em',border:'none',boxShadow:'0 1px 4px rgba(76,110,245,0.12)',cursor:'pointer'}} aria-label="Close Profile" onClick={()=>setShowSummary(false)}>&times;</button>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'1.2em'}}>
              {/* Large Avatar */}
              <span style={{width:72,height:72,background:'#1976d2',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',fontSize:'2em',marginBottom:'0.7em',boxShadow:'0 2px 8px rgba(76,110,245,0.10)'}}>{driver.name.split(' ').map(n => n[0]).join('').toUpperCase()}</span>
              <div style={{fontWeight:'bold',fontSize:'1.4em',marginBottom:'0.3em'}}>{driver.name}</div>
              {/* Status Badge */}
              <span style={{display:'inline-block',padding:'0.3em 1em',borderRadius:'12px',background:driver.status==='Active'?'#e3fcec':driver.status==='Resting'?'#fffbe6':'#f5f5f5',color:driver.status==='Active'?'#388e3c':driver.status==='Resting'?'#ffa000':'#888',fontWeight:'bold',fontSize:'1em',marginBottom:'0.5em'}}>{driver.status}</span>
            </div>
            {/* Contact Info */}
            <div style={{marginBottom:'1em',textAlign:'center',color:'#888'}}>
              <div><span style={{fontWeight:'bold'}}>Phone:</span> {driver.phone || 'N/A'}</div>
              <div><span style={{fontWeight:'bold'}}>Email:</span> {driver.email || (driver.user && driver.user.email) || 'N/A'}</div>
            </div>
            {/* Quick Actions */}
            <div style={{display:'flex',justifyContent:'center',gap:'1em',marginBottom:'1.2em'}}>
              <button style={{padding:'0.4em 1em',borderRadius:'8px',border:'none',background:'#1976d2',color:'#fff',fontWeight:'bold',boxShadow:'0 1px 4px rgba(76,110,245,0.08)',cursor:'pointer'}}>Edit Profile</button>
              <button style={{padding:'0.4em 1em',borderRadius:'8px',border:'none',background:'#ffa000',color:'#fff',fontWeight:'bold',boxShadow:'0 1px 4px rgba(76,110,245,0.08)',cursor:'pointer'}}>Request Time Off</button>
              <button style={{padding:'0.4em 1em',borderRadius:'8px',border:'none',background:'#d32f2f',color:'#fff',fontWeight:'bold',boxShadow:'0 1px 4px rgba(76,110,245,0.08)',cursor:'pointer'}}>Report Issue</button>
            </div>
            {/* Stats & Details */}
            <div style={{marginBottom:'1em'}}>
              <div style={{marginBottom:'0.7em'}}><span style={{fontWeight:'bold'}}>Truck:</span> {driver.truck} <span style={{fontWeight:'bold',marginLeft:'1em'}}>Trailer:</span> {driver.trailer}</div>
              <div style={{marginBottom:'0.7em'}}><span style={{fontWeight:'bold'}}>Office:</span> {driver.office} <span style={{fontWeight:'bold',marginLeft:'1em'}}>Terminal:</span> {driver.terminal}</div>
              <div style={{marginBottom:'0.7em'}}><span style={{fontWeight:'bold'}}>Mileage Today:</span> {driver.mileage || 0} mi</div>
              <div style={{marginBottom:'0.7em'}}><span style={{fontWeight:'bold'}}>Cycle Hours Used:</span> {driver.cycleUsed || 0} / 70 hrs</div>
              <div style={{marginBottom:'0.7em'}}><span style={{fontWeight:'bold'}}>Trips Today:</span> {driver.tripsToday || 0}</div>
            </div>
            {/* Compliance Alerts */}
            {driver.cycleUsed > 60 && (
              <div style={{marginBottom:'1em',color:'#d32f2f',fontWeight:'bold',textAlign:'center'}}>Warning: Approaching cycle limit!</div>
            )}
            {/* Recent Trip History */}
            <div style={{marginBottom:'1em'}}>
              <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'0.5em'}}>Recent Trips</h4>
              <ul style={{margin:0,paddingLeft:'1em',color:'#555',fontSize:'1em'}}>
                {(driver.recentTrips && driver.recentTrips.length > 0) ? (
                  driver.recentTrips.map((trip, idx) => <li key={idx}>{trip}</li>)
                ) : (
                  <li>No recent trips.</li>
                )}
              </ul>
            </div>
            {/* Trip Progress Bar */}
            <div style={{marginBottom:'0.5em'}}>
              <h4 style={{marginBottom:'0.3em',color:'#1976d2'}}>Trip Progress (Cycle Hours)</h4>
              <div style={{background: '#e0eafc', borderRadius: '8px', height: '32px', width: '100%', position: 'relative'}}>
                <div style={{background: '#4f8cff', height: '100%', borderRadius: '8px', width: `${Math.round((driver.cycleUsed / 70) * 100)}%`, transition: 'width 0.3s'}}></div>
                <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#333', fontWeight: 'bold'}}>{Math.round((driver.cycleUsed / 70) * 100)}%</div>
              </div>
              <div style={{fontSize: '0.95rem', color: '#888', marginTop: '0.5rem'}}>Total Used: {driver.cycleUsed} / 70 hrs</div>
            </div>
          </div>
          {/* Animations */}
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translate(-50%, 40%); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }
            @media (max-width: 600px) {
              .profile-modal { max-width: 98vw; padding: 1em; }
            }
          `}</style>
        </>
      )}
      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'2em',marginBottom:'2em'}}>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'1em'}}>Your Status</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{driver.status}</div>
        </div>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'1em'}}>Your Mileage Today</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{driver.mileage || 0} mi</div>
        </div>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'1em'}}>Your Cycle Hours Used</h4>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{driver.cycleUsed || 0} hrs</div>
        </div>
      </div>
      {/* Trip Progress Bar */}
      <div style={{marginBottom: '2rem',background:'#fff',borderRadius:'12px',boxShadow:'0 2px 12px rgba(76,110,245,0.08)',padding:'2em'}}>
        <h4 style={{fontWeight:'bold',color:'#1976d2',marginBottom:'1em'}}>Trip Progress (Cycle Hours)</h4>
        <div style={{background: '#e0eafc', borderRadius: '8px', height: '32px', width: '100%', position: 'relative'}}>
          <div style={{background: '#4f8cff', height: '100%', borderRadius: '8px', width: `${Math.round((driver.cycleUsed / 70) * 100)}%`, transition: 'width 0.3s'}}></div>
          <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#333', fontWeight: 'bold'}}>{Math.round((driver.cycleUsed / 70) * 100)}%</div>
        </div>
        <div style={{fontSize: '0.95rem', color: '#888', marginTop: '0.5rem'}}>Total Used: {driver.cycleUsed} / 70 hrs</div>
      </div>
    </div>
  );
}
