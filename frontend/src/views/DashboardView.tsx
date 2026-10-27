import React, { useEffect, useRef, useState } from 'react';
import { 
  Activity, 
  AlertCircle,
  ArrowRight, 
  BarChart3, 
  Car, 
  Clock, 
  Cpu, 
  Crosshair, 
  Eye, 
  FileText, 
  Film, 
  ImageIcon, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Upload, 
  Zap 
} from 'lucide-react';
import { AnalyticsSummary, ModelStatus, NavigationTab, RunRecord } from '../types';

interface DashboardViewProps {
  summary: AnalyticsSummary | null;
  runs: RunRecord[];
  modelStatus: ModelStatus | null;
  onNavigate: (tab: NavigationTab) => void;
  onSelectRun: (run: RunRecord) => void;
  onRunSample: (mediaType: 'image' | 'video') => void;
  onUploadFile: (file: File) => void;
  isProcessing: boolean;
  isBackendHealthy: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  runs,
  modelStatus,
  onNavigate,
  onSelectRun,
  onRunSample,
  onUploadFile,
  isProcessing,
  isBackendHealthy,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);

  const isWeightsLoaded = modelStatus?.weights_loaded ?? false;

  // Real backend metrics
  const totalDetections = summary?.total_detections || 0;
  const uniqueVehicles = summary?.total_unique_vehicles || 0;
  const avgLatency = summary?.average_latency_ms || (runs.length > 0 ? (runs.reduce((acc, r) => acc + r.latency_ms, 0) / runs.length).toFixed(1) : null);
  const processingFps = avgLatency ? (1000 / Number(avgLatency)).toFixed(1) : null;

  const classCounts = summary?.class_distribution || { car: 0, van: 0, bus: 0, others: 0 };
  const totalClassVehicles = Math.max(1, classCounts.car + classCounts.van + classCounts.bus + classCounts.others);

  const classPercentages = {
    car: Math.round((classCounts.car / totalClassVehicles) * 100),
    van: Math.round((classCounts.van / totalClassVehicles) * 100),
    bus: Math.round((classCounts.bus / totalClassVehicles) * 100),
    others: Math.round((classCounts.others / totalClassVehicles) * 100),
  };

  const recentRuns = runs.slice(0, 5);
  const latestRun = runs[0] || null;

  useEffect(() => {
    setMediaLoadError(false);
  }, [latestRun?.id]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="dashboard-container">
      {/* 1. Welcome Card */}
      <section className="command-card welcome-card">
        <div className="welcome-content">
          <div className="label-tactical" style={{ marginBottom: '0.4rem' }}>
            OVERVIEW // VEHICLE INTELLIGENCE PLATFORM
          </div>
          <h1 className="welcome-title">Vehicle Intelligence Dashboard</h1>
          <p className="welcome-subtitle">
            Detect vehicles and analyse traffic from road footage using Improved CenterNet with CBAM attention and BiFPN multi-scale fusion.
          </p>

          <div className="welcome-actions">
            <button 
              className="btn btn-primary"
              onClick={() => onNavigate('detection_studio')}
            >
              <Crosshair size={15} />
              Start Detection
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => onNavigate('traffic_analytics')}
            >
              <Activity size={15} />
              View Analytics
            </button>
          </div>
        </div>

        <div className="welcome-badge-box">
          <div className="label-tactical" style={{ fontSize: '0.65rem', marginBottom: '0.25rem' }}>
            BACKEND CONNECTION
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span 
              className="status-indicator" 
              style={{ backgroundColor: isBackendHealthy ? 'var(--status-green)' : 'var(--status-red)' }} 
            />
            <span>{isBackendHealthy ? 'Online & Synchronized' : 'Reconnecting...'}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem' }}>
            Real-time telemetry poll every 5s
          </div>
        </div>
      </section>

      {/* 2. Overview Metrics Row */}
      <section className="grid-4">
        {/* Vehicles Detected */}
        <div className="kpi-block">
          <div className="kpi-title">Vehicles Detected</div>
          <div className="kpi-value">{totalDetections > 0 ? totalDetections.toLocaleString() : '0'}</div>
          <div className="kpi-subtext">Across {runs.length} recorded inference run{runs.length === 1 ? '' : 's'}</div>
        </div>

        {/* Unique Tracked Entities */}
        <div className="kpi-block" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div className="kpi-title">Unique Tracked Vehicles</div>
          <div className="kpi-value">{uniqueVehicles > 0 ? uniqueVehicles.toLocaleString() : '0'}</div>
          <div className="kpi-subtext">De-duplicated trajectory tracks</div>
        </div>

        {/* Inference Latency & FPS */}
        <div className="kpi-block" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div className="kpi-title">Average Latency & Speed</div>
          <div className="kpi-value">
            {avgLatency ? `${avgLatency} ms` : 'Not available'}
          </div>
          <div className="kpi-subtext">
            {processingFps ? `Throughput: ~${processingFps} FPS (${modelStatus?.device || 'CPU'})` : 'Awaiting first inference run'}
          </div>
        </div>

        {/* Model Status */}
        <div className="kpi-block" style={{ borderLeftColor: isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)' }}>
          <div className="kpi-title">Active Model Checkpoint</div>
          <div className="kpi-value" style={{ fontSize: '1.05rem', paddingTop: '0.4rem', color: isWeightsLoaded ? 'var(--warm-ivory)' : 'var(--burnt-orange)' }}>
            {isWeightsLoaded ? (modelStatus?.checkpoint_name || 'improved_v2_best.pth') : 'No Checkpoint Loaded'}
          </div>
          <div className="kpi-subtext">
            {modelStatus?.device_display || (modelStatus?.device ? `Accelerator: ${modelStatus.device}` : 'CPU Device')}
          </div>
        </div>
      </section>

      {/* 3. Detection Workspace Block */}
      <section className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <Crosshair size={16} style={{ color: 'var(--burnt-orange)' }} />
            Detection Workspace
          </span>
          <span className="label-tactical">FAST MEDIA INGESTION</span>
        </div>

        <div className="grid-sidebar">
          {/* Large Clear Upload Entry Point */}
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }}
              accept="image/*,video/*"
              onChange={handleFileChange}
            />

            <div 
              className={`dropzone large-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} style={{ color: 'var(--burnt-orange)', margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--warm-ivory)' }}>
                Drop image or video here, or browse files
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem' }}>
                Supports JPG, PNG, WEBP, MP4, AVI footage. Validates resolution and format automatically.
              </div>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '1rem' }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Select Media File
              </button>
            </div>

            {/* Standard Reference Benchmarks */}
            <div style={{ marginTop: '0.85rem' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>
                STANDARD REFERENCE BENCHMARK
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.72rem' }}
                  onClick={() => onRunSample('image')}
                  disabled={isProcessing}
                >
                  <Play size={12} style={{ color: 'var(--burnt-orange)' }} />
                  {isProcessing ? 'Processing...' : 'Evaluate Reference Highway (Image)'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.72rem' }}
                  onClick={() => onRunSample('video')}
                  disabled={isProcessing}
                >
                  <Film size={12} style={{ color: 'var(--muted-olive)' }} />
                  {isProcessing ? 'Processing...' : 'Evaluate Reference Stream (Video)'}
                </button>
              </div>
            </div>
          </div>

          {/* Recently Processed Preview Card */}
          <div className="recent-preview-container">
            <div className="label-tactical" style={{ marginBottom: '0.5rem' }}>
              MOST RECENTLY PROCESSED MEDIA
            </div>

            {latestRun ? (
              <div className="latest-run-card">
                <div className="preview-media-wrapper">
                  {mediaLoadError ? (
                    <div className="empty-state-box" style={{ height: '100%', minHeight: '160px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <AlertCircle size={24} style={{ color: 'var(--status-red)', margin: '0 auto 0.5rem auto' }} />
                      <div style={{ color: 'var(--warm-ivory)', fontSize: '0.75rem', fontWeight: 600 }}>Media artifact unavailable on disk</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                        {latestRun.annotated_url}
                      </div>
                    </div>
                  ) : latestRun.media_type === 'video' ? (
                    <video 
                      src={`${latestRun.annotated_url}?v=${latestRun.id}`} 
                      controls 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={() => setMediaLoadError(true)}
                    />
                  ) : (
                    <img 
                      src={`${latestRun.annotated_url}?v=${latestRun.id}`} 
                      alt="Processed run" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={() => setMediaLoadError(true)}
                    />
                  )}
                </div>

                <div className="latest-run-details">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--warm-ivory)', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={latestRun.filename}>
                      {latestRun.filename}
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <span className={`badge ${
                        latestRun.run_type === 'test_run' || latestRun.metadata?.run_type === 'test_run' || latestRun.filename.startsWith('test_') || latestRun.filename.startsWith('custom_cam')
                          ? 'badge-olive'
                          : 'badge-orange'
                      }`} style={{ fontSize: '0.62rem' }}>
                        {latestRun.run_type === 'test_run' || latestRun.metadata?.run_type === 'test_run' || latestRun.filename.startsWith('test_') || latestRun.filename.startsWith('custom_cam')
                          ? 'TEST BENCHMARK'
                          : 'USER UPLOAD'}
                      </span>
                      <span className="badge badge-orange">{latestRun.media_type.toUpperCase()}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                    RUN ID: {latestRun.id}
                  </div>

                  <div className="grid-2" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                    <div className="metric-pill">
                      <span className="pill-label">Detections</span>
                      <span className="pill-val">{latestRun.total_detections}</span>
                    </div>
                    <div className="metric-pill">
                      <span className="pill-label">Tracked</span>
                      <span className="pill-val">{latestRun.unique_vehicles}</span>
                    </div>
                    <div className="metric-pill">
                      <span className="pill-label">Latency</span>
                      <span className="pill-val">{latestRun.latency_ms} ms</span>
                    </div>
                    <div className="metric-pill">
                      <span className="pill-label">Speed</span>
                      <span className="pill-val">{latestRun.fps} FPS</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.45rem', fontStyle: 'italic' }}>
                    {latestRun.run_type === 'test_run' || latestRun.filename.startsWith('test_') || latestRun.filename.startsWith('custom_cam')
                      ? 'Automated test suite media processed by active checkpoint'
                      : latestRun.total_detections > 0
                        ? `Model reported ${latestRun.total_detections} detection(s) on genuine input`
                        : 'No vehicle keypoints exceeded threshold on this input'}
                  </div>

                  <button 
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.65rem', fontSize: '0.74rem' }}
                    onClick={() => onSelectRun(latestRun)}
                  >
                    <Eye size={12} />
                    View Full Predictions
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state-box">
                <ImageIcon size={32} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.5rem auto' }} />
                <div style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>No processing runs yet</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--warm-ivory-dim)', marginTop: '0.2rem' }}>
                  Upload a media file or evaluate a reference benchmark to run your first vehicle detection.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Traffic Insights & Class Distribution Block */}
      <section className="grid-2">
        {/* Class-wise Vehicle Counts */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Car size={16} style={{ color: 'var(--burnt-orange)' }} />
              Class-wise Vehicle Distribution
            </span>
            <span className="label-tactical">UA-DETRAC TAXONOMY</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            {[
              { label: 'Passenger Cars', key: 'car', color: 'var(--burnt-orange)', count: classCounts.car, pct: classPercentages.car },
              { label: 'Vans & Transporters', key: 'van', color: '#D9822B', count: classCounts.van, pct: classPercentages.van },
              { label: 'Public Transit Buses', key: 'bus', color: 'var(--muted-olive)', count: classCounts.bus, pct: classPercentages.bus },
              { label: 'Others (Trucks & Commercial)', key: 'others', color: '#888982', count: classCounts.others, pct: classPercentages.others },
            ].map((cls) => (
              <div key={cls.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{cls.label}</span>
                  <span style={{ color: 'var(--warm-ivory-dim)' }}>
                    {cls.count.toLocaleString()} ({cls.pct}%)
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${cls.pct}%`, 
                      backgroundColor: cls.color,
                      transition: 'width 0.4s ease',
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div 
            style={{ 
              marginTop: '1.25rem', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--warm-ivory-dim)',
            }}
          >
            <span>Total classified vehicles: {totalDetections.toLocaleString()}</span>
            <span>Virtual tripwire passages: {summary?.total_line_crossings || 0}</span>
          </div>
        </div>

        {/* Traffic Volume & Tracking Summary */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <BarChart3 size={16} style={{ color: 'var(--muted-olive)' }} />
              Traffic Volume & Tracking Insights
            </span>
            <span className="badge badge-olive">GENUINE TELEMETRY</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="metric-callout">
              <div className="callout-header">
                <span className="callout-title">Cumulative Virtual Tripwire Crossings</span>
                <span className="callout-val" style={{ color: 'var(--status-green)' }}>
                  {summary?.total_line_crossings || 0}
                </span>
              </div>
              <div className="callout-desc">
                Counted across reference gate line in processed video streams.
              </div>
            </div>

            <div className="metric-callout">
              <div className="callout-header">
                <span className="callout-title">Track Density Occupancy</span>
                <span className="callout-val" style={{ color: 'var(--burnt-orange)' }}>
                  {runs.length > 0 ? 'Documented Spatial Estimate' : 'Awaiting Video'}
                </span>
              </div>
              <div className="callout-desc">
                Calculated from vehicle bounding box area relative to roadway corridor.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.72rem' }}
                onClick={() => onNavigate('traffic_analytics')}
              >
                Open Analytics Console
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Recent Activity Card */}
      <section className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <Clock size={16} style={{ color: 'var(--warm-ivory)' }} />
            Recent Processing Activity
          </span>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
            onClick={() => onNavigate('history_dataset')}
          >
            View All Runs ({runs.length})
            <ArrowRight size={12} />
          </button>
        </div>

        {recentRuns.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            No recent activity recorded. Upload media above to run your first detection.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="command-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Timestamp</th>
                  <th>Media Type</th>
                  <th>Filename</th>
                  <th>Vehicles</th>
                  <th>Tracked</th>
                  <th>Duration / Latency</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{run.id}</td>
                    <td>{new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td>
                      <span className={`badge ${run.media_type === 'video' ? 'badge-orange' : 'badge-olive'}`}>
                        {run.media_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.filename}
                    </td>
                    <td style={{ fontWeight: 600 }}>{run.total_detections}</td>
                    <td>{run.unique_vehicles}</td>
                    <td>{run.latency_ms} ms</td>
                    <td>
                      <span className="badge badge-charcoal" style={{ fontSize: '0.65rem' }}>
                        {run.weights_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                        onClick={() => onSelectRun(run)}
                      >
                        <Eye size={11} />
                        View Results
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. Model Status Card */}
      <section className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <Cpu size={16} style={{ color: 'var(--burnt-orange)' }} />
            Model & Backend Hardware Telemetry
          </span>
          <span className="label-tactical">{modelStatus?.checkpoint_name || 'improved_v2_best.pth'}</span>
        </div>

        <div className="grid-3">
          <div className="telemetry-box">
            <span className="telemetry-label">Active Architecture</span>
            <span className="telemetry-val">Improved CenterNet V2</span>
            <span className="telemetry-sub">ResNet-18 Backbone + CBAM Attention + 2x BiFPN Neck</span>
          </div>

          <div className="telemetry-box">
            <span className="telemetry-label">Active Checkpoint</span>
            <span className="telemetry-val" style={{ color: isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)' }}>
              {isWeightsLoaded ? (modelStatus?.checkpoint_name || 'improved_v2_best.pth') : 'None'}
            </span>
            <span className="telemetry-sub">
              {isWeightsLoaded ? (modelStatus?.checkpoint_path || 'backend/checkpoints/improved_v2_best.pth') : 'Awaiting checkpoint file'}
            </span>
          </div>

          <div className="telemetry-box">
            <span className="telemetry-label">Compute Device</span>
            <span className="telemetry-val">
              {modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : 'CPU Host Processor')}
            </span>
            <span className="telemetry-sub">
              {modelStatus?.gpu_name || 'Host CPU Processor with PyTorch Float32 Engine'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
