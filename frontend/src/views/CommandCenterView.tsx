import React from 'react';
import { 
  Activity, 
  ArrowRight, 
  Car, 
  Clock, 
  Cpu, 
  Eye, 
  Layers, 
  Play, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Zap 
} from 'lucide-react';
import { AnalyticsSummary, ModelStatus, NavigationTab, RunRecord } from '../types';

interface CommandCenterViewProps {
  summary: AnalyticsSummary | null;
  runs: RunRecord[];
  modelStatus: ModelStatus | null;
  onNavigate: (tab: NavigationTab) => void;
  onSelectRun: (run: RunRecord) => void;
  onRunSample: (mediaType: 'image' | 'video') => void;
  isProcessing: boolean;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  summary,
  runs,
  modelStatus,
  onNavigate,
  onSelectRun,
  onRunSample,
  isProcessing,
}) => {
  const isWeightsLoaded = modelStatus?.weights_loaded ?? false;

  const totalDetections = summary?.total_detections || 0;
  const uniqueVehicles = summary?.total_unique_vehicles || 0;
  const avgLatency = summary?.average_latency_ms || 24.5;
  const estFps = avgLatency > 0 ? (1000 / avgLatency).toFixed(1) : '40.0';

  const classCounts = summary?.class_distribution || { car: 0, van: 0, bus: 0, others: 0 };
  const totalClassVehicles = Math.max(
    1,
    classCounts.car + classCounts.van + classCounts.bus + classCounts.others
  );

  const classPercentages = {
    car: Math.round((classCounts.car / totalClassVehicles) * 100),
    van: Math.round((classCounts.van / totalClassVehicles) * 100),
    bus: Math.round((classCounts.bus / totalClassVehicles) * 100),
    others: Math.round((classCounts.others / totalClassVehicles) * 100),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner / System Title */}
      <div className="section-header">
        <div>
          <div className="label-tactical">TELEMETRY CONSOLE // REAL-TIME ROADWAY INTELLIGENCE</div>
          <h1 className="section-title">
            <Zap size={22} style={{ color: 'var(--burnt-orange)' }} />
            Vehicle Intelligence Command Center
          </h1>
          <p className="section-subtitle">
            Anchor-free keypoint detection powered by Improved CenterNet (ResNet-18 + CBAM Attention + BiFPN Neck)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onRunSample('image')}
            disabled={isProcessing}
          >
            <Play size={13} style={{ color: 'var(--burnt-orange)' }} />
            {isProcessing ? 'Processing...' : 'Run Roadway Test'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('detection_studio')}
          >
            Launch Studio
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Honest Model Status Banner */}
      {!isWeightsLoaded && (
        <div 
          style={{
            backgroundColor: 'var(--charcoal-800)',
            borderLeft: '4px solid var(--burnt-orange)',
            borderTop: '1px solid var(--border-medium)',
            borderRight: '1px solid var(--border-medium)',
            borderBottom: '1px solid var(--border-medium)',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: 'var(--warm-ivory)', marginBottom: '0.2rem' }}>
              NOTICE: MODEL RUNNING IN ARCHITECTURAL BENCHMARK / UNCONFIGURED WEIGHTS MODE
            </div>
            <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.74rem' }}>
              Custom trained weights (.pth) not found in <code>/checkpoints</code>. Network forward pass and calibrated road candidate extractor are active for pipeline validation. Connect your Colab checkpoint in Model Laboratory.
            </div>
          </div>
          <button 
            className="btn btn-outline-olive"
            style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
            onClick={() => onNavigate('model_laboratory')}
          >
            Connect Checkpoint
          </button>
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid-4">
        <div className="kpi-block">
          <div className="kpi-title">TOTAL VEHICLE THROUGHPUT</div>
          <div className="kpi-value">{totalDetections.toLocaleString()}</div>
          <div className="kpi-subtext">Across {summary?.total_runs || runs.length} recorded inference runs</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div className="kpi-title">UNIQUE TRACKED VEHICLES</div>
          <div className="kpi-value">{uniqueVehicles.toLocaleString()}</div>
          <div className="kpi-subtext">Persisted trajectory entities (de-duplicated)</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div className="kpi-title">AVERAGE INFERENCE LATENCY</div>
          <div className="kpi-value">{avgLatency} <span style={{ fontSize: '1.1rem' }}>ms</span></div>
          <div className="kpi-subtext">Throughput: ~{estFps} FPS ({modelStatus?.device || 'CPU'})</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)' }}>
          <div className="kpi-title">SYSTEM ARCHITECTURE STATUS</div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', paddingTop: '0.35rem' }}>
            {isWeightsLoaded ? 'WEIGHTS ACTIVE' : 'UNCONFIGURED'}
          </div>
          <div className="kpi-subtext">ResNet-18 + CBAM + BiFPN + Stride-4 Heads</div>
        </div>
      </div>

      {/* Middle Grid: Class Distribution & Model Architecture */}
      <div className="grid-2">
        {/* Vehicle Class Breakdown */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Car size={15} style={{ color: 'var(--burnt-orange)' }} />
              Target Class Distribution (UA-DETRAC Taxonomy)
            </span>
            <span className="label-tactical">4 CLASSES</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {[
              { label: 'Passenger Cars', key: 'car', color: 'var(--burnt-orange)', count: classCounts.car, pct: classPercentages.car },
              { label: 'Vans & Transporters', key: 'van', color: '#D9822B', count: classCounts.van, pct: classPercentages.van },
              { label: 'Public Transit Buses', key: 'bus', color: 'var(--muted-olive)', count: classCounts.bus, pct: classPercentages.bus },
              { label: 'Other Commercial', key: 'others', color: '#888982', count: classCounts.others, pct: classPercentages.others },
            ].map((cls) => (
              <div key={cls.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{cls.label}</span>
                  <span style={{ color: 'var(--warm-ivory-dim)' }}>
                    {cls.count} units ({cls.pct}%)
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
            <span>Total Classified Objects: {totalDetections}</span>
            <span>Virtual Tripwire Crossings: {summary?.total_line_crossings || 0}</span>
          </div>
        </div>

        {/* Model Architecture Specifications */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Layers size={15} style={{ color: 'var(--muted-olive)' }} />
              Improved CenterNet Pipeline Specifications
            </span>
            <span className="badge badge-orange">ANCHOR-FREE KEYPOINTS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ color: 'var(--burnt-orange)', marginBottom: '0.2rem' }}>
                STAGE 01 // BACKBONE & ATTENTION
              </div>
              <div style={{ fontWeight: 600, color: 'var(--warm-ivory)' }}>
                ResNet-18 with CBAM (Convolutional Block Attention Module)
              </div>
              <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Channel Attention suppresses road texture noise; Spatial Attention focuses on vehicle contours and windshield silhouettes.
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ color: 'var(--muted-olive)', marginBottom: '0.2rem' }}>
                STAGE 02 // MULTI-SCALE NECK FUSION
              </div>
              <div style={{ fontWeight: 600, color: 'var(--warm-ivory)' }}>
                BiFPN (Bidirectional Feature Pyramid Network)
              </div>
              <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Learned fast normalized weights fuse fine P3 features (small distant cars) with deep semantic P5 features (buses/trucks).
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ color: 'var(--warm-ivory-muted)', marginBottom: '0.2rem' }}>
                STAGE 03 // CENTERNET REGRESSION HEADS
              </div>
              <div style={{ fontWeight: 600, color: 'var(--warm-ivory)' }}>
                Stride-4 Multi-Head Keypoint Decoupling
              </div>
              <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Heatmap Head (4 classes, Focal Loss) + WH Head (Width & Height) + Reg Head (Sub-pixel offset correction).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Analysis Runs Table */}
      <div className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <Clock size={15} style={{ color: 'var(--warm-ivory)' }} />
            Recent Roadway Inspection Runs
          </span>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
            onClick={() => onNavigate('dataset_runs')}
          >
            View Full Audit Log
            <ArrowRight size={12} />
          </button>
        </div>

        {runs.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            NO AUDIT RECORDS FOUND. Launch a test above or upload roadway imagery in Detection Studio.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="command-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Timestamp</th>
                  <th>Media Type</th>
                  <th>Source File</th>
                  <th>Detections</th>
                  <th>Unique Tracked</th>
                  <th>Latency</th>
                  <th>Model State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 6).map((run) => (
                  <tr key={run.id}>
                    <td style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{run.id}</td>
                    <td>{new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td>
                      <span className={`badge ${run.media_type === 'video' ? 'badge-orange' : 'badge-olive'}`}>
                        {run.media_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.filename}
                    </td>
                    <td>{run.total_detections}</td>
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
                        onClick={() => {
                          onSelectRun(run);
                          onNavigate('dataset_runs');
                        }}
                      >
                        <Eye size={11} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
