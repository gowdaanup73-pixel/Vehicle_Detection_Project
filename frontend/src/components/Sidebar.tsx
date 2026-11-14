import React, { useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Crosshair, 
  Database, 
  FlaskConical, 
  LayoutDashboard, 
  Menu, 
  RefreshCw, 
  X, 
  Zap 
} from 'lucide-react';
import { ModelStatus, NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  modelStatus: ModelStatus | null;
  onRefresh: () => void;
  isBackendHealthy: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  modelStatus,
  onRefresh,
  isBackendHealthy,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isWeightsLoaded = Boolean(modelStatus?.weights_loaded);
  const activeCheckpointName = modelStatus?.checkpoint_name || (modelStatus?.checkpoint_path ? modelStatus.checkpoint_path.split(/[\\/]/).pop() : null);

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'detection_studio', label: 'Detection Studio', icon: <Crosshair size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <Activity size={18} /> },
    { id: 'model_evaluation', label: 'Model Evaluation', icon: <FlaskConical size={18} /> },
    { id: 'history', label: 'History', icon: <Database size={18} /> },
  ];

  const isTabActive = (itemId: NavigationTab) => {
    if (activeTab === itemId) return true;
    if (itemId === 'overview' && activeTab === 'dashboard') return true;
    if (itemId === 'analytics' && activeTab === 'traffic_analytics') return true;
    if (itemId === 'model_evaluation' && activeTab === 'model_laboratory') return true;
    if (itemId === 'history' && activeTab === 'history_dataset') return true;
    return false;
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="apple-brand-icon">
            <Zap size={14} color="#FAFAFA" />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Vehicle Intelligence
          </span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem', border: 'none', borderRadius: 'var(--radius-button)' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Main Desktop Sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? 'mobile-visible' : ''}`}>
        {/* Brand Area */}
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="apple-brand-icon">
              <Zap size={16} color="#FAFAFA" />
            </div>
            <div>
              <div className="sidebar-brand-title">Vision Platform</div>
              <div className="sidebar-brand-sub">UVH-26 &bull; YOLOv11-S</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => {
            const isActive = isTabActive(item.id);
            return (
              <button
                key={item.id}
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {isActive && <div className="nav-active-pip" />}
              </button>
            );
          })}
        </nav>

        {/* System & Model Status Area at Bottom */}
        <div className="sidebar-footer">
          <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Telemetry</span>
            <button 
              onClick={onRefresh} 
              title="Refresh status"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            >
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Backend Status */}
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Backend API</span>
            <span className="sidebar-status-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: isBackendHealthy ? 'var(--status-emerald)' : 'var(--status-red)', fontWeight: 500 }}>
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%',
                  backgroundColor: isBackendHealthy ? 'var(--status-emerald)' : 'var(--status-red)',
                  boxShadow: isBackendHealthy ? '0 0 6px rgba(16, 185, 129, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)'
                }} 
              />
              {isBackendHealthy ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Device */}
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Accelerator</span>
            <span className="sidebar-status-val" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.75rem' }}>
              {modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : (modelStatus ? 'CPU Mode' : '—'))}
            </span>
          </div>

          {/* Model Weights State */}
          <div className="sidebar-status-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Model</span>
              <span 
                className="badge" 
                style={{ 
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isWeightsLoaded ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-card)',
                  color: isWeightsLoaded ? 'var(--status-emerald)' : 'var(--text-muted)',
                  border: isWeightsLoaded ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-subtle)'
                }}
              >
                {isWeightsLoaded ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
              {isWeightsLoaded && activeCheckpointName ? activeCheckpointName : (modelStatus ? 'UVH-26-MV-YOLOv11-S.pt' : 'Connecting to backend...')}
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};
