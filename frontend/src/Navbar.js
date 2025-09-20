import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css";

// Removed duplicate Navbar declaration

const Navbar = ({ role, onLogout }) => {
  const linkClass = ({ isActive }) => isActive ? 'active' : undefined;
  const linkStyle = ({ isActive }) => (isActive ? { color: '#1976d2', fontWeight: 'bold' } : undefined);
  return (
    <nav className="navbar" role="navigation" aria-label="Main">
      <div className="navbar-logo">Trip Viser</div>
      <ul className="navbar-links">
        {role === "supervisor" && <>
          <li><NavLink to="/dashboard" className={linkClass} style={linkStyle}>Dashboard</NavLink></li>
          <li><NavLink to="/drivers" className={linkClass} style={linkStyle}>Drivers</NavLink></li>
          <li><NavLink to="/eld-logs" className={linkClass} style={linkStyle}>ELD Logs</NavLink></li>
          <li><NavLink to="/analytics" className={linkClass} style={linkStyle}>Analytics</NavLink></li>
          <li><NavLink to="/calendar" className={linkClass} style={linkStyle}>Calendar</NavLink></li>
          <li><NavLink to="/notifications" className={linkClass} style={linkStyle}>Notifications</NavLink></li>
          <li><NavLink to="/export" className={linkClass} style={linkStyle}>Export/Report</NavLink></li>
          <li><NavLink to="/settings" className={linkClass} style={linkStyle}>Settings</NavLink></li>
        </>}
        {role === "driver" && <>
          <li><NavLink to="/dashboard" className={linkClass} style={linkStyle}>Dashboard</NavLink></li>
          <li><NavLink to="/leaderboard" className={linkClass} style={linkStyle}>Leaderboard</NavLink></li>
          <li>
            <NavLink
              to="/enter-log"
              className={linkClass}
              style={linkStyle}
              aria-label="Enter ELD log (create a new trip and ELD log)"
              title="Enter ELD log (create a new trip and ELD log)"
              data-testid="nav-enter-log"
            >
              Enter ELD Log
            </NavLink>
          </li>
          <li><NavLink to="/eld-logs" className={linkClass} style={linkStyle}>ELD Logs</NavLink></li>
          <li><NavLink to="/calendar" className={linkClass} style={linkStyle}>Calendar</NavLink></li>
          <li><NavLink to="/settings" className={linkClass} style={linkStyle}>Settings</NavLink></li>
        </>}
        <li>
          <button onClick={onLogout} style={{background: '#ff4b2b', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer'}}>Logout</button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
