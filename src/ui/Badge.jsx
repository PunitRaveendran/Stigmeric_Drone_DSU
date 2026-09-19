import React from 'react';

export function Badge({ children, tone = 'default', variant = 'subtle', icon: Icon, className = '' }) {
  return (
    <span className={`ui-badge badge-tone-${tone} badge-var-${variant} ${className}`}>
      {Icon && <Icon size={12} className="badge-icon" />}
      <span className="badge-text">{children}</span>
    </span>
  );
}
