import React, { useState, useEffect } from "react";
import './SupervisorDashboard.css';
import { FaUserCircle, FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import { getDrivers } from './api';

function Drivers() {
  // Export drivers to CSV
  function handleExportCSV() {
    const cols = Object.keys(showCols).filter(col => showCols[col] && col !== 'actions');
    const header = cols.map(col => col.charAt(0).toUpperCase() + col.slice(1)).join(',');
    const rows = drivers.map(d => cols.map(col => JSON.stringify(d[col] || '')).join(',')).join('\n');
    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drivers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Print drivers table
  function handlePrint() {
    const printContents = document.getElementById('drivers-table-print').innerHTML;
    const win = window.open('', '', 'height=700,width=1000');
    win.document.write('<html><head><title>Drivers List</title>');
    win.document.write('<style>table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:8px;}th{background:#f5f5f5;}</style>');
    win.document.write('</head><body>');
    win.document.write(printContents);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  }
  // ...existing code continues...

  const [drivers, setDrivers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDriver, setModalDriver] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    license: "",
    truck: "",
    trailer: "",
    office: "",
    terminal: "",
    status: "Active"
  });
  const [selected, setSelected] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showCols, setShowCols] = useState({
    name: true,
    license: true,
    truck: true,
    trailer: true,
    office: true,
    terminal: true,
    status: true,
    actions: true
  });
  const pageSize = 5;

  // Fetch drivers from backend API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");
    const api = getDrivers;
    const maybePromise = typeof api === 'function' ? api() : Promise.reject(new Error('api unavailable'));
    (maybePromise || Promise.reject(new Error('api returned falsy')))
      .then(data => {
        if (isMounted) setDrivers(data);
      })
      .catch(err => {
        if (isMounted) setError("Failed to load drivers. Please try again later.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Sorting
  function sortDrivers(list) {
    return [...list].sort((a, b) => {
      if (!a[sortBy] || !b[sortBy]) return 0;
      if (a[sortBy] < b[sortBy]) return sortDir === 'asc' ? -1 : 1;
      if (a[sortBy] > b[sortBy]) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Filtered drivers
  const filteredDrivers = sortDrivers(drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.license.toLowerCase().includes(search.toLowerCase())
  ));

  // Pagination
  const totalPages = Math.ceil(filteredDrivers.length / pageSize);
  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleCreateDriver(e) {
    e.preventDefault();
    if (form.name && form.license && form.truck && form.trailer) {
      setDrivers([
        ...drivers,
        { ...form, id: Date.now() }
      ]);
      setForm({
        name: "",
        license: "",
        truck: "",
        trailer: "",
        office: "",
        terminal: "",
        status: "Active"
      });
    }
  }

  function handleSelect(id) {
    setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      setSelected(paginatedDrivers.map(d => d.id));
    } else {
      setSelected([]);
    }
  }

  function handleDelete(id) {
    setDrivers(drivers.filter(d => d.id !== id));
    setSelected(selected.filter(s => s !== id));
  }

  function handleView(driver) {
    setModalDriver(driver);
    setEditMode(false);
    setModalOpen(true);
  }

  function handleEdit(driver) {
    setModalDriver(driver);
    setEditMode(true);
    setModalOpen(true);
  }

  function handleModalChange(e) {
    setModalDriver({ ...modalDriver, [e.target.name]: e.target.value });
  }

  function handleModalSave() {
    setDrivers(drivers.map(d => d.id === modalDriver.id ? modalDriver : d));
    setModalOpen(false);
    setEditMode(false);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditMode(false);
  }

  function handlePageChange(page) {
    setCurrentPage(page);
    setSelected([]);
  }

  function getStatusBadge(status) {
    const color = status === "Active" ? "#4caf50" : status === "Resting" ? "#ff9800" : "#9e9e9e";
    return (
      <span style={{
        background: color,
        color: "#fff",
        padding: "0.3em 0.7em",
        borderRadius: "1em",
        fontSize: "0.9em"
      }}>{status}</span>
    );
  }

  function getAvatar(name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <FaUserCircle style={{ fontSize: '1.5em', marginRight: '0.3em', color: '#1976d2' }} />
        <span style={{ fontWeight: 'bold', fontSize: '1em' }}>{initials}</span>
      </span>
    );
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  return (
    <div className="dashboard-container">
      <h2>Drivers</h2>
      <div className="dashboard-actions" style={{display: 'flex', alignItems: 'center', gap: '1em'}}>
        <input
          type="text"
          placeholder="Search drivers by name or license..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {error && <div style={{color:'#e53935',fontWeight:'bold',marginBottom:'1em'}}>{error}</div>}
        <button onClick={() => setCreateOpen(true)} style={{background: '#1976d2', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em', fontSize: '1em'}}>+ Create Driver</button>
        <button onClick={handleExportCSV} style={{background: '#388e3c', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em', fontSize: '1em'}}>Export CSV</button>
        <button onClick={handlePrint} style={{background: '#ffa000', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em', fontSize: '1em'}}>Print</button>
      </div>
      {/* Bulk Action Bar */}
      {selected.length > 0 && (
        <div style={{position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '0.5em 1em', marginBottom: '0.5em', borderRadius: '0.5em', display: 'flex', alignItems: 'center', gap: '1em'}}>
          <span style={{fontWeight: 'bold', fontSize: '1.1em'}}>{selected.length} selected</span>
          <button aria-label="Bulk View" title="View Selected" style={{background: '#e3f2fd', color: '#1976d2', fontWeight: 'bold', fontSize: '1em', border: '2px solid #1976d2', borderRadius: '0.5em', padding: '0.4em 1em'}} onClick={() => setModalOpen('view')}><FaEye style={{fontSize: '1.2em', marginRight: '0.5em'}} />View</button>
          <button aria-label="Bulk Edit" title="Edit Selected" style={{background: '#e8f5e9', color: '#388e3c', fontWeight: 'bold', fontSize: '1em', border: '2px solid #388e3c', borderRadius: '0.5em', padding: '0.4em 1em'}} onClick={() => setModalOpen('edit')}><FaEdit style={{fontSize: '1.2em', marginRight: '0.5em'}} />Edit</button>
          <button aria-label="Bulk Delete" title="Delete Selected" style={{background: '#ffebee', color: '#d32f2f', fontWeight: 'bold', fontSize: '1em', border: '2px solid #d32f2f', borderRadius: '0.5em', padding: '0.4em 1em'}} onClick={() => setModalOpen('delete')}><FaTrash style={{fontSize: '1.2em', marginRight: '0.5em'}} />Delete</button>
        </div>
      )}
      {/* Customizable Columns Controls */}
      <div style={{marginBottom: '0.5em', display: 'flex', flexWrap: 'wrap', gap: '1em'}}>
        <span style={{fontWeight: 'bold'}}>Show Columns:</span>
        {Object.keys(showCols).map(col => (
          <label key={col} style={{fontSize: '0.95em'}}>
            <input type="checkbox" checked={showCols[col]} onChange={e => setShowCols({...showCols, [col]: e.target.checked})} /> {col.charAt(0).toUpperCase() + col.slice(1)}
          </label>
        ))}
      </div>
      <div style={{overflowX: 'auto', width: '100%', marginBottom: '1em'}}>
        <div id="drivers-table-print">
          <table className="driver-table" style={{minWidth: '900px', width: '100%', borderCollapse: 'collapse'}}>
            <thead style={{position: 'sticky', top: selected.length > 0 ? '3em' : 0, background: '#f5f5f5', zIndex: 5}}>
              <tr>
                <th>
                  <input type="checkbox" onChange={handleSelectAll}
                    checked={paginatedDrivers.length > 0 && selected.length === paginatedDrivers.length}
                    aria-label="Select all drivers" />
                </th>
                {showCols.name && <th style={{cursor: 'pointer'}} onClick={() => handleSort('name')} aria-label="Sort by Name">Name {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.license && <th style={{cursor: 'pointer'}} onClick={() => handleSort('license')} aria-label="Sort by License">License # {sortBy === 'license' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.truck && <th style={{cursor: 'pointer'}} onClick={() => handleSort('truck')} aria-label="Sort by Truck">Truck {sortBy === 'truck' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.trailer && <th style={{cursor: 'pointer'}} onClick={() => handleSort('trailer')} aria-label="Sort by Trailer">Trailer {sortBy === 'trailer' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.office && <th style={{cursor: 'pointer'}} onClick={() => handleSort('office')} aria-label="Sort by Office">Main Office {sortBy === 'office' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.terminal && <th style={{cursor: 'pointer'}} onClick={() => handleSort('terminal')} aria-label="Sort by Terminal">Terminal {sortBy === 'terminal' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>}
                {showCols.status && <th>Status</th>}
                {showCols.actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={Object.values(showCols).filter(Boolean).length + 1} style={{textAlign: 'center', padding: '2em'}}><span role="status" aria-live="polite">Loading...</span></td></tr>
              ) : paginatedDrivers.length === 0 ? (
                <tr><td colSpan={Object.values(showCols).filter(Boolean).length + 1} style={{textAlign: 'center', padding: '2em'}}><span role="status" aria-live="polite">No drivers found.</span></td></tr>
              ) : paginatedDrivers.map(driver => (
              <tr key={driver.id} style={{transition: 'background 0.2s', cursor: 'pointer'}} tabIndex={0} aria-label={`Driver ${driver.name}`}
                onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
                onFocus={e => e.currentTarget.style.background = '#e3f2fd'}
                onBlur={e => e.currentTarget.style.background = ''}
              >
                <td>
                  <input type="checkbox" checked={selected.includes(driver.id)} onChange={() => handleSelect(driver.id)} aria-label={`Select ${driver.name}`} />
                </td>
                {showCols.name && (
                  <td style={{maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
                      {getAvatar(driver.name)}
                      <span>{driver.name}</span>
                    </span>
                  </td>
                )}
                {showCols.license && <td style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{driver.license}</td>}
                {showCols.truck && <td style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{driver.truck}</td>}
                {showCols.trailer && <td style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{driver.trailer}</td>}
                {showCols.office && <td style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{driver.office}</td>}
                {showCols.terminal && <td style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{driver.terminal}</td>}
                {showCols.status && <td>{getStatusBadge(driver.status)}</td>}
                {showCols.actions && <td style={{display: 'flex', gap: '0.2em'}}>
                  <button title="View" aria-label={`View ${driver.name}`} style={{background: 'none', border: 'none', padding: '0.2em', cursor: 'pointer'}} onClick={() => handleView(driver)}><FaEye /></button>
                  <button title="Edit" aria-label={`Edit ${driver.name}`} style={{background: 'none', border: 'none', padding: '0.2em', cursor: 'pointer'}} onClick={() => handleEdit(driver)}><FaEdit /></button>
                  <button title="Delete" aria-label={`Delete ${driver.name}`} onClick={() => handleDelete(driver.id)} style={{background: 'none', border: 'none', padding: '0.2em', color: '#d32f2f', cursor: 'pointer'}}><FaTrash /></button>
                </td>}
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Multi-Driver Modal */}
      {modalOpen === 'view' && selected.length > 0 && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#fff', borderRadius: '1em', padding: '2em', minWidth: '340px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'}}>
            <h2 style={{marginBottom: '1em'}}>Selected Drivers</h2>
            <div style={{maxHeight: '60vh', overflowY: 'auto'}}>
              {drivers.filter(d => selected.includes(d.id)).map(driver => (
                <div key={driver.id} style={{borderBottom: '1px solid #eee', padding: '1em 0'}}>
                  <div style={{fontWeight: 'bold', fontSize: '1.1em'}}>{driver.name}</div>
                  <div>License: {driver.license}</div>
                  <div>Truck: {driver.truck}</div>
                  <div>Trailer: {driver.trailer}</div>
                  <div>Office: {driver.office}</div>
                  <div>Terminal: {driver.terminal}</div>
                  <div>Status: {getStatusBadge(driver.status)}</div>
                </div>
              ))}
            </div>
            <div style={{display: 'flex', gap: '1em', marginTop: '1em', justifyContent: 'flex-end'}}>
              <button onClick={() => setModalOpen(false)} style={{background: '#1976d2', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen === 'edit' && selected.length > 0 && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#fff', borderRadius: '1em', padding: '2em', minWidth: '340px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'}}>
            <h2 style={{marginBottom: '1em'}}>Edit Selected Drivers</h2>
            <div style={{maxHeight: '60vh', overflowY: 'auto'}}>
              {drivers.filter(d => selected.includes(d.id)).map(driver => (
                <form key={driver.id} onSubmit={e => {e.preventDefault();}} style={{borderBottom: '1px solid #eee', padding: '1em 0', display: 'grid', gap: '0.5em'}}>
                  <input name="name" type="text" value={driver.name} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, name: e.target.value} : d))} required />
                  <input name="license" type="text" value={driver.license} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, license: e.target.value} : d))} required />
                  <input name="truck" type="text" value={driver.truck} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, truck: e.target.value} : d))} required />
                  <input name="trailer" type="text" value={driver.trailer} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, trailer: e.target.value} : d))} required />
                  <input name="office" type="text" value={driver.office} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, office: e.target.value} : d))} />
                  <input name="terminal" type="text" value={driver.terminal} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, terminal: e.target.value} : d))} />
                  <select name="status" value={driver.status} onChange={e => setDrivers(drivers.map(d => d.id === driver.id ? {...d, status: e.target.value} : d))}>
                    <option value="Active">Active</option>
                    <option value="Resting">Resting</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </form>
              ))}
            </div>
            <div style={{display: 'flex', gap: '1em', marginTop: '1em', justifyContent: 'flex-end'}}>
              <button onClick={() => setModalOpen(false)} style={{background: '#388e3c', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Done</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen === 'delete' && selected.length > 0 && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#fff', borderRadius: '1em', padding: '2em', minWidth: '340px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'}}>
            <h2 style={{marginBottom: '1em', color: '#d32f2f'}}>Delete Selected Drivers</h2>
            <div style={{maxHeight: '60vh', overflowY: 'auto'}}>
              {drivers.filter(d => selected.includes(d.id)).map(driver => (
                <div key={driver.id} style={{borderBottom: '1px solid #eee', padding: '1em 0'}}>
                  <div style={{fontWeight: 'bold', fontSize: '1.1em'}}>{driver.name}</div>
                  <div>License: {driver.license}</div>
                  <div>Truck: {driver.truck}</div>
                  <div>Trailer: {driver.trailer}</div>
                  <div>Status: {getStatusBadge(driver.status)}</div>
                </div>
              ))}
            </div>
            <div style={{display: 'flex', gap: '1em', marginTop: '1em', justifyContent: 'flex-end'}}>
              <button onClick={() => {selected.forEach(handleDelete); setModalOpen(false);}} style={{background: '#d32f2f', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Delete All</button>
              <button onClick={() => setModalOpen(false)} style={{background: '#1976d2', color: '#fff', fontWeight: 'bold', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Pagination Controls */}
      <div style={{margin: '1em 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5em'}}>
        {Array.from({length: totalPages}, (_, i) => (
          <button key={i+1} onClick={() => handlePageChange(i+1)} disabled={currentPage === i+1} style={{padding: '0.4em 1em', borderRadius: '0.5em', background: currentPage === i+1 ? '#1976d2' : '#eee', color: currentPage === i+1 ? '#fff' : '#333', border: 'none', cursor: 'pointer', marginBottom: '0.3em'}}>{i+1}</button>
        ))}
      </div>
      {/* Create Driver Modal */}
      {createOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#fff', borderRadius: '1em', padding: '2em', minWidth: '340px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'}}>
            <h2 style={{marginBottom: '1em'}}>Create New Driver</h2>
            <form onSubmit={e => {handleCreateDriver(e); setCreateOpen(false);}} style={{display: 'grid', gap: '1rem', maxWidth: '400px'}}>
              <input name="name" type="text" placeholder="Driver Name" value={form.name} onChange={handleInput} required />
              <input name="license" type="text" placeholder="License Number" value={form.license} onChange={handleInput} required />
              <input name="truck" type="text" placeholder="Truck Number/Plate" value={form.truck} onChange={handleInput} required />
              <input name="trailer" type="text" placeholder="Trailer Number/Plate" value={form.trailer} onChange={handleInput} required />
              <input name="office" type="text" placeholder="Main Office" value={form.office} onChange={handleInput} />
              <input name="terminal" type="text" placeholder="Terminal" value={form.terminal} onChange={handleInput} />
              <select name="status" value={form.status} onChange={handleInput}>
                <option value="Active">Active</option>
                <option value="Resting">Resting</option>
                <option value="Off Duty">Off Duty</option>
              </select>
              <div style={{display: 'flex', gap: '1em', marginTop: '1em', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setCreateOpen(false)} style={{background: '#888', color: '#fff', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Cancel</button>
                <button type="submit" style={{background: '#1976d2', color: '#fff', borderRadius: '0.5em', padding: '0.5em 1.2em'}}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drivers;
