import React from 'react';

/**
 * Persistent visual indicator showing that displayed data is simulated.
 */
export const DemoBadge = ({ style = {} }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.45rem',
      padding: '0.28rem 0.65rem',
      backgroundColor: 'rgba(200, 107, 60, 0.16)',
      border: '1px solid var(--burnt-orange, #C86B3C)',
      borderRadius: '2px',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '0.7rem',
      fontWeight: 700,
      color: 'var(--burnt-orange, #C86B3C)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      ...style,
    }}
    role="status"
    aria-label="Demo Data Mode Active"
  >
    <span
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: 'var(--burnt-orange, #C86B3C)',
        boxShadow: '0 0 6px rgba(200, 107, 60, 0.8)',
      }}
    />
    DEMO DATA - SIMULATED
  </div>
);

/**
 * Subtle watermark placed inside chart containers when Demo Mode is active.
 */
export const ChartWatermark = () => (
  <div
    style={{
      position: 'absolute',
      right: '12px',
      bottom: '8px',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '0.62rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'rgba(200, 107, 60, 0.28)',
      textTransform: 'uppercase',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 2,
    }}
    aria-hidden="true"
  >
    DEMO SIMULATION
  </div>
);

