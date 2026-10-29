import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Crosshair,
  Database,
  Eye,
  Film,
  ImageIcon,
  Info,
  LineChart,
  Play,
  RefreshCw,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap
} from 'lucide-react';
import {
  AnalyticsSummary,
  DatasetInfo,
  ExperimentItem,
  ModelStatus,
  NavigationTab,
  RunRecord
} from '../types';

interface DashboardViewProps {
  summary: AnalyticsSummary | null;
  runs: RunRecord[];
  modelStatus: ModelStatus | null;
  experiments?: ExperimentItem[];
  datasetInfo?: DatasetInfo | null;
  onNavigate: (tab: NavigationTab) => void;
  onSelectRun: (run: RunRecord) => void;
  onDeleteRun?: (runId: string) => void;
  onRunSample: (mediaType: 'image' | 'video') => void;
  onUploadFile: (file: File) => void;
  onRefresh?: () => void;
  isProcessing: boolean;
  isBackendHealthy: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  runs,
  modelStatus,
  onNavigate,
  onSelectRun,
  onDeleteRun,
  onRunSample,
  onUploadFile,
  onRefresh,
  isProcessing,
  isBackendHealthy,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inspectedRun, setInspectedRun] = useState<RunRecord | null>(null);

  // Real Stored Data Aggregations
  const totalRuns = runs.length;
  const imageRuns = runs.filter((r) => r.media_type === 'image').length;
  const videoRuns = runs.filter((r) => r.media_type === 'video').length;

  const totalDetections = useMemo(() => {
    if (summary?.total_detections !== undefined && summary.total_detections > 0) {
      return summary.total_detections;
    }
    return runs.reduce((acc, r) => acc + (r.total_detections || 0), 0);
  }, [summary, runs]);

  // Real Latency (Mean & Median)
  const latencies = useMemo(() => {
    return runs.map((r) => r.latency_ms).filter((l): l is number => typeof l === 'number' && !isNaN(l));
  }, [runs]);

  const medianLatency = useMemo(() => {
    if (summary?.median_latency_ms) return summary.median_latency_ms.toFixed(1);
    if (latencies.length === 0) return null;
    const sorted = [...latencies].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return med.toFixed(1);
  }, [summary, latencies]);

  const avgLatency = useMemo(() => {
    if (summary?.average_latency_ms) return summary.average_latency_ms.toFixed(1);
    if (latencies.length === 0) return null;
    const sum = latencies.reduce((a, b) => a + b, 0);
    return (sum / latencies.length).toFixed(1);
  }, [summary, latencies]);

  const processingFps = medianLatency ? (1000 / Number(medianLatency)).toFixed(1) : null;

  // Genuine Class Counts Aggregation
  const classCounts = useMemo(() => {
    if (summary?.class_distribution) {
      return summary.class_distribution;
    }
    const counts = { car: 0, van: 0, bus: 0, others: 0 };
    for (const r of runs) {
      if (r.class_counts) {
        counts.car += r.class_counts.car || 0;
        counts.van += r.class_counts.van || 0;
        counts.bus += r.class_counts.bus || 0;
        counts.others += r.class_counts.others || 0;
      }
    }
    return counts;
  }, [summary, runs]);

  const classPercentages = useMemo(() => {
    const denom = Math.max(1, totalDetections);
    return {
      car: Math.round((classCounts.car / denom) * 100),
      van: Math.round((classCounts.van / denom) * 100),
      bus: Math.round((classCounts.bus / denom) * 100),
      others: Math.round((classCounts.others / denom) * 100),
    };
  }, [classCounts, totalDetections]);

  // Detection Activity Over Time Series
  const timeSeriesData = useMemo(() => {
    if (summary?.runs_over_time && summary.runs_over_time.length > 0) {
      return summary.runs_over_time;
    }
    const grouped: Record<string, { detections: number; runs: number }> = {};
    for (const r of runs) {
      const dateStr = r.timestamp ? r.timestamp.slice(0, 10) : 'Recent';
      if (!grouped[dateStr]) grouped[dateStr] = { detections: 0, runs: 0 };
      grouped[dateStr].detections += r.total_detections || 0;
      grouped[dateStr].runs += 1;
    }
    return Object.entries(grouped)
      .map(([date, val]) => ({ date, detections: val.detections, runs: val.runs }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [summary, runs]);

  // Most recent 5 executions
  const recentRuns = useMemo(() => {
    return runs.slice(0, 5);
  }, [runs]);

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="section-header" style={{ marginBottom: 0, paddingBottom: '0.75rem' }}>
        <div>
          <div className="label-tactical" style={{ color: 'var(--burnt-orange)', marginBottom: '0.25rem' }}>
            SYSTEM TELEMETRY & OPERATIONS COMMAND
          </div>
          <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            Vehicle Detection Overview
          </h1>
          <p className="section-subtitle" style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Production telemetry, localized vehicle classes, and forward-pass inference metrics calculated from SQLite.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Connection Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.65rem',
              backgroundColor: 'var(--charcoal-800)',
              border: '1px solid var(--border-medium)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            <span
              className="status-indicator"
              style={{ backgroundColor: isBackendHealthy ? 'var(--status-green)' : 'var(--status-red)' }}
            />
            <span style={{ color: isBackendHealthy ? 'var(--warm-ivory)' : 'var(--status-red)' }}>
              {isBackendHealthy ? 'SQLite Live Storage Connected' : 'Backend Disconnected'}
            </span>
          </div>

          {/* Real Refresh Button */}
          {onRefresh && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
              onClick={onRefresh}
              title="Refresh telemetry from backend"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          4 COMPACT KPI CARDS (P0 / SECTION 4)
          ========================================================================= */}
      <div className="kpi-row-4">
        {/* Card 1: Successfully Processed Files */}
        <div className="kpi-card" style={{ borderLeftColor: 'var(--burnt-orange)' }}>
          <div>
            <div className="kpi-card-title">Successfully Processed Files</div>
            <div className="kpi-card-value">
              {summary?.successful_runs !== undefined ? summary.successful_runs : totalRuns} <span style={{ fontSize: '0.9rem', color: 'var(--warm-ivory-dim)', fontWeight: 500 }}>runs</span>
            </div>
          </div>
          <div className="kpi-card-desc">
            {totalRuns > 0 ? `${imageRuns} Images, ${videoRuns} Videos stored in SQLite. Excludes failed/corrupted files.` : 'No processed files recorded yet.'}
          </div>
        </div>

        {/* Card 2: Total Detected Vehicles */}
        <div className="kpi-card" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div>
            <div className="kpi-card-title">Total Detected Vehicles</div>
            <div className="kpi-card-value">
              {totalDetections > 0 ? totalDetections.toLocaleString() : '0'}{' '}
              <span style={{ fontSize: '0.9rem', color: 'var(--warm-ivory-dim)', fontWeight: 500 }}>objects</span>
            </div>
          </div>
          <div className="kpi-card-desc">
            {totalDetections > 0
              ? `Car: ${classCounts.car} | Van: ${classCounts.van} | Bus: ${classCounts.bus} | Others: ${classCounts.others}`
              : 'Bounding boxes localized with keypoint confidence ≥ 0.35.'}
          </div>
        </div>

        {/* Card 3: Median Inference Latency */}
        <div className="kpi-card" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div>
            <div className="kpi-card-title">Median Inference Latency</div>
            <div className="kpi-card-value">
              {medianLatency ? `${medianLatency}` : '—'}{' '}
              <span style={{ fontSize: '0.9rem', color: 'var(--warm-ivory-dim)', fontWeight: 500 }}>ms</span>
            </div>
          </div>
          <div className="kpi-card-desc">
            {medianLatency
              ? `Median forward pass + decoding time (~${processingFps || '0'} FPS on ${modelStatus?.device_display || 'CPU'}).`
              : 'Measured per forward pass via Python time.perf_counter.'}
          </div>
        </div>

        {/* Card 4: Successful-Run Percentage */}
        <div className="kpi-card" style={{ borderLeftColor: 'var(--status-green)' }}>
          <div>
            <div className="kpi-card-title">Successful-Run Percentage</div>
            <div className="kpi-card-value" style={{ color: 'var(--status-green)' }}>
              {totalRuns > 0 ? `${summary?.success_rate !== undefined ? summary.success_rate : 100}%` : 'N/A'}
            </div>
          </div>
          <div className="kpi-card-desc">
            {totalRuns > 0
              ? `${summary?.successful_runs !== undefined ? summary.successful_runs : totalRuns} completed / ${summary?.failed_runs ?? 0} failed runs (denominator: ${totalRuns} total attempts).`
              : 'No operational inference attempts recorded.'}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FAST INGESTION TRIGGER CORRIDOR
          ========================================================================= */}
      <div
        className="command-card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--charcoal-800)',
          borderLeft: '4px solid var(--burnt-orange)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--warm-ivory)' }}>
            <Crosshair size={14} style={{ color: 'var(--burnt-orange)' }} />
            <span>OPERATIONAL INFERENCE CORRIDOR</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            Upload genuine roadway footage (JPG, PNG, MP4, AVI) to run deep learning inference in Detection Studio.
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onUploadFile(e.target.files[0]);
            }
          }}
        />

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={12} />
            Select Media File
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => onRunSample('image')}
            disabled={isProcessing}
          >
            <Play size={12} style={{ color: 'var(--burnt-orange)' }} />
            Run Image Sample
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => onRunSample('video')}
            disabled={isProcessing}
          >
            <Film size={12} style={{ color: 'var(--muted-olive)' }} />
            Run Video Stream
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => onNavigate('detection_studio')}
          >
            Open Studio
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          TWO EQUAL-WIDTH MAIN CHARTS (SECTION 4)
          ========================================================================= */}
      <div className="grid-2">
        {/* Chart 1: Vehicle Class Distribution */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <BarChart3 size={15} style={{ color: 'var(--burnt-orange)' }} />
                Vehicle Class Distribution
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                {totalDetections} TOTAL OBJECTS
              </span>
            </div>

            {totalDetections > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { label: 'Passenger Cars (car)', count: classCounts.car, pct: classPercentages.car, color: 'var(--burnt-orange)' },
                  { label: 'Vans & Commercial (van)', count: classCounts.van, pct: classPercentages.van, color: '#D9822B' },
                  { label: 'Public Transit Buses (bus)', count: classCounts.bus, pct: classPercentages.bus, color: 'var(--muted-olive)' },
                  { label: 'Others (Trucks & Specialized)', count: classCounts.others, pct: classPercentages.others, color: '#888982' },
                ].map((c) => (
                  <div key={c.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{c.label}</span>
                      <span style={{ color: 'var(--warm-ivory-dim)' }}>
                        {c.count.toLocaleString()} ({c.pct}%)
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${c.pct}%`,
                          backgroundColor: c.color,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                No vehicle detections recorded in database yet. Process media to generate class proportions.
              </div>
            )}
          </div>

          {/* 4-Part Graph Explanation */}
          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Distribution of vehicle types classified by CenterNet keypoint classification heads across all executed runs.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Count of bounding boxes per class divided by total detections ({totalDetections}): <code>(Class Detections / {totalDetections || 1}) × 100</code>.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {totalDetections > 0 ? (
                `Cars represent ${classPercentages.car}% (${classCounts.car} of ${totalDetections}) of all localized objects. Vans represent ${classPercentages.van}%, Buses ${classPercentages.bus}%, and Others ${classPercentages.others}%.`
              ) : (
                'Requires executed runs to establish observable roadway traffic class proportions.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Computed strictly from {totalDetections} bounding box detections across {totalRuns} operational records in SQLite.
            </div>
          </div>
        </div>

        {/* Chart 2: Detection Activity Over Time */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--muted-olive)' }} />
                Detection Activity Over Time
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                {timeSeriesData.length} RECORDED INTERVALS
              </span>
            </div>

            {timeSeriesData.length > 1 ? (
              <div>
                <div style={{ height: '135px', width: '100%', marginBottom: '0.5rem', position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 500 135" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(233,226,212,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="67" x2="500" y2="67" stroke="rgba(233,226,212,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="115" x2="500" y2="115" stroke="rgba(233,226,212,0.12)" />

                    {(() => {
                      const maxCount = Math.max(5, ...timeSeriesData.map((t) => t.detections));
                      const points = timeSeriesData.map((t, idx) => {
                        const x = (idx / Math.max(1, timeSeriesData.length - 1)) * 500;
                        const y = 115 - (t.detections / maxCount) * 95;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="var(--burnt-orange)"
                            strokeWidth="2.5"
                            points={points}
                          />
                          {timeSeriesData.map((t, idx) => {
                            const x = (idx / Math.max(1, timeSeriesData.length - 1)) * 500;
                            const y = 115 - (t.detections / maxCount) * 95;
                            return (
                              <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r="4"
                                fill="var(--burnt-orange)"
                                stroke="var(--charcoal-900)"
                                strokeWidth="1.5"
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--warm-ivory-dim)' }}>
                  <span>{timeSeriesData[0]?.date || 'T0'}</span>
                  <span>{timeSeriesData[Math.floor(timeSeriesData.length / 2)]?.date || 'Mid'}</span>
                  <span>{timeSeriesData[timeSeriesData.length - 1]?.date || 'Latest'}</span>
                </div>
              </div>
            ) : (
              <div style={{ height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--charcoal-900)', border: '1px dashed var(--border-light)' }}>
                <LineChart size={24} style={{ color: 'var(--muted-olive)', marginBottom: '0.35rem' }} />
                <span style={{ color: 'var(--warm-ivory)', fontSize: '0.74rem', fontWeight: 600 }}>Insufficient Temporal Intervals</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.2rem' }}>
                  Plotting a time-series curve requires multiple timestamped runs.
                </span>
              </div>
            )}
          </div>

          {/* 4-Part Graph Explanation */}
          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Temporal trajectory of localized vehicle volumes grouped across discrete execution intervals.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Sum of detected bounding boxes grouped by day/run timestamp: <code>Σ(Detections per Interval)</code>.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {timeSeriesData.length > 1 ? (
                `Volume ranges between ${Math.min(...timeSeriesData.map(t => t.detections))} and ${Math.max(...timeSeriesData.map(t => t.detections))} detections across ${timeSeriesData.length} recorded intervals.`
              ) : (
                `Only ${timeSeriesData.length} interval recorded. Multi-period trends require additional inference runs.`
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Sourced from genuine timestamps in SQLite table <code>runs</code>. Synthetic curves are never interpolated.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECENT ACTIVITY TABLE (SECTION 4)
          ========================================================================= */}
      <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem' }}>
        <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.65rem' }}>
          <div>
            <span className="card-title" style={{ fontSize: '0.88rem' }}>
              <Clock size={15} style={{ color: 'var(--burnt-orange)' }} />
              Recent Execution Activity
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              Showing {recentRuns.length} most recent genuine execution records from SQLite
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
            onClick={() => onNavigate('history')}
          >
            View Complete History
            <ArrowRight size={12} />
          </button>
        </div>

        {recentRuns.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            <Database size={28} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.5rem auto' }} />
            <div style={{ color: 'var(--warm-ivory)', fontWeight: 700, fontSize: '0.85rem' }}>
              NO PERSISTED EXECUTION RECORDS YET
            </div>
            <div style={{ fontSize: '0.72rem', maxWidth: '420px', margin: '0.35rem auto 0 auto', lineHeight: 1.5 }}>
              Process roadway imagery or video footage above to record operational inference runs in SQLite.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="command-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Media Type</th>
                  <th>Filename</th>
                  <th>Timestamp</th>
                  <th>Detections</th>
                  <th>Latency</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{run.id}</td>
                    <td>
                      <span className={`badge ${run.media_type === 'video' ? 'badge-orange' : 'badge-olive'}`}>
                        {run.media_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={run.filename}>
                      {run.filename}
                    </td>
                    <td>{new Date(run.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ fontWeight: 700, color: 'var(--warm-ivory)' }}>{run.total_detections}</td>
                    <td>{run.latency_ms} ms</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--status-green)', fontSize: '0.72rem', fontWeight: 600 }}>
                        <CheckCircle2 size={12} />
                        COMPLETED
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                        onClick={() => setInspectedRun(run)}
                      >
                        <Eye size={11} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          INSPECTED RUN DETAIL MODAL
          ========================================================================= */}
      {inspectedRun && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(20, 21, 19, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
          onClick={() => setInspectedRun(null)}
        >
          <div
            className="command-card"
            style={{
              maxWidth: '960px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--burnt-orange)',
              backgroundColor: 'var(--charcoal-800)',
              marginBottom: 0,
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.65rem' }}>
              <div>
                <span className="card-title" style={{ fontSize: '0.9rem' }}>
                  Run Details // {inspectedRun.id}
                </span>
                <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  Source: {inspectedRun.filename} | Latency: {inspectedRun.latency_ms} ms | Detections: {inspectedRun.total_detections}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setInspectedRun(null)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Media Views */}
            <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="label-tactical" style={{ marginBottom: '0.35rem' }}>ORIGINAL INPUT</div>
                <div style={{ height: '260px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {inspectedRun.media_type === 'video' ? (
                    <video controls src={inspectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Source Input" src={inspectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>

              <div>
                <div className="label-tactical" style={{ marginBottom: '0.35rem', color: 'var(--burnt-orange)' }}>
                  ANNOTATED DETECTION OUTPUT
                </div>
                <div style={{ height: '260px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {inspectedRun.media_type === 'video' ? (
                    <video controls src={inspectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Annotated Output" src={inspectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Class Breakdown Chips */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {Object.entries(inspectedRun.class_counts || {}).map(([cls, count]) => (
                <div
                  key={cls}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: 'var(--charcoal-900)',
                    border: '1px solid var(--border-light)',
                    borderLeft: '3px solid var(--burnt-orange)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                  }}
                >
                  <span style={{ color: 'var(--warm-ivory-dim)', textTransform: 'uppercase' }}>{cls}: </span>
                  <strong style={{ color: 'var(--warm-ivory)' }}>{count}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setInspectedRun(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
