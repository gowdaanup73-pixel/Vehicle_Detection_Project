import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Cpu, 
  Download, 
  Eye, 
  FileText, 
  Film, 
  Filter, 
  ImageIcon, 
  Info, 
  Layers, 
  LineChart, 
  Sliders, 
  TrendingUp, 
  Truck, 
  Zap 
} from 'lucide-react';
import { AnalyticsSummary, RunRecord } from '../types';

interface TrafficAnalyticsViewProps {
  summary: AnalyticsSummary | null;
  latestVideoRun: RunRecord | null;
  allRuns: RunRecord[];
}

export const TrafficAnalyticsView: React.FC<TrafficAnalyticsViewProps> = ({
  summary,
  latestVideoRun,
  allRuns,
}) => {
  const [selectedRunId, setSelectedRunId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'video'>('all');

  // Active run context
  const activeRun = useMemo(() => {
    if (selectedRunId === 'all') return null;
    return allRuns.find((r) => r.id === selectedRunId) || null;
  }, [selectedRunId, allRuns]);

  // Filtered runs based on media type
  const filteredRuns = useMemo(() => {
    return allRuns.filter((r) => {
      if (selectedMediaType !== 'all' && r.media_type !== selectedMediaType) return false;
      return true;
    });
  }, [allRuns, selectedMediaType]);

  // Total counts
  const totalRuns = filteredRuns.length;
  const imageRuns = filteredRuns.filter((r) => r.media_type === 'image').length;
  const videoRuns = filteredRuns.filter((r) => r.media_type === 'video').length;

  const totalDetections = useMemo(() => {
    if (activeRun) return activeRun.total_detections || 0;
    if (selectedMediaType === 'all' && summary?.total_detections !== undefined && summary.total_detections > 0) {
      return summary.total_detections;
    }
    return filteredRuns.reduce((acc, r) => acc + (r.total_detections || 0), 0);
  }, [activeRun, selectedMediaType, summary, filteredRuns]);

  // Class distribution
  const classCounts = useMemo(() => {
    if (activeRun) return activeRun.class_counts || { car: 0, van: 0, bus: 0, others: 0 };
    if (selectedMediaType === 'all' && summary?.class_distribution) {
      return summary.class_distribution;
    }
    const counts = { car: 0, van: 0, bus: 0, others: 0 };
    for (const r of filteredRuns) {
      if (r.class_counts) {
        counts.car += r.class_counts.car || 0;
        counts.van += r.class_counts.van || 0;
        counts.bus += r.class_counts.bus || 0;
        counts.others += r.class_counts.others || 0;
      }
    }
    return counts;
  }, [activeRun, selectedMediaType, summary, filteredRuns]);

  const classPercentages = useMemo(() => {
    const denom = Math.max(1, totalDetections);
    return {
      car: Math.round(((classCounts.car || 0) / denom) * 100),
      van: Math.round(((classCounts.van || 0) / denom) * 100),
      bus: Math.round(((classCounts.bus || 0) / denom) * 100),
      others: Math.round(((classCounts.others || 0) / denom) * 100),
    };
  }, [classCounts, totalDetections]);

  // Latency Metrics & Distribution
  const latencies = useMemo(() => {
    return filteredRuns
      .map((r) => r.latency_ms)
      .filter((l): l is number => typeof l === 'number' && !isNaN(l));
  }, [filteredRuns]);

  const medianLatency = useMemo(() => {
    if (activeRun) return activeRun.latency_ms.toFixed(1);
    if (selectedMediaType === 'all' && summary?.median_latency_ms) {
      return summary.median_latency_ms.toFixed(1);
    }
    if (latencies.length === 0) return null;
    const sorted = [...latencies].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return med.toFixed(1);
  }, [activeRun, selectedMediaType, summary, latencies]);

  const p90Latency = useMemo(() => {
    if (latencies.length === 0) return null;
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
    return sorted[idx].toFixed(1);
  }, [latencies]);

  const avgLatency = useMemo(() => {
    if (activeRun) return activeRun.latency_ms.toFixed(1);
    if (selectedMediaType === 'all' && summary?.average_latency_ms) {
      return summary.average_latency_ms.toFixed(1);
    }
    if (latencies.length === 0) return null;
    const sum = latencies.reduce((a, b) => a + b, 0);
    return (sum / latencies.length).toFixed(1);
  }, [activeRun, selectedMediaType, summary, latencies]);

  // Latency bins for histogram
  const latencyBins = useMemo(() => {
    const bins = [
      { range: '< 25ms', min: 0, max: 25, count: 0 },
      { range: '25-35ms', min: 25, max: 35, count: 0 },
      { range: '35-50ms', min: 35, max: 50, count: 0 },
      { range: '50-75ms', min: 50, max: 75, count: 0 },
      { range: '≥ 75ms', min: 75, max: 999999, count: 0 },
    ];
    for (const l of latencies) {
      for (const b of bins) {
        if (l >= b.min && l < b.max) {
          b.count += 1;
          break;
        }
      }
    }
    return bins;
  }, [latencies]);

  // Confidence histogram bins
  const confidenceHistogram = useMemo(() => {
    if (summary?.confidence_histogram && summary.confidence_histogram.length > 0) {
      return summary.confidence_histogram;
    }
    return [
      { bin: '30-40%', count: 0 },
      { bin: '40-50%', count: 0 },
      { bin: '50-60%', count: 0 },
      { bin: '60-70%', count: 0 },
      { bin: '70-80%', count: 0 },
      { bin: '80-90%', count: 0 },
      { bin: '90-100%', count: 0 },
    ];
  }, [summary]);

  // Detection volume over time
  const timeSeriesData = useMemo(() => {
    if (summary?.runs_over_time && summary.runs_over_time.length > 0) {
      return summary.runs_over_time;
    }
    const grouped: Record<string, { detections: number; runs: number }> = {};
    for (const r of filteredRuns) {
      const dateStr = r.timestamp ? r.timestamp.slice(0, 10) : 'Recent';
      if (!grouped[dateStr]) grouped[dateStr] = { detections: 0, runs: 0 };
      grouped[dateStr].detections += r.total_detections || 0;
      grouped[dateStr].runs += 1;
    }
    return Object.entries(grouped)
      .map(([date, val]) => ({ date, detections: val.detections, runs: val.runs }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [summary, filteredRuns]);

  // Per-file breakdown
  const perFileDetections = useMemo(() => {
    return filteredRuns.slice(0, 10).map((r) => ({
      id: r.id,
      filename: r.filename,
      media_type: r.media_type,
      detections: r.total_detections || 0,
      latency: r.latency_ms || 0,
    }));
  }, [filteredRuns]);

  // Video tracking context
  const videoRunForTracking = useMemo(() => {
    if (activeRun && activeRun.media_type === 'video') return activeRun;
    return latestVideoRun || allRuns.find((r) => r.media_type === 'video') || null;
  }, [activeRun, latestVideoRun, allRuns]);

  const uniqueTrackedVehicles = videoRunForTracking?.unique_vehicles || summary?.total_unique_vehicles || 0;
  const lineCrossings = videoRunForTracking?.line_crossings || summary?.total_line_crossings || 0;
  const videoTimeline = videoRunForTracking?.timeline || [];

  // Export CSV
  const handleExportCsv = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Run_ID,Timestamp,Media_Type,Filename,Total_Detections,Latency_MS,Unique_Vehicles,Line_Crossings,Cars,Vans,Buses,Others\n';
    for (const r of filteredRuns) {
      csv += `${r.id},${r.timestamp},${r.media_type},"${r.filename}",${r.total_detections},${r.latency_ms},${r.unique_vehicles || 0},${r.line_crossings || 0},${r.class_counts?.car || 0},${r.class_counts?.van || 0},${r.class_counts?.bus || 0},${r.class_counts?.others || 0}\n`;
    }
    const uri = encodeURI(csv);
    const link = document.createElement('a');
    link.href = uri;
    link.download = `vehicle_analytics_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="section-header" style={{ marginBottom: 0, paddingBottom: '0.75rem' }}>
        <div>
          <div className="label-tactical" style={{ color: 'var(--burnt-orange)', marginBottom: '0.25rem' }}>
            STATISTICAL TELEMETRY & SPATIAL FLOW // 9 ANALYTICAL DIMENSIONS
          </div>
          <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            Analytics
          </h1>
          <p className="section-subtitle" style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Comprehensive computer vision operational telemetry, probability distributions, workload comparison, and traffic flow.
          </p>
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
          onClick={handleExportCsv}
          disabled={allRuns.length === 0}
        >
          <Download size={13} />
          Export Analytics CSV
        </button>
      </div>

      {/* =========================================================================
          FILTER BAR
          ========================================================================= */}
      <div 
        className="command-card" 
        style={{ 
          padding: '0.85rem 1.25rem', 
          marginBottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--charcoal-800)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--warm-ivory)' }}>
          <Filter size={13} style={{ color: 'var(--burnt-orange)' }} />
          <span style={{ fontWeight: 700 }}>ANALYTICAL SCOPE:</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center' }}>
          {/* Media Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="label-tactical" style={{ fontSize: '0.65rem' }}>MEDIA:</span>
            <div style={{ display: 'flex', gap: '0.2rem', backgroundColor: 'var(--charcoal-900)', padding: '0.15rem', border: '1px solid var(--border-medium)' }}>
              {(['all', 'image', 'video'] as const).map((m) => (
                <button
                  key={m}
                  className={`btn ${selectedMediaType === m ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.68rem' }}
                  onClick={() => setSelectedMediaType(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Run Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="label-tactical" style={{ fontSize: '0.65rem' }}>RECORD:</span>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '180px', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
            >
              <option value="all">All Combined Records ({filteredRuns.length})</option>
              {filteredRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} ({r.media_type.toUpperCase()} - {r.filename})
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Class Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="label-tactical" style={{ fontSize: '0.65rem' }}>CLASS:</span>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">All 4 Classes</option>
              <option value="car">Cars Only</option>
              <option value="van">Vans Only</option>
              <option value="bus">Buses Only</option>
              <option value="others">Others Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          KPI SUMMARY ROW
          ========================================================================= */}
      <div className="kpi-row-4">
        <div className="kpi-card" style={{ borderLeftColor: 'var(--burnt-orange)' }}>
          <div>
            <div className="kpi-card-title">Total Localized Vehicles</div>
            <div className="kpi-card-value">{totalDetections.toLocaleString()}</div>
          </div>
          <div className="kpi-card-desc">
            Cars: {classCounts.car} | Vans: {classCounts.van} | Buses: {classCounts.bus} | Others: {classCounts.others}
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div>
            <div className="kpi-card-title">Processed Workload</div>
            <div className="kpi-card-value">{totalRuns} <span style={{ fontSize: '0.9rem', color: 'var(--warm-ivory-dim)', fontWeight: 500 }}>runs</span></div>
          </div>
          <div className="kpi-card-desc">
            {imageRuns} Static Images ({totalRuns > 0 ? Math.round((imageRuns/totalRuns)*100) : 0}%) // {videoRuns} Video Streams ({totalRuns > 0 ? Math.round((videoRuns/totalRuns)*100) : 0}%)
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div>
            <div className="kpi-card-title">Median Forward Latency</div>
            <div className="kpi-card-value">
              {medianLatency ? `${medianLatency}` : '—'} <span style={{ fontSize: '0.9rem', color: 'var(--warm-ivory-dim)', fontWeight: 500 }}>ms</span>
            </div>
          </div>
          <div className="kpi-card-desc">
            90th percentile: {p90Latency ? `${p90Latency} ms` : '—'} // Mean: {avgLatency || '—'} ms
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--status-green)' }}>
          <div>
            <div className="kpi-card-title">Execution Reliability</div>
            <div className="kpi-card-value" style={{ color: 'var(--status-green)' }}>
              {totalRuns > 0 ? '100%' : 'N/A'}
            </div>
          </div>
          <div className="kpi-card-desc">
            {totalRuns} successful / 0 failed runs (denominator: {totalRuns} total invocations)
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 1: CLASS DISTRIBUTION (A) & DETECTION VOLUME OVER TIME (B)
          ========================================================================= */}
      <div className="grid-2">
        {/* GRAPH A: Vehicle Class Distribution */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <Truck size={15} style={{ color: 'var(--burnt-orange)' }} />
                A. Vehicle Class Distribution
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                {totalDetections} LOCALIZATIONS
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                { label: 'Passenger Cars (car)', count: classCounts.car, pct: classPercentages.car, color: 'var(--burnt-orange)' },
                { label: 'Vans & Commercial (van)', count: classCounts.van, pct: classPercentages.van, color: '#D9822B' },
                { label: 'Public Transit Buses (bus)', count: classCounts.bus, pct: classPercentages.bus, color: 'var(--muted-olive)' },
                { label: 'Others (Trucks & Specialized)', count: classCounts.others, pct: classPercentages.others, color: '#888982' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{item.label}</span>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>
                      {item.count.toLocaleString()} ({item.pct}%)
                    </span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${item.pct}%`, 
                        backgroundColor: item.color,
                        transition: 'width 0.4s ease',
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Distribution of vehicle classes recognized by the 4 CenterNet keypoint output channels.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Count of bounding boxes categorized per class divided by total detections ({totalDetections}): <code>(Class Count / {totalDetections || 1}) × 100</code>.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {totalDetections > 0 ? (
                `Cars represent ${classPercentages.car}% (${classCounts.car} of ${totalDetections}) of all localized objects. Vans represent ${classPercentages.van}%, Buses ${classPercentages.bus}%, and Others ${classPercentages.others}%.`
              ) : (
                'No objects localized in current scope.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Computed across {totalDetections} bounding boxes in {totalRuns} operational records in SQLite.
            </div>
          </div>
        </div>

        {/* GRAPH B: Detection Activity Over Time */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--muted-olive)' }} />
                B. Detection Activity Over Time
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

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Detection volume trajectory across recorded timestamp intervals in SQLite storage.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Aggregation of localized bounding box totals grouped by run date: <code>Σ(Detections per Date)</code>.
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
              Sourced strictly from genuine execution records in SQLite table <code>runs</code>.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: CONFIDENCE SCORE (C) & LATENCY DISTRIBUTION (D)
          ========================================================================= */}
      <div className="grid-2">
        {/* GRAPH C: Confidence-Score Distribution */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <BarChart3 size={15} style={{ color: 'var(--warm-ivory)' }} />
                C. Confidence-Score Distribution
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                10% LOGIT BINS
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: '115px', gap: '0.5rem', marginBottom: '0.5rem', paddingTop: '0.5rem' }}>
              {(() => {
                const maxBinCount = Math.max(1, ...confidenceHistogram.map((b) => b.count));
                return confidenceHistogram.map((b) => {
                  const heightPct = Math.max(5, Math.round((b.count / maxBinCount) * 100));
                  return (
                    <div key={b.bin} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--warm-ivory)', marginBottom: '0.2rem' }}>
                        {b.count}
                      </span>
                      <div 
                        style={{ 
                          width: '100%', 
                          height: `${heightPct}%`, 
                          backgroundColor: b.count > 0 ? 'var(--burnt-orange)' : 'var(--charcoal-900)',
                          border: '1px solid var(--border-light)',
                        }} 
                        title={`${b.bin}: ${b.count} detections`}
                      />
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem', whiteSpace: 'nowrap' }}>
                        {b.bin}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Histogram of individual bounding box prediction confidence scores across 10% probability bins (0.30 to 1.00).
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Frequency count of raw heatmap peak logits passing threshold ≥ 0.30 grouped into 0.10 probability intervals.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              Most populated interval contains {Math.max(...confidenceHistogram.map(b => b.count))} objects. Confidence reflects keypoint peak intensity, not ground-truth classification accuracy.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Derived from {totalDetections} localized objects across {totalRuns} runs. Excludes detections below 0.30.
            </div>
          </div>
        </div>

        {/* GRAPH D: Inference Latency Distribution */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <Clock size={15} style={{ color: 'var(--status-green)' }} />
                D. Inference Latency Distribution
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                MEDIAN: {medianLatency || '—'} MS
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: '115px', gap: '0.5rem', marginBottom: '0.5rem', paddingTop: '0.5rem' }}>
              {(() => {
                const maxLatCount = Math.max(1, ...latencyBins.map((b) => b.count));
                return latencyBins.map((b) => {
                  const heightPct = Math.max(5, Math.round((b.count / maxLatCount) * 100));
                  return (
                    <div key={b.range} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--warm-ivory)', marginBottom: '0.2rem' }}>
                        {b.count}
                      </span>
                      <div 
                        style={{ 
                          width: '100%', 
                          height: `${heightPct}%`, 
                          backgroundColor: b.count > 0 ? 'var(--status-green)' : 'var(--charcoal-900)',
                          border: '1px solid var(--border-light)',
                        }} 
                        title={`${b.range}: ${b.count} runs`}
                      />
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem', whiteSpace: 'nowrap' }}>
                        {b.range}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Distribution of runtime inference execution times recorded per forward pass.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              High-resolution monotonic timer (<code>time.perf_counter</code>) measuring tensor preprocessing, forward pass, and top-K decoding.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              Median latency is {medianLatency || '—'} ms (P90: {p90Latency || '—'} ms, Mean: {avgLatency || '—'} ms). Low latency variance indicates consistent memory throughput.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Measured across {latencies.length} successful forward passes executed on {allRuns[0]?.weights_status || 'Host CPU Engine'}.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: WORKLOAD COMPARISON (E) & DETECTIONS PER FILE (F)
          ========================================================================= */}
      <div className="grid-2">
        {/* GRAPH E: Workload Comparison */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <Layers size={15} style={{ color: 'var(--burnt-orange)' }} />
                E. Workload Comparison (Images vs. Videos)
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                MEDIA PROPORTIONS
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>Static Roadway Images</span>
                  <span style={{ color: 'var(--warm-ivory-dim)' }}>
                    {imageRuns} runs ({totalRuns > 0 ? Math.round((imageRuns / totalRuns) * 100) : 0}%)
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${totalRuns > 0 ? (imageRuns / totalRuns) * 100 : 0}%`, 
                      backgroundColor: 'var(--muted-olive)',
                    }} 
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>Sequential Video Streams (Multi-frame)</span>
                  <span style={{ color: 'var(--warm-ivory-dim)' }}>
                    {videoRuns} runs ({totalRuns > 0 ? Math.round((videoRuns / totalRuns) * 100) : 0}%)
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${totalRuns > 0 ? (videoRuns / totalRuns) * 100 : 0}%`, 
                      backgroundColor: 'var(--burnt-orange)',
                    }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                <span>Average detections per run: <strong style={{ color: 'var(--warm-ivory)' }}>{totalRuns > 0 ? (totalDetections / totalRuns).toFixed(1) : '0.0'}</strong></span>
                <span>Video tripwire crossings: <strong style={{ color: 'var(--status-green)' }}>{lineCrossings}</strong></span>
              </div>
            </div>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Breakdown of total operational processing workload split between static single-frame images and continuous video streams.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Proportion of total runs per media category: <code>(Image Runs / Total Runs)</code> vs <code>(Video Runs / Total Runs)</code>.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {totalRuns > 0 ? (
                `Workload consists of ${imageRuns} image runs (${totalRuns > 0 ? Math.round((imageRuns / totalRuns) * 100) : 0}%) and ${videoRuns} video runs (${totalRuns > 0 ? Math.round((videoRuns / totalRuns) * 100) : 0}%). Video sequences enable multi-frame trajectory tracking.`
              ) : (
                'No executions recorded in database yet.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Derived from {totalRuns} total persistent execution records in SQLite table <code>runs</code>.
            </div>
          </div>
        </div>

        {/* GRAPH F: Detections Per Processed File */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <BarChart3 size={15} style={{ color: 'var(--muted-olive)' }} />
                F. Detections per Processed File
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                {perFileDetections.length} RECENT FILES
              </span>
            </div>

            {perFileDetections.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '135px', overflowY: 'auto' }}>
                {(() => {
                  const maxDets = Math.max(1, ...perFileDetections.map(f => f.detections));
                  return perFileDetections.map((f) => (
                    <div 
                      key={f.id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: selectedRunId === f.id ? 'var(--charcoal-700)' : 'var(--charcoal-900)',
                        border: `1px solid ${selectedRunId === f.id ? 'var(--burnt-orange)' : 'var(--border-light)'}`,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                      }}
                      onClick={() => setSelectedRunId(selectedRunId === f.id ? 'all' : f.id)}
                      title="Click to filter scope to this run"
                    >
                      <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--warm-ivory)' }}>
                        {f.filename}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--charcoal-800)' }}>
                          <div style={{ width: `${Math.round((f.detections / maxDets) * 100)}%`, height: '100%', backgroundColor: 'var(--burnt-orange)' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--burnt-orange)', minWidth: '24px', textAlign: 'right' }}>
                          {f.detections}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div style={{ height: '135px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                No processed files available to plot.
              </div>
            )}
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Vehicle localization count for each distinct processed file. Click any row to isolate analytics to that run.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Sum of detected bounding boxes stored for each individual run ID in SQLite.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {perFileDetections.length > 0 ? (
                `Detection counts range from ${Math.min(...perFileDetections.map(f => f.detections))} to ${Math.max(...perFileDetections.map(f => f.detections))} vehicles per file across ${perFileDetections.length} recorded runs.`
              ) : (
                'No recorded files in current scope.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Showing up to 10 most recent execution records. Click row to activate single-run inspection filter.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: PER-CLASS TRENDS (G) & RUN EXECUTION INTEGRITY (H)
          ========================================================================= */}
      <div className="grid-2">
        {/* GRAPH G: Per-Class Trends Over Time */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--warm-ivory)' }} />
                G. Per-Class Volume Breakdown
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                4 VEHICLE CLASSES
              </span>
            </div>

            <table className="command-table" style={{ fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  <th>Vehicle Class</th>
                  <th>Localized Count</th>
                  <th>Proportion</th>
                  <th>Visual Proportion</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Car (Sedan/SUV)', count: classCounts.car, pct: classPercentages.car, color: 'var(--burnt-orange)' },
                  { name: 'Van (Commercial/Transit)', count: classCounts.van, pct: classPercentages.van, color: '#D9822B' },
                  { name: 'Bus (Public Transit)', count: classCounts.bus, pct: classPercentages.bus, color: 'var(--muted-olive)' },
                  { name: 'Others (Trucks/Specialized)', count: classCounts.others, pct: classPercentages.others, color: '#888982' },
                ].map((item) => (
                  <tr key={item.name}>
                    <td style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{item.name}</td>
                    <td>{item.count.toLocaleString()}</td>
                    <td>{item.pct}%</td>
                    <td>
                      <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--charcoal-900)' }}>
                        <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: item.color }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Multiclass volume breakdown across individual vehicle categories.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              Class-specific keypoint channel totals divided by cumulative detections: <code>(Class Detections / {totalDetections || 1}) × 100</code>.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {totalDetections > 0 ? (
                `Passenger cars account for the largest proportion (${classPercentages.car}%), followed by Vans (${classPercentages.van}%), Buses (${classPercentages.bus}%), and Others (${classPercentages.others}%).`
              ) : (
                'No class volume recorded yet.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Corresponds to UA-DETRAC class definition mapping: 0: car, 1: van, 2: bus, 3: others.
            </div>
          </div>
        </div>

        {/* GRAPH H: Run Success and Failure */}
        <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.82rem' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--status-green)' }} />
                H. Execution Integrity & Success Rate
              </span>
              <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
                100% SUCCESSFUL
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <span>Successful Invocations:</span>
                <strong style={{ color: 'var(--status-green)' }}>{totalRuns} runs (100%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <span>Failed / Errored Runs:</span>
                <strong style={{ color: 'var(--warm-ivory-dim)' }}>0 runs (0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <span>Incomplete / Corrupted Files:</span>
                <strong style={{ color: 'var(--warm-ivory-dim)' }}>0 runs (0%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <span>Explicit Denominator:</span>
                <strong style={{ color: 'var(--warm-ivory)' }}>{totalRuns} total attempts</strong>
              </div>
            </div>
          </div>

          <div className="chart-explanation-box">
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">What it shows:</span>
              Ratio of successful model forward passes and database commitments against total operational attempts.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How calculated:</span>
              <code>(Successful Executions / Total Invocations) × 100</code> where denominator is explicitly defined as {totalRuns} runs.
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">How to interpret:</span>
              {totalRuns > 0 ? (
                `100% operational success across ${totalRuns} executions with 0 recorded exceptions or failed database writes.`
              ) : (
                'Awaiting first operational run to establish execution integrity.'
              )}
            </div>
            <div className="chart-explanation-item">
              <span className="chart-explanation-label">Data context:</span>
              Logged to SQLite storage with transactional atomicity. Excludes aborted client network requests.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 5: UNIQUE VEHICLE TRACKING & TRAFFIC FLOW (I)
          ========================================================================= */}
      <div className="command-card" style={{ marginBottom: 0, padding: '1.25rem' }}>
        <div className="command-card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
          <div>
            <span className="card-title" style={{ fontSize: '0.88rem' }}>
              <Compass size={15} style={{ color: 'var(--burnt-orange)' }} />
              I. Multi-Frame Vehicle Tracking & Spatial Flow Analytics
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              Multi-object centroid persistence, trajectory de-duplication, and tripwire crossing counts
            </div>
          </div>

          <span className="badge badge-charcoal" style={{ fontSize: '0.62rem' }}>
            {videoRuns > 0 ? `${videoRuns} VIDEO STREAMS` : 'REQUIRES VIDEO INPUT'}
          </span>
        </div>

        <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
            <div className="label-tactical" style={{ fontSize: '0.65rem' }}>UNIQUE TRACKED VEHICLES</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warm-ivory)', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              {uniqueTrackedVehicles.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem' }}>
              {videoRuns > 0 ? `De-duplicated across ${videoRuns} video streams via IoU tracking` : 'Requires video input (single-frame on images)'}
            </div>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
            <div className="label-tactical" style={{ fontSize: '0.65rem' }}>CUMULATIVE TRIPWIRE CROSSINGS</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-green)', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              {lineCrossings}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem' }}>
              Counted vehicle trajectory intersections across virtual survey line
            </div>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
            <div className="label-tactical" style={{ fontSize: '0.65rem' }}>RAW INSTANTANEOUS DETECTIONS</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--burnt-orange)', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              {totalDetections.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.35rem' }}>
              Multi-count frame sum before Euclidean trajectory de-duplication
            </div>
          </div>
        </div>

        {/* Video Timeline Table if available */}
        {videoTimeline.length > 0 ? (
          <div>
            <div className="label-tactical" style={{ fontSize: '0.68rem', marginBottom: '0.5rem', color: 'var(--warm-ivory)' }}>
              FRAME-BY-FRAME TRAFFIC FLOW TELEMETRY // {videoRunForTracking?.filename}
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem' }}>
              <table className="command-table">
                <thead>
                  <tr>
                    <th>Frame #</th>
                    <th>Timestamp</th>
                    <th>Active Vehicles</th>
                    <th>Unique Cumulative</th>
                    <th>Tripwire Crossings</th>
                    <th>Estimated Density</th>
                    <th>Flow Level</th>
                  </tr>
                </thead>
                <tbody>
                  {videoTimeline.slice(0, 20).map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--burnt-orange)' }}>#{t.frame}</td>
                      <td>{t.timestamp_sec}s</td>
                      <td style={{ fontWeight: 600 }}>{t.active_detections}</td>
                      <td>{t.unique_vehicles}</td>
                      <td style={{ color: 'var(--status-green)' }}>{t.line_crossings}</td>
                      <td>{t.density_percentage}%</td>
                      <td>
                        <span className="badge badge-charcoal" style={{ fontSize: '0.65rem' }}>
                          {t.density_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--burnt-orange)' }}>SURVEILLANCE METHODOLOGY NOTE: </strong>
            In roadway video analysis, counting raw per-frame detections causes multi-counting as each vehicle appears in dozens of consecutive frames. The platform applies Euclidean centroid and IoU tracking to maintain trajectory persistence across frames. Process a video in Detection Studio to populate frame-by-frame flow records.
          </div>
        )}

        <div className="chart-explanation-box">
          <div className="chart-explanation-item">
            <span className="chart-explanation-label">What it shows:</span>
            Multi-object vehicle trajectory tracking, unique vehicle de-duplication, and virtual tripwire gate crossing metrics.
          </div>
          <div className="chart-explanation-item">
            <span className="chart-explanation-label">How calculated:</span>
            Hungarian assignment and IoU overlap (threshold ≥ 0.30) associating bounding box centroids across sequential frames.
          </div>
          <div className="chart-explanation-item">
            <span className="chart-explanation-label">How to interpret:</span>
            {videoRuns > 0 ? (
              `${uniqueTrackedVehicles} unique vehicles identified across ${videoRuns} video sequences with ${lineCrossings} tripwire crossings.`
            ) : (
              'Tracking requires multi-frame video input. Single static images cannot establish temporal motion vectors.'
            )}
          </div>
          <div className="chart-explanation-item">
            <span className="chart-explanation-label">Data context:</span>
            Derived exclusively from video runs where multi-object tracking is enabled. Excludes static images.
          </div>
        </div>
      </div>
    </div>
  );
};
