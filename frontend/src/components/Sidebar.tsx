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
  isDemoMode?: boolean;
  onToggleDemo?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  modelStatus,
  onRefresh,
  isBackendHealthy,
  isDemoMode: _isDemoMode = false,
  onToggleDemo: _onToggleDemo,
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
            <Zap size={14} color="#0A84FF" />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#F5F5F7' }}>
            Vehicle Intelligence
          </span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem', border: 'none', borderRadius: '980px' }}
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
              <Zap size={16} color="#0A84FF" />
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
              style={{ background: 'none', border: 'none', color: '#86868B', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            >
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Backend Status */}
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Backend API</span>
            <span className="sidebar-status-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: isBackendHealthy ? '#30D158' : '#FF453A', fontWeight: 500 }}>
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%',
                  backgroundColor: isBackendHealthy ? '#30D158' : '#FF453A',
                  boxShadow: isBackendHealthy ? '0 0 8px rgba(48, 209, 88, 0.4)' : '0 0 8px rgba(255, 69, 58, 0.4)'
                }} 
              />
              {isBackendHealthy ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Device */}
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Accelerator</span>
            <span className="sidebar-status-val" style={{ color: '#F5F5F7', fontWeight: 500, fontSize: '0.75rem' }}>
              {modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : (modelStatus ? 'CPU Mode' : '—'))}
            </span>
          </div>

          {/* Model Weights State */}
          <div className="sidebar-status-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#86868B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Model</span>
              <span 
                className="badge" 
                style={{ 
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '980px',
                  backgroundColor: isWeightsLoaded ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 159, 10, 0.12)',
                  color: isWeightsLoaded ? '#30D158' : '#FF9F0A',
                  border: isWeightsLoaded ? '1px solid rgba(48, 209, 88, 0.25)' : '1px solid rgba(255, 159, 10, 0.25)'
                }}
              >
                {isWeightsLoaded ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#86868B', lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
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
