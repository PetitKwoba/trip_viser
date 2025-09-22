import React from "react";
export default function ExportReport() {
  return (
    <div className="dashboard-container">
      <h2>Export / Report</h2>
      <div style={{background: '#f1f5f9', borderRadius: '8px', padding: '2rem', color: '#888'}}>
        <button style={{marginRight: '1rem'}}>Export CSV</button>
        <button>Export PDF</button>
        <div style={{marginTop: '2rem'}}>[Export/Report Placeholder]</div>
      </div>
    </div>
  );
}
