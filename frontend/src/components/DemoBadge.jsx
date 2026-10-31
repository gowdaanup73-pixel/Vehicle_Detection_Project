import React, { useEffect } from 'react';

/**
 * Small "DEMO" chip displayed in view headers when Demo Mode is active.
 */
export const DemoChip = ({ style = {} }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.15rem 0.45rem',
      backgroundColor: 'rgba(200, 107, 60, 0.18)',
      border: '1px solid var(--burnt-orange, #C86B3C)',
      borderRadius: '2px',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '0.64rem',
      fontWeight: 800,
      color: 'var(--burnt-orange, #C86B3C)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1,
      ...style,
    }}
    role="status"
    aria-label="Demo mode active"
  >
    DEMO
  </span>
);

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

/**
 * Tiny switch toggle (~28x14px, no text label, tooltip "Demo data") placed
 * immediately left of the Refresh button in the page header.
 * Supports keyboard accessibility (Space/Enter) and Alt+D global shortcut.
 */
export const DemoSwitch = ({ isDemoMode = false, onToggle, style = {} }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        onToggle?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDemoMode}
      aria-label="Toggle demo data"
      title="Demo data (Alt+D)"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle?.();
        }
      }}
      style={{
        width: '28px',
        height: '14px',
        borderRadius: '7px',
        backgroundColor: isDemoMode ? 'var(--burnt-orange, #C86B3C)' : 'var(--charcoal-600, #343630)',
        border: '1px solid var(--border-medium, #383A34)',
        cursor: 'pointer',
        padding: 0,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        outline: 'none',
        transition: 'background-color 0.15s ease',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          position: 'absolute',
          top: '1px',
          left: isDemoMode ? '15px' : '1px',
          transition: 'left 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
};
