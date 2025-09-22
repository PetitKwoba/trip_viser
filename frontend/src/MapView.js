import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const position = [39.8283, -98.5795]; // Center of USA
const route = [
  [39.8283, -98.5795],
  [40.7128, -74.0060], // Example: New York
  [34.0522, -118.2437], // Example: Los Angeles
];

function MapView() {
  return (
    <MapContainer center={position} zoom={4} style={{ height: '300px', width: '100%', borderRadius: '8px' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Marker position={route[0]} />
      <Marker position={route[1]} />
      <Marker position={route[2]} />
      <Polyline positions={route} color="blue" />
    </MapContainer>
  );
}

export default MapView;
