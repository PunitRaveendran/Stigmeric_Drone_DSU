import React, { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`ErrorBoundary caught error in ${this.props.name || 'component'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel-error-fallback">
          <AlertTriangle size={16} className="error-icon" />
          <div className="error-copy">
            <strong>{this.props.name || 'Panel'} Error</strong>
            <span className="text-muted text-xs">Telemetry rendering interrupted.</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
