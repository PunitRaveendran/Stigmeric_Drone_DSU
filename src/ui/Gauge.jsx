import React from 'react';

export function Gauge({
  value = 0,
  tone = 'auto',
  thresholds = [],
  height = 4,
  showLabel = false,
  className = '',
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  let resolvedTone = tone;
  if (tone === 'auto') {
    resolvedTone = clamped >= 70 ? 'success' : clamped >= 35 ? 'warning' : 'alert';
  }

  return (
    <div className={`gauge-container ${className}`}>
      {showLabel && (
        <div className="gauge-label-row">
          <span className="gauge-label-pct mono-num">{clamped}%</span>
        </div>
      )}
      <div className="gauge-track" style={{ height }}>
        <div
          className={`gauge-fill tone-${resolvedTone}`}
          style={{ width: `${clamped}%` }}
        />
        {thresholds.map((t, idx) => (
          <div
            key={idx}
            className="gauge-threshold-tick"
            style={{ left: `${Math.max(0, Math.min(100, t))}%` }}
          />
        ))}
      </div>
    </div>
  );
}
