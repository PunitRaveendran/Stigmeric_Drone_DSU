import React from 'react';

export function IconButton({
  icon: Icon,
  label,
  active = false,
  onClick,
  tone = 'default',
  size = 'md',
  disabled = false,
  title,
  className = '',
}) {
  return (
    <button
      type="button"
      className={`icon-button btn-size-${size} btn-tone-${tone} ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={label}
      aria-pressed={active}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} className="btn-icon" />}
      {label && <span className="btn-label">{label}</span>}
    </button>
  );
}
