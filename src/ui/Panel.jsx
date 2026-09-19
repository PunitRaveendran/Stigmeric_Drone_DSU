import React from 'react';

export function Panel({ title, headerAction, children, footer, className = '' }) {
  return (
    <section className={`ui-panel ${className}`}>
      {(title || headerAction) && (
        <header className="panel-header">
          {title && <h2 className="panel-title">{title}</h2>}
          {headerAction && <div className="panel-header-action">{headerAction}</div>}
        </header>
      )}
      <div className="panel-content">{children}</div>
      {footer && <footer className="panel-footer">{footer}</footer>}
    </section>
  );
}
