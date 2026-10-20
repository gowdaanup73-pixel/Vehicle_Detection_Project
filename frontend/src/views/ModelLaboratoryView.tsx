import React, { useRef, useState } from 'react';
import { 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  Cpu, 
  Database, 
  ExternalLink, 
  FileCheck, 
  FlaskConical, 
  Layers, 
  LineChart, 
  Microscope, 
  Sliders, 
  TrendingUp, 
  Upload, 
  Zap 
} from 'lucide-react';
import { configureModel, uploadCheckpoint } from '../api';
import { ExperimentItem, LossPoint, ModelStatus } from '../types';

interface ModelLaboratoryViewProps {
  experiments: ExperimentItem[];
  losses: LossPoint[];
  modelStatus: ModelStatus | null;
  onRefreshStatus: () => void;
}

export const ModelLaboratoryView: React.FC<ModelLaboratoryViewProps> = ({
  experiments,
  losses,
  modelStatus,
  onRefreshStatus,
}) => {
  const [selectedExpId, setSelectedExpId] = useState<string>('exp_improved_centernet_full');
  const [customPathInput, setCustomPathInput] = useState<string>('');
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedExp = experiments.find((e) => e.id === selectedExpId) || experiments[0];
  const isWeightsLoaded = modelStatus?.weights_loaded ?? false;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploadLoading(true);
    setConfigMessage(null);

    try {
      const res = await uploadCheckpoint(file);
      setConfigMessage({ text: res.message || 'Checkpoint uploaded successfully', isError: !res.success });
      onRefreshStatus();
    } catch (err: any) {
      setConfigMessage({ text: err.message || 'Failed to upload checkpoint file', isError: true });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleApplyCustomPath = async () => {
    if (!customPathInput.trim()) return;

    setUploadLoading(true);
    setConfigMessage(null);

    try {
      const res = await configureModel({ checkpoint_path: customPathInput.trim() });
      if (res.reload_result && !res.reload_result.success) {
        setConfigMessage({ text: res.reload_result.message, isError: true });
      } else {
        setConfigMessage({ text: 'Model weights path updated and loaded successfully', isError: false });
      }
      onRefreshStatus();
    } catch (err: any) {
      setConfigMessage({ text: err.message || 'Failed to apply checkpoint path', isError: true });
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">NEURAL ARCHITECTURE & BENCHMARKS // EXPERIMENTAL RIG</div>
          <h1 className="section-title">
            <FlaskConical size={22} style={{ color: 'var(--burnt-orange)' }} />
            Model Laboratory & Ablation Matrix
          </h1>
          <p className="section-subtitle">
            Ablation studies on UA-DETRAC: Baseline CenterNet vs CBAM Attention vs BiFPN Neck vs Proposed Architecture
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge badge-charcoal">
            CHECKPOINT: {modelStatus?.checkpoint_name || 'improved_v2_best.pth'}
          </span>
          <span className="badge badge-orange">
            DEVICE: {modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : 'CPU')}
          </span>
        </div>
      </div>

      {/* Model Weights Connector Card */}
      <div className="command-card" style={{ borderLeft: `4px solid ${isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)'}` }}>
        <div className="command-card-header">
          <span className="card-title">
            <Zap size={14} style={{ color: isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)' }} />
            PyTorch Model Checkpoint Connector (.pth / .pt)
          </span>
          <span 
            className="badge" 
            style={{ 
              backgroundColor: isWeightsLoaded ? 'rgba(104,133,68,0.15)' : 'var(--burnt-orange-faint)',
              color: isWeightsLoaded ? 'var(--status-green)' : 'var(--burnt-orange)',
              border: '1px solid currentColor',
            }}
          >
            {isWeightsLoaded ? 'CONFIGURED // WEIGHTS LOADED' : 'UNCONFIGURED // AWAITING WEIGHTS'}
          </span>
        </div>

        <div className="grid-2">
          {/* Connector Controls */}
          <div>
            <p style={{ color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.6, marginBottom: '0.85rem' }}>
              Connect your trained model weights from Google Colab. Place your checkpoint in <code>backend/checkpoints/</code> or upload it below:
            </p>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pth,.pt"
              onChange={handleFileUpload}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
              >
                <Upload size={12} />
                {uploadLoading ? 'Uploading Weights...' : 'Upload .pth Checkpoint'}
              </button>

              <button
                className="btn btn-outline-olive"
                onClick={onRefreshStatus}
              >
                Refresh Checkpoint Scan
              </button>
            </div>

            {/* Available Checkpoints on Disk */}
            {modelStatus?.available_checkpoints && modelStatus.available_checkpoints.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--muted-olive)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                  DETECTED CHECKPOINTS IN /backend/checkpoints/
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {modelStatus.available_checkpoints.map((ckpt) => {
                    const isActive = modelStatus.checkpoint_path && modelStatus.checkpoint_path.endsWith(ckpt.filename);
                    return (
                      <div 
                        key={ckpt.filename}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.35rem 0.5rem',
                          backgroundColor: isActive ? 'rgba(104,133,68,0.12)' : 'var(--charcoal-800)',
                          border: `1px solid ${isActive ? 'var(--status-green)' : 'var(--border-light)'}`,
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <div>
                          <span style={{ color: isActive ? 'var(--status-green)' : 'var(--warm-ivory)', fontWeight: isActive ? 700 : 500 }}>
                            {ckpt.filename}
                          </span>
                          <span style={{ color: 'var(--warm-ivory-dim)', marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                            ({ckpt.size_mb} MB)
                          </span>
                          {isActive && (
                            <span className="badge badge-green" style={{ marginLeft: '0.5rem', fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                              ACTIVE
                            </span>
                          )}
                        </div>

                        {!isActive ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                            disabled={uploadLoading}
                            onClick={async () => {
                              setUploadLoading(true);
                              setConfigMessage(null);
                              try {
                                const res = await configureModel({ checkpoint_path: ckpt.path });
                                if (res.reload_result && !res.reload_result.success) {
                                  setConfigMessage({ text: res.reload_result.message, isError: true });
                                } else {
                                  setConfigMessage({ text: `Activated ${ckpt.filename} successfully`, isError: false });
                                }
                                onRefreshStatus();
                              } catch (err: any) {
                                setConfigMessage({ text: err.message || 'Failed to switch model', isError: true });
                              } finally {
                                setUploadLoading(false);
                              }
                            }}
                          >
                            Activate
                          </button>
                        ) : (
                          <span style={{ color: 'var(--status-green)', fontSize: '0.68rem' }}>● In Use</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Or enter local file path (e.g. checkpoints/best.pth)"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleApplyCustomPath}
                disabled={uploadLoading || !customPathInput.trim()}
              >
                Load
              </button>
            </div>

            {configMessage && (
              <div 
                style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.5rem 0.75rem', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.72rem',
                  border: `1px solid ${configMessage.isError ? 'var(--status-red)' : 'var(--status-green)'}`,
                  color: 'var(--warm-ivory)',
                }}
              >
                {configMessage.text}
              </div>
            )}
          </div>

          {/* Colab Export Guide */}
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <div style={{ color: 'var(--muted-olive)', fontWeight: 700, marginBottom: '0.35rem' }}>
              EXPORTING CHECKPOINTS FROM GOOGLE COLAB
            </div>
            <ol style={{ paddingLeft: '1.2rem', color: 'var(--warm-ivory-dim)', lineHeight: 1.6 }}>
              <li>Save state dict in your training script: <code>torch.save(model.state_dict(), 'best_improved_centernet.pth')</code></li>
              <li>Download the file from Colab or mount Google Drive.</li>
              <li>Upload via button above or place file in <code>backend/checkpoints/</code>.</li>
              <li>Target classes must match UA-DETRAC order: <code>0: car, 1: van, 2: bus, 3: others</code>.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Ablation Study Comparative Experiment Table */}
      <div className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <Microscope size={15} style={{ color: 'var(--burnt-orange)' }} />
            Comparative Ablation Benchmarks (UA-DETRAC Validation Splits)
          </span>
          <span className="label-tactical">VALIDATION SPLIT RESULTS // UNMEASURED MARKED "NOT EVALUATED"</span>
        </div>

        <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', margin: '0 0.85rem 0.85rem 0.85rem' }}>
          <strong style={{ color: 'var(--burnt-orange)' }}>VALIDATION BENCHMARK NOTICE: </strong> 
          All metrics represent validation split evaluations (not held-out test sets). Different validation subsets (1,417 images for V1/Baseline vs. 2,092 images for V3/V2) evaluate on different sequence partitions and are not directly comparable as identical splits.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="command-table">
            <thead>
              <tr>
                <th>Experiment Architecture</th>
                <th>Backbone</th>
                <th>Attention</th>
                <th>Neck</th>
                <th>Evaluation Split</th>
                <th>mAP@0.5</th>
                <th>mAP@[0.5:0.95]</th>
                <th>AP@0.75</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>Inference FPS</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => {
                const isProposed = exp.id === 'exp_improved_centernet_v2' || exp.id === 'exp_improved_centernet_full';
                const isSelected = exp.id === selectedExpId;

                return (
                  <tr
                    key={exp.id}
                    style={{
                      backgroundColor: isSelected 
                        ? 'var(--charcoal-700)' 
                        : isProposed 
                          ? 'rgba(200, 107, 60, 0.08)' 
                          : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedExpId(exp.id)}
                  >
                    <td style={{ color: isProposed ? 'var(--burnt-orange)' : 'var(--warm-ivory)', fontWeight: 700 }}>
                      {exp.name}
                      {isProposed && <span className="badge badge-orange" style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>ACTIVE V2</span>}
                    </td>
                    <td>{exp.backbone}</td>
                    <td>{exp.attention}</td>
                    <td>{exp.neck.split(' ')[0]}</td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>
                      {exp.evaluation_split || 'Validation Split'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--warm-ivory)' }}>
                      {exp.map_50 !== null && exp.map_50 !== undefined ? (exp.map_50 * 100).toFixed(2) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.map_50_95 !== null && exp.map_50_95 !== undefined ? (exp.map_50_95 * 100).toFixed(2) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.ap_75 !== null && exp.ap_75 !== undefined ? (exp.ap_75 * 100).toFixed(2) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.precision !== null && exp.precision !== undefined ? (exp.precision * 100).toFixed(1) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.recall !== null && exp.recall !== undefined ? (exp.recall * 100).toFixed(1) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.f1_score !== null && exp.f1_score !== undefined ? (exp.f1_score * 100).toFixed(1) + '%' : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td style={{ color: 'var(--burnt-orange)', fontWeight: 700 }}>
                      {exp.fps !== null && exp.fps !== undefined ? `${exp.fps} FPS` : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                    <td>
                      {exp.latency_ms !== null && exp.latency_ms !== undefined ? `${exp.latency_ms} ms` : <span style={{ color: 'var(--warm-ivory-dim)' }}>Not evaluated</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Experiment Deep Dive & Class-Wise AP */}
      <div className="grid-2">
        {/* Class-wise AP Breakdown */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Layers size={15} style={{ color: 'var(--muted-olive)' }} />
              Class-wise AP@0.5 Comparison // {selectedExp.name}
            </span>
            <span className="badge badge-charcoal">PER-CLASS PRECISION</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {Object.entries(selectedExp.class_ap_50).map(([cls, ap]) => {
              const pct = ap !== null ? Math.round(ap * 100) : 0;
              return (
                <div key={cls}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                    <span style={{ textTransform: 'uppercase', color: 'var(--warm-ivory)', fontWeight: 600 }}>{cls}</span>
                    <span style={{ color: ap !== null ? 'var(--burnt-orange)' : 'var(--warm-ivory-dim)', fontWeight: 700 }}>
                      {ap !== null ? `${pct}% AP` : 'Not evaluated'}
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${pct}%`, 
                        backgroundColor: ap !== null ? 'var(--burnt-orange)' : 'transparent',
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warm-ivory-dim)' }}>
            <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>ANALYSIS: </span>
            {selectedExp.notes}
          </div>
        </div>

        {/* Training Loss & mAP Convergence History */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <LineChart size={15} style={{ color: 'var(--burnt-orange)' }} />
              {losses.length > 0 ? `${losses.length}-Epoch Training Telemetry` : 'Training Telemetry'} (Improved CenterNet)
            </span>
            <span className="label-tactical">RECORDED TRAINING LOGS</span>
          </div>

          {losses.length > 0 ? (
            <div>
              <div style={{ height: '140px', width: '100%', marginBottom: '1rem', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 800 140" preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="800" y2="70" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(233,226,212,0.15)" />

                  {/* Total Loss Curve (Descending in Burnt Orange) */}
                  {(() => {
                    const maxLoss = Math.max(3.0, ...losses.map((l) => l.total_loss));
                    const points = losses.map((l, idx) => {
                      const x = (idx / Math.max(1, losses.length - 1)) * 800;
                      const y = 120 - Math.min(100, (l.total_loss / maxLoss) * 100);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <polyline
                        fill="none"
                        stroke="var(--burnt-orange)"
                        strokeWidth="2"
                        points={points}
                      />
                    );
                  })()}

                  {/* Val Loss Curve (Ascending / Descending in Muted Olive) */}
                  {(() => {
                    const maxValLoss = Math.max(3.0, ...losses.map((l) => l.val_loss || 0));
                    const points = losses.map((l, idx) => {
                      const x = (idx / Math.max(1, losses.length - 1)) * 800;
                      const val = l.val_loss || 0;
                      const y = 120 - Math.min(100, (val / maxValLoss) * 100);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <polyline
                        fill="none"
                        stroke="var(--muted-olive-light)"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        points={points}
                      />
                    );
                  })()}
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--burnt-orange)' }} />
                  <span>
                    Train Loss ({losses[0]?.total_loss} → {losses[losses.length - 1]?.total_loss})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--muted-olive-light)' }} />
                  <span>
                    Val Loss ({losses[0]?.val_loss} → {losses[losses.length - 1]?.val_loss})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--warm-ivory-dim)' }}>
              No recorded training convergence history CSV found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
