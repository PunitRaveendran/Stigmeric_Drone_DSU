import React from 'react';

export function Metric({ label, value, unit, tone = 'default', sub, className = '' }) {
  return (
    <div className={`metric-cell tone-${tone} ${className}`}>
      {label && <span className="metric-label">{label}</span>}
      <div className="metric-value-row">
        <strong className="metric-value mono-num">{value}</strong>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}
