'use client';

// TEMPORARY — mobile crash debugging. Shows the actual error + stack on
// screen instead of a blank page. Remove once the crash is identified.

import React from 'react';

interface State {
  error: Error | null;
}

export class EstimatorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{
          background: '#b91c1c',
          color: '#fff',
          padding: '20px',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
            Estimator Error:
          </h1>
          <p style={{ fontSize: '15px', marginBottom: '16px', wordBreak: 'break-word' }}>
            {err.message}
          </p>
          <pre style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'rgba(0,0,0,0.3)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            maxHeight: '50vh',
            overflowY: 'auto',
          }}>
            {err.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#fff',
              color: '#b91c1c',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
