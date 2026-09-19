import React from 'react';

export function StatCard({ title, badge, children, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      {(title || badge) && (
        <div className="stat-card-header">
          {title && <h3 className="stat-card-title">{title}</h3>}
          {badge && <div className="stat-card-badge-wrap">{badge}</div>}
        </div>
      )}
      <div className="stat-card-body">{children}</div>
    </div>
  );
}
