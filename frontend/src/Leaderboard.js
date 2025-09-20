import React from "react";
import './Leaderboard.css';
import { FaMedal, FaUserCircle } from 'react-icons/fa';
import { getLeaderboard } from './api';

export default function Leaderboard({ username = "You" }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [sortBy, setSortBy] = React.useState('mileage');
  const [period, setPeriod] = React.useState('week');

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
  const data = await getLeaderboard(username, 5, period);
        if (cancelled) return;
        const top = Array.isArray(data?.top) ? data.top : [];
        const me = data?.me || null; // can be null if already in top
        const combined = me ? [...top, me] : top;
        // Ensure properties are present and types consistent
        const rows = combined.map(x => ({
          name: x.name || x.username || 'Unknown',
          username: x.username || (x.name || '').toLowerCase(),
          mileage: Number(x.mileage || 0),
          rank: Number(x.rank || 0),
        }));
        setRows(rows);
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load leaderboard');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [username, period]);

  const displayed = React.useMemo(() => {
    const copy = rows.slice();
    if (sortBy === 'mileage') {
      copy.sort((a, b) => b.mileage - a.mileage);
    } else if (sortBy === 'rank') {
      copy.sort((a, b) => a.rank - b.rank);
    }
    return copy;
  }, [rows, sortBy]);

  return (
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">Leaderboard</h2>
      <div className="leaderboard-controls">
        <label htmlFor="sort">Sort by:</label>
        <select id="sort" className="leaderboard-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="mileage">Mileage</option>
          <option value="rank">Rank</option>
        </select>
        <label htmlFor="filter">Period:</label>
        <select
          id="filter"
          className="leaderboard-filter"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Period summary */}
      {!loading && !error && (
        <div aria-live="polite" style={{ marginBottom: '0.5rem', color: '#555' }}>
          Showing <strong>{period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}</strong>
        </div>
      )}

      {loading && <div style={{ color: '#1976d2', fontWeight: 'bold' }}>Loading leaderboard...</div>}
      {error && <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>{error}</div>}

      {!loading && (
        <table className="leaderboard-table" aria-label="Driver Leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Driver</th>
              <th>Mileage</th>
              <th>Progress</th>
              <th>Personal Best</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((driver) => (
              <tr key={`${driver.rank}-${driver.username || driver.name}`} className={driver.username === username ? "leaderboard-row highlight" : "leaderboard-row"}>
                <td>
                  {driver.rank <= 3 ? (
                    <FaMedal title={`Top ${driver.rank}`} style={{ color: driver.rank === 1 ? '#ffd700' : driver.rank === 2 ? '#c0c0c0' : '#cd7f32', fontSize: '1.3em' }} />
                  ) : (
                    <span>{driver.rank}</span>
                  )}
                </td>
                <td>
                  <FaUserCircle style={{ color: '#1976d2', fontSize: '1.2em', verticalAlign: 'middle', marginRight: '0.3em' }} />
                  {driver.name}
                  {driver.username === username && (
                    <span
                      aria-label="You"
                      title="You"
                      style={{
                        marginLeft: '0.5rem',
                        background: '#e8f0fe',
                        color: '#1a73e8',
                        borderRadius: '12px',
                        padding: '0.1rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      You
                    </span>
                  )}
                </td>
                <td>{driver.mileage} mi</td>
                <td>
                  <div className="progress-bar" title={`Progress to next rank: ${Math.min(100, Math.round((driver.mileage / 1300) * 100))}%`}>
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.round((driver.mileage / 1300) * 100))}%` }}></div>
                  </div>
                </td>
                <td>
                  <span className="personal-best" title="Personal Best">{driver.mileage + 50} mi</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="leaderboard-stats">
        <div className="stat-card">
          <strong>Top 10%</strong>
          <span>Miles to next rank: 100</span>
        </div>
        <div className="stat-card">
          <strong>Personal Best</strong>
          <span>1350 mi</span>
        </div>
        <div className="stat-card">
          <strong>Motivation</strong>
          <span>Keep driving safely!</span>
        </div>
      </div>
      <div className="leaderboard-help">
        <a href="#faq" tabIndex={0}>FAQ</a> | <a href="#support" tabIndex={0}>Contact Support</a>
      </div>
    </div>
  );
}
