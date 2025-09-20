import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css";

// Removed duplicate Navbar declaration

const Navbar = ({ role, onLogout }) => {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }) => isActive ? 'active' : undefined;
  const closeMenu = () => setOpen(false);
  const linkStyle = ({ isActive }) => (isActive ? { color: '#1976d2', fontWeight: 'bold' } : undefined);
  return (
    <nav className="navbar" role="navigation" aria-label="Main">
      <div className="navbar-header">
        <div className="navbar-logo">Trip Viser</div>
        <button
          className="navbar-toggle"
          aria-label="Toggle navigation menu"
          aria-controls="primary-navigation"
          aria-expanded={open ? 'true' : 'false'}
          onClick={() => setOpen(o => !o)}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
      </div>
      <ul id="primary-navigation" className={`navbar-links ${open ? 'open' : ''}`}>
        {role === "supervisor" && <>
          <li><NavLink to="/dashboard" onClick={closeMenu} className={linkClass} style={linkStyle}>Dashboard</NavLink></li>
          <li><NavLink to="/drivers" onClick={closeMenu} className={linkClass} style={linkStyle}>Drivers</NavLink></li>
          <li><NavLink to="/eld-logs" onClick={closeMenu} className={linkClass} style={linkStyle}>ELD Logs</NavLink></li>
          <li><NavLink to="/analytics" onClick={closeMenu} className={linkClass} style={linkStyle}>Analytics</NavLink></li>
          <li><NavLink to="/calendar" onClick={closeMenu} className={linkClass} style={linkStyle}>Calendar</NavLink></li>
          <li><NavLink to="/notifications" onClick={closeMenu} className={linkClass} style={linkStyle}>Notifications</NavLink></li>
          <li><NavLink to="/export" onClick={closeMenu} className={linkClass} style={linkStyle}>Export/Report</NavLink></li>
          <li><NavLink to="/settings" onClick={closeMenu} className={linkClass} style={linkStyle}>Settings</NavLink></li>
        </>}
        {role === "driver" && <>
          <li><NavLink to="/dashboard" onClick={closeMenu} className={linkClass} style={linkStyle}>Dashboard</NavLink></li>
          <li><NavLink to="/leaderboard" onClick={closeMenu} className={linkClass} style={linkStyle}>Leaderboard</NavLink></li>
          <li>
            <NavLink
              to="/enter-log"
              onClick={closeMenu}
              className={linkClass}
              style={linkStyle}
              aria-label="Enter ELD log (create a new trip and ELD log)"
              title="Enter ELD log (create a new trip and ELD log)"
              data-testid="nav-enter-log"
            >
              Enter ELD Log
            </NavLink>
          </li>
          <li><NavLink to="/eld-logs" onClick={closeMenu} className={linkClass} style={linkStyle}>ELD Logs</NavLink></li>
          <li><NavLink to="/calendar" onClick={closeMenu} className={linkClass} style={linkStyle}>Calendar</NavLink></li>
          <li><NavLink to="/settings" onClick={closeMenu} className={linkClass} style={linkStyle}>Settings</NavLink></li>
        </>}
        <li>
          <button onClick={() => { closeMenu(); onLogout(); }} style={{background: '#ff4b2b', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer'}}>Logout</button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
