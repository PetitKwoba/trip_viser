import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultPosition = [39.8283, -98.5795]; // Center of USA

function LocationPicker({ onSelect, selected, setSelected }) {
  useMapEvents({
    click(e) {
      setSelected(e.latlng);
    }
  });
  // Show a dot marker at selected location
  if (selected) {
    const dotIcon = L.divIcon({
      className: 'custom-dot-marker',
      html: '<div style="width:16px;height:16px;background:#1976d2;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px #1976d2;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    return <Marker position={selected} icon={dotIcon} />;
  }
  return null;
}

function MapPicker({ onSelect, onCancel }) {
  const [initialLocation, setInitialLocation] = React.useState(null);
  const [initialDisplayName, setInitialDisplayName] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [mapCenter, setMapCenter] = React.useState(defaultPosition);
  const [pickedDisplayName, setPickedDisplayName] = React.useState('');
  const [fetchError, setFetchError] = React.useState("");

  React.useEffect(() => {
    // Try to get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMapCenter([lat, lng]);
          setInitialLocation({ lat, lng });
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
              setInitialDisplayName(data.display_name);
              setFetchError("");
            })
            .catch(() => {
              setFetchError("Failed to fetch location data. Please check your connection or try again later.");
            });
        },
        () => {
          // Fallback to default center
          setInitialLocation({ lat: defaultPosition[0], lng: defaultPosition[1] });
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${defaultPosition[0]}&lon=${defaultPosition[1]}`)
            .then(res => res.json())
            .then(data => {
              setInitialDisplayName(data.display_name);
              setFetchError("");
            })
            .catch(() => {
              setFetchError("Failed to fetch location data. Please check your connection or try again later.");
            });
        }
      );
    } else {
      // No geolocation support
      setInitialLocation({ lat: defaultPosition[0], lng: defaultPosition[1] });
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${defaultPosition[0]}&lon=${defaultPosition[1]}`)
        .then(res => res.json())
        .then(data => {
          setInitialDisplayName(data.display_name);
          setFetchError("");
        })
        .catch(() => {
          setFetchError("Failed to fetch location data. Please check your connection or try again later.");
        });
    }
  }, []);

  // Handler for choosing location
  const handleChooseLocation = () => {
    if (selected) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selected.lat}&lon=${selected.lng}`)
        .then(res => res.json())
        .then(data => {
          setPickedDisplayName(data.display_name);
          setFetchError("");
          onSelect(selected, data.display_name);
        })
        .catch(() => {
          setFetchError("Failed to fetch location data. Please check your connection or try again later.");
          onSelect(selected);
        });
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '1em', padding: '2em', minWidth: '340px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
      <h3>Enter Logs</h3>
      <div style={{ height: '300px', width: '100%', borderRadius: '1em', marginBottom: '1em' }}>
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {initialLocation && !selected && (
            <Marker position={initialLocation} />
          )}
          <LocationPicker onSelect={onSelect} selected={selected} setSelected={setSelected} />
        </MapContainer>
      </div>
      {/* HOS assumptions info, shown below the map */}
      <div style={{ background:'#f6f8fa', borderRadius:'10px', padding:'0.8em 1em', margin:'0.8em 0 1.2em 0', color:'#333' }}>
        <div style={{ fontWeight:'bold', marginBottom:'0.3em', color:'#1976d2' }}>Assumptions (HOS):</div>
        <ul style={{ margin:'0 0 0.5em 1.2em' }}>
          <li>Property-carrying driver, 70 hrs/8 days, no adverse driving conditions</li>
          <li>Fueling at least once every 1,000 miles</li>
          <li>1 hour for pickup and 1 hour for drop-off (On Duty, not driving)</li>
        </ul>
      </div>
      {fetchError && (
        <div style={{ color: '#e53935', fontWeight: 'bold', marginBottom: '1em' }}>{fetchError}</div>
      )}
      {initialDisplayName && !fetchError && (
        <div style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: '1em' }}>Nearest Location: {initialDisplayName}</div>
      )}
      {selected && (
        <div style={{ color: '#388e3c', fontWeight: 'bold', marginBottom: '1em' }}>Selected: Lat {selected.lat.toFixed(5)}, Lng {selected.lng.toFixed(5)}</div>
      )}
      <button
        style={{ background: selected ? '#1976d2' : '#888', color: '#fff', borderRadius: '6px', padding: '0.8rem 1.5rem', fontWeight: 'bold', fontSize: '1rem', cursor: selected ? 'pointer' : 'not-allowed', marginTop: '1rem', marginRight: '1em' }}
        onClick={handleChooseLocation}
        disabled={!selected}
      >Choose Location</button>
      <button style={{ background: '#e53935', color: '#fff', borderRadius: '6px', padding: '0.8rem 1.5rem', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '1rem' }} onClick={onCancel}>Cancel</button>
      <div style={{ color: '#888', marginTop: '1em' }}>Click anywhere on the map to select a location.</div>
    </div>
  );
}

export default MapPicker;
