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
  const isTrainedActive = modelStatus?.weights_loaded ?? false;

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
          <span className="brand-badge">IC-NET</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.04em' }}>
            VEHICLE INTELLIGENCE
          </span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem', border: 'none' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Main Desktop Sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? 'mobile-visible' : ''}`}>
        {/* Brand Area */}
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="brand-badge">IC-NET 18</span>
            <div>
              <div className="sidebar-brand-title">CenterNet</div>
              <div className="sidebar-brand-sub">Vehicle Intelligence</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">PLATFORM</div>
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
            <span>RUNTIME TELEMETRY</span>
            <button 
              onClick={onRefresh} 
              title="Refresh status"
              style={{ background: 'none', border: 'none', color: 'var(--muted-olive)', cursor: 'pointer' }}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Backend Status */}
          <div className="sidebar-status-row">
            <span style={{ color: 'var(--warm-ivory-dim)' }}>Backend API</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isBackendHealthy ? 'var(--status-green)' : 'var(--status-red)', fontWeight: 600 }}>
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  backgroundColor: isBackendHealthy ? 'var(--status-green)' : 'var(--status-red)' 
                }} 
              />
              {isBackendHealthy ? 'Online' : 'Unavailable'}
            </span>
          </div>

          {/* Device */}
          <div className="sidebar-status-row">
            <span style={{ color: 'var(--warm-ivory-dim)' }}>Accelerator</span>
            <span style={{ color: 'var(--warm-ivory)', fontWeight: 600, fontSize: '0.74rem' }}>
              {modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : 'CPU Mode')}
            </span>
          </div>

          {/* Model Weights State */}
          <div className="sidebar-status-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted-olive)', fontWeight: 700 }}>CHECKPOINT</span>
              <span 
                className="badge" 
                style={{ 
                  fontSize: '0.62rem',
                  padding: '0.1rem 0.35rem',
                  backgroundColor: isTrainedActive ? 'rgba(104,133,68,0.2)' : 'rgba(200,107,60,0.2)',
                  color: isTrainedActive ? 'var(--status-green)' : 'var(--burnt-orange)',
                }}
              >
                {isTrainedActive ? 'ACTIVE' : 'UNCONFIGURED'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-muted)', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
              {isTrainedActive ? (modelStatus?.checkpoint_name || 'improved_v2_best.pth') : 'No checkpoint loaded'}
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
