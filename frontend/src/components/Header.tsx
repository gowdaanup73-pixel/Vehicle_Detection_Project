import React from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  FlaskConical, 
  Gauge, 
  Layers, 
  Video 
} from 'lucide-react';
import { ModelStatus, NavigationTab } from '../types';

interface HeaderProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  modelStatus: ModelStatus | null;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  modelStatus,
  onRefresh,
}) => {
  const isTrainedActive = modelStatus?.weights_loaded ?? false;

  return (
    <header className="command-header">
      <div className="header-brand">
        <span className="brand-badge">IC-NET 18</span>
        <div>
          <div className="brand-title">Improved CenterNet</div>
          <div className="label-tactical" style={{ fontSize: '0.65rem' }}>
            Vehicle Intelligence Platform // UA-DETRAC
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-item ${activeTab === 'command_center' ? 'active' : ''}`}
          onClick={() => onTabChange('command_center')}
        >
          <Gauge size={14} />
          Command Center
        </button>

        <button
          className={`nav-item ${activeTab === 'detection_studio' ? 'active' : ''}`}
          onClick={() => onTabChange('detection_studio')}
        >
          <Video size={14} />
          Detection Studio
        </button>

        <button
          className={`nav-item ${activeTab === 'traffic_analytics' ? 'active' : ''}`}
          onClick={() => onTabChange('traffic_analytics')}
        >
          <Activity size={14} />
          Traffic Analytics
        </button>

        <button
          className={`nav-item ${activeTab === 'model_laboratory' ? 'active' : ''}`}
          onClick={() => onTabChange('model_laboratory')}
        >
          <FlaskConical size={14} />
          Model Laboratory
        </button>

        <button
          className={`nav-item ${activeTab === 'dataset_runs' ? 'active' : ''}`}
          onClick={() => onTabChange('dataset_runs')}
        >
          <Database size={14} />
          Dataset & Runs
        </button>
      </nav>

      <div className="header-status">
        <div className="status-pill" title="Hardware accelerator status">
          <Cpu size={12} style={{ color: 'var(--muted-olive)' }} />
          <span style={{ color: 'var(--warm-ivory-dim)' }}>DEV:</span>
          <span>{modelStatus?.is_cuda_available ? 'CUDA' : 'CPU'}</span>
        </div>

        <div 
          className="status-pill"
          title={isTrainedActive ? 'Custom weights active' : 'Operating in unconfigured benchmark mode'}
        >
          <span className={`status-indicator ${isTrainedActive ? 'active' : 'warning'}`} />
          <span style={{ color: 'var(--warm-ivory-dim)' }}>MODEL:</span>
          <span style={{ color: isTrainedActive ? 'var(--status-green)' : 'var(--burnt-orange)' }}>
            {isTrainedActive ? 'WEIGHTS ACTIVE' : 'UNCONFIGURED (BENCHMARK)'}
          </span>
        </div>
      </div>
    </header>
  );
};
