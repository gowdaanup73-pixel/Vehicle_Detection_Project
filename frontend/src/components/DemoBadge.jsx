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
      padding: '0.2rem 0.55rem',
      backgroundColor: 'rgba(94, 92, 230, 0.15)',
      border: '1px solid rgba(94, 92, 230, 0.3)',
      borderRadius: '980px',
      fontFamily: 'var(--font-apple, -apple-system, sans-serif)',
      fontSize: '0.68rem',
      fontWeight: 600,
      color: '#5E5CE6',
      letterSpacing: '0.04em',
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
      gap: '0.5rem',
      padding: '0.35rem 0.75rem',
      backgroundColor: 'rgba(94, 92, 230, 0.12)',
      border: '1px solid rgba(94, 92, 230, 0.25)',
      borderRadius: '980px',
      fontFamily: 'var(--font-apple, -apple-system, sans-serif)',
      fontSize: '0.72rem',
      fontWeight: 600,
      color: '#5E5CE6',
      letterSpacing: '0.02em',
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
        backgroundColor: '#5E5CE6',
        boxShadow: '0 0 8px rgba(94, 92, 230, 0.6)',
      }}
    />
    DEMO SIMULATED
  </div>
);

/**
 * Subtle watermark placed inside chart containers when Demo Mode is active.
 */
export const ChartWatermark = () => (
  <div
    style={{
      position: 'absolute',
      right: '16px',
      bottom: '10px',
      fontFamily: 'var(--font-apple, -apple-system, sans-serif)',
      fontSize: '0.65rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      color: 'rgba(94, 92, 230, 0.3)',
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
        width: '32px',
        height: '18px',
        borderRadius: '999px',
        backgroundColor: isDemoMode ? '#30D158' : 'rgba(255, 255, 255, 0.16)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        cursor: 'pointer',
        padding: 0,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        outline: 'none',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          position: 'absolute',
          top: '1px',
          left: isDemoMode ? '15px' : '1px',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
};
