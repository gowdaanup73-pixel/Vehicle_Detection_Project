import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CloudRain,
  Download,
  Grid3X3,
  LineChart as LineChartIcon,
  RefreshCw,
  Sliders,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { fetchMetrics } from '../api';
import { ChartWatermark, DemoBadge } from './DemoBadge';

const CHARCOAL = '#222320';
const IVORY = '#E9E2D4';
const BURNT_ORANGE = '#C86B3C';
const OLIVE = '#85866A';
const SLATE_TEAL = '#5A7D7C';
const BORDER_LIGHT = 'rgba(233, 226, 212, 0.12)';

const CustomTooltip = ({ active, payload, label, unit = '%' }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: CHARCOAL,
          border: '1px solid var(--border-medium, #3A3B35)',
          padding: '0.5rem 0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.72rem',
          color: IVORY,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: IVORY }}>
          {label}
        </div>
        {payload.map((item, idx) => (
          <div key={idx} style={{ color: item.color || IVORY, display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
            <span>{item.name}:</span>
            <span style={{ fontWeight: 600 }}>
              {item.value != null ? `${item.value} ${unit}`.trim() : 'Not evaluated'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: CHARCOAL,
          border: '1px solid var(--border-medium, #3A3B35)',
          padding: '0.5rem 0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.72rem',
          color: IVORY,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontWeight: 700, color: data.isProposed ? BURNT_ORANGE : IVORY, marginBottom: '0.25rem' }}>
          {data.name} {data.isProposed && '(Proposed)'}
        </div>
        <div>Speed: {data.fps} FPS</div>
        <div>Accuracy: {data.mAP50}% mAP@0.5</div>
      </div>
    );
  }
  return null;
};

const NotEvaluatedState = ({ message = 'Metric data not evaluated for this benchmark configuration.' }) => (
  <div
    style={{
      height: '100%',
      minHeight: '220px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--charcoal-900, #1b1c1a)',
      border: '1px dashed var(--border-light, rgba(233,226,212,0.15))',
      padding: '1.5rem',
      textAlign: 'center',
    }}
    aria-label="Not evaluated state"
  >
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        backgroundColor: 'rgba(233, 226, 212, 0.06)',
        border: '1px solid var(--border-light, rgba(233,226,212,0.15))',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.7rem',
        color: 'var(--warm-ivory-dim, #B8A99A)',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      <AlertCircle size={12} style={{ color: 'var(--warm-ivory-dim, #B8A99A)' }} />
      <span>Not evaluated</span>
    </div>
    <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim, #B8A99A)', maxWidth: '320px', fontFamily: 'var(--font-mono, monospace)' }}>
      {message}
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '1rem',
    }}
    aria-label="Loading metrics charts"
  >
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div
        key={i}
        className="command-card"
        style={{
          minHeight: '280px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'pulse 1.5s infinite',
        }}
      >
        <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--charcoal-800, #2c2d29)' }} />
        <div style={{ flex: 1, backgroundColor: 'var(--charcoal-900, #1b1c1a)' }} />
      </div>
    ))}
  </div>
);

export const downloadMetricsCsv = (metrics, isDemo = false) => {
  if (!metrics) return;

  const cell = (v) => (v == null ? '' : String(v));
  const rows = [];

  if (isDemo) {
    rows.push(['# DEMO DATA - SIMULATED TELEMETRY (NOT REAL EVALUATION)']);
    rows.push([]);
  }

  // 1. Model comparison metrics
  rows.push(['Model', 'Precision', 'Recall', 'F1', 'Accuracy', 'mAP50', 'mAP50_95', 'FPS', 'Latency_ms', 'Params_M', 'GFLOPs']);
  for (const m of metrics.models || []) {
    rows.push([
      cell(m.name),
      cell(m.precision),
      cell(m.recall),
      cell(m.f1),
      cell(m.accuracy),
      cell(m.mAP50),
      cell(m.mAP50_95),
      cell(m.fps),
      cell(m.latency_ms),
      cell(m.params),
      cell(m.gflops),
    ]);
  }

  rows.push([]);
  // 2. Per-Class Metrics
  rows.push(['Class', 'Precision', 'Recall', 'F1', 'AP50']);
  for (const [cls, val] of Object.entries(metrics.per_class || {})) {
    rows.push([
      cell(cls),
      cell(val?.precision),
      cell(val?.recall),
      cell(val?.f1),
      cell(val?.ap50),
    ]);
  }

  rows.push([]);
  // 3. Environmental Condition mAP
  rows.push(['Condition', 'mAP50']);
  for (const [cond, val] of Object.entries(metrics.per_condition || {})) {
    rows.push([cell(cond), cell(val)]);
  }

  rows.push([]);
  // 4. Convergence History
  rows.push(['Epoch', 'Train_Loss', 'Val_Loss', 'Val_mAP50']);
  for (const h of metrics.history || []) {
    rows.push([cell(h.epoch), cell(h.train_loss), cell(h.val_loss), cell(h.val_map_50)]);
  }

  const csvContent = rows
    .map((r) => r.map((c) => (c.includes(',') ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', isDemo ? 'metrics_DEMO.csv' : 'metrics.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * @param {Object} [props]
 * @param {any} [props.metrics]
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 * @param {(() => void) | null} [props.onRetry]
 * @param {React.ReactNode} [props.downloadButton]
 * @param {any} [props.demoData]
 */
export const MetricsCharts = ({
  metrics: externalMetrics = null,
  loading: externalLoading = undefined,
  error: externalError = null,
  onRetry: externalOnRetry = null,
  downloadButton = null,
  demoData = null,
} = {}) => {
  const [internalMetrics, setInternalMetrics] = useState(null);
  const [internalLoading, setInternalLoading] = useState(!externalMetrics);
  const [internalError, setInternalError] = useState(null);

  const loadData = async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await fetchMetrics();
      setInternalMetrics(data);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Failed to fetch metrics data');
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (!externalMetrics) {
      loadData();
    }
  }, [externalMetrics]);

  const isDemoActive = Boolean(demoData?.isDemoMode);
  const metrics = isDemoActive ? (demoData?.metrics || null) : (externalMetrics || internalMetrics);
  const isLoading = isDemoActive ? false : (externalLoading !== undefined ? externalLoading : internalLoading);
  const activeError = isDemoActive ? null : (externalError || internalError || metrics?.error);
  const handleRetry = externalOnRetry || loadData;

  if (isLoading) {
    return <ChartSkeleton />;
  }

  // Grouped Bars across models (Precision, Recall, F1, mAP50)
  const groupedBarData = (metrics?.models || []).map((m) => ({
    name: m.name,
    Precision: m.precision != null ? Number((m.precision * 100).toFixed(1)) : null,
    Recall: m.recall != null ? Number((m.recall * 100).toFixed(1)) : null,
    F1: m.f1 != null ? Number((m.f1 * 100).toFixed(1)) : null,
    'mAP@0.5': m.mAP50 != null ? Number((m.mAP50 * 100).toFixed(1)) : null,
  }));
  const hasGroupedData = groupedBarData.some(
    (d) => d.Precision != null || d.Recall != null || d.F1 != null || d['mAP@0.5'] != null
  );

  // Per-class F1 bars (proposed model)
  const classF1Data = Object.entries(metrics?.per_class || {}).map(([cls, val]) => ({
    cls: cls.toUpperCase(),
    F1: val?.f1 != null ? Number((val.f1 * 100).toFixed(1)) : null,
    'AP@0.5': val?.ap50 != null ? Number((val.ap50 * 100).toFixed(1)) : null,
  }));
  const hasClassF1 = classF1Data.some((d) => d.F1 != null);

  // Epoch history (loss + val_map_50)
  const epochData = (metrics?.history || []).map((h) => ({
    epoch: h.epoch,
    'Train Loss': h.train_loss != null ? Number(h.train_loss.toFixed(4)) : null,
    'Val Loss': h.val_loss != null ? Number(h.val_loss.toFixed(4)) : null,
    'Val mAP@0.5 (%)': h.val_map_50 != null ? Number((h.val_map_50 * 100).toFixed(2)) : null,
  }));
  const hasEpochData = epochData.length > 0 && epochData.some(
    (d) => d['Train Loss'] != null || d['Val Loss'] != null || d['Val mAP@0.5 (%)'] != null
  );

  // Scatter FPS vs mAP50
  const scatterData = (metrics?.models || [])
    .filter((m) => m.fps != null && m.mAP50 != null)
    .map((m) => ({
      name: m.name,
      fps: Number(m.fps),
      mAP50: Number((m.mAP50 * 100).toFixed(1)),
      isProposed: m.name.toLowerCase().includes('improved'),
    }));
  const hasScatterData = scatterData.length > 0;

  // Confusion matrix
  const cmClasses = metrics?.confusion_matrix?.classes || ['car', 'van', 'bus', 'others'];
  const cmMatrix = metrics?.confusion_matrix?.matrix;
  const hasConfusionMatrix = Array.isArray(cmMatrix) && cmMatrix.length === cmClasses.length;

  // Weather conditions
  const conditionData = Object.entries(metrics?.per_condition || {}).map(([cond, val]) => ({
    condition: cond.charAt(0).toUpperCase() + cond.slice(1),
    'mAP@0.5': val != null ? Number((val * 100).toFixed(1)) : null,
  }));
  const hasConditionData = conditionData.some((d) => d['mAP@0.5'] != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} aria-label="Metrics Dashboard">
      {/* Top Bar with Status and Optional Download Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="label-tactical" style={{ color: BURNT_ORANGE }}>
            METRICS DASHBOARD // 6-PANEL COMPARATIVE EVALUATION
          </div>
          {isDemoActive && <DemoBadge />}
          {activeError && (
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                color: 'var(--status-red, #E57373)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <AlertCircle size={13} /> {activeError}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => downloadMetricsCsv(metrics, isDemoActive)}
            title="Download metrics as CSV"
            aria-label="Download metrics CSV"
          >
            <Download size={12} style={{ color: BURNT_ORANGE }} />
            <span>Download metrics CSV</span>
          </button>
          {downloadButton}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
            onClick={handleRetry}
            title="Reload metrics data"
            aria-label="Refresh metrics"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Grid of 6 Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1rem' }}>
        
        {/* CHART A: Grouped Bars: Precision / Recall / F1 / mAP50 */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="Comparative Model Metrics Chart">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <BarChart3 size={15} style={{ color: BURNT_ORANGE }} />
              Model Precision / Recall / F1 / mAP@0.5
            </span>
            <span className="label-tactical">UNITS: %</span>
          </div>
          <div style={{ padding: '1rem', height: '280px' }}>
            {hasGroupedData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedBarData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_LIGHT} />
                  <XAxis dataKey="name" stroke={IVORY} fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke={IVORY} fontSize={10} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem', color: IVORY, paddingTop: '10px' }} />
                  <Bar dataKey="Precision" fill={OLIVE} />
                  <Bar dataKey="Recall" fill="#B8A99A" />
                  <Bar dataKey="F1" fill={SLATE_TEAL} />
                  <Bar dataKey="mAP@0.5" fill={BURNT_ORANGE} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <NotEvaluatedState message="No evaluated precision/recall/F1 metrics recorded across comparative models. Unmeasured fields remain null." />
            )}
          </div>
        </div>

        {/* CHART B: Per-class F1 bars (proposed model) */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="Per-Class F1 Chart">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <Sliders size={15} style={{ color: BURNT_ORANGE }} />
              Per-Class F1 Score (Proposed Model)
            </span>
            <span className="label-tactical">CLASSES: 4</span>
          </div>
          <div style={{ padding: '1rem', height: '280px' }}>
            {hasClassF1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classF1Data} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_LIGHT} />
                  <XAxis dataKey="cls" stroke={IVORY} fontSize={11} />
                  <YAxis stroke={IVORY} fontSize={10} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem', color: IVORY }} />
                  <Bar dataKey="F1" fill={BURNT_ORANGE} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <NotEvaluatedState message="Per-class F1 score for the proposed model has not been evaluated. Strictly marked as 'Not evaluated'." />
            )}
          </div>
        </div>

        {/* CHART C: Loss + validation mAP vs epoch */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="Loss and Validation mAP vs Epoch Chart">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <LineChartIcon size={15} style={{ color: BURNT_ORANGE }} />
              Loss & Validation mAP@0.5 vs Epoch
            </span>
            <span className="label-tactical">CONVERGENCE</span>
          </div>
          <div style={{ padding: '1rem', height: '280px' }}>
            {hasEpochData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={epochData} margin={{ top: 10, right: 15, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_LIGHT} />
                  <XAxis dataKey="epoch" stroke={IVORY} fontSize={10} label={{ value: 'Epoch', position: 'insideBottomRight', offset: -5, fill: IVORY, fontSize: 10 }} />
                  <YAxis yAxisId="left" stroke={BURNT_ORANGE} fontSize={10} domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" stroke={OLIVE} fontSize={10} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip unit="" />} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem', color: IVORY }} />
                  <Line yAxisId="left" type="monotone" dataKey="Train Loss" stroke={BURNT_ORANGE} strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="Val Loss" stroke={OLIVE} strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  {epochData.some((d) => d['Val mAP@0.5 (%)'] != null) && (
                    <Line yAxisId="right" type="monotone" dataKey="Val mAP@0.5 (%)" stroke={IVORY} strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <NotEvaluatedState message="Epoch history convergence metrics not available for this run." />
            )}
          </div>
        </div>

        {/* CHART D: Scatter FPS vs mAP50 */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="FPS vs mAP Trade-off Chart">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <Zap size={15} style={{ color: BURNT_ORANGE }} />
              Efficiency Trade-off: Speed (FPS) vs mAP@0.5
            </span>
            <span className="label-tactical">ORANGE = PROPOSED</span>
          </div>
          <div style={{ padding: '1rem', height: '280px' }}>
            {hasScatterData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_LIGHT} />
                  <XAxis type="number" dataKey="fps" name="Speed" unit=" FPS" stroke={IVORY} fontSize={10} label={{ value: 'FPS', position: 'insideBottomRight', offset: -5, fill: IVORY, fontSize: 10 }} />
                  <YAxis type="number" dataKey="mAP50" name="mAP@0.5" unit="%" stroke={IVORY} fontSize={10} domain={[0, 100]} label={{ value: 'mAP@0.5 (%)', angle: -90, position: 'insideLeft', fill: IVORY, fontSize: 10 }} />
                  <ZAxis range={[60, 120]} />
                  <Tooltip content={<ScatterTooltip />} />
                  <Scatter name="Models" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isProposed ? BURNT_ORANGE : OLIVE} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <NotEvaluatedState message="Runtime latency/FPS vs accuracy trade-off unmeasured. All unmeasured values remain null." />
            )}
          </div>
        </div>

        {/* CHART E: Confusion matrix grid */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="Confusion Matrix Grid">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <Grid3X3 size={15} style={{ color: BURNT_ORANGE }} />
              4×4 Vehicle Class Confusion Matrix
            </span>
            <span className="label-tactical">PRED VS TRUE</span>
          </div>
          <div style={{ padding: '1rem', minHeight: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {hasConfusionMatrix ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.4rem', border: `1px solid ${BORDER_LIGHT}`, color: 'var(--warm-ivory-dim)' }}>True \ Pred</th>
                      {cmClasses.map((c) => (
                        <th key={c} style={{ padding: '0.4rem', border: `1px solid ${BORDER_LIGHT}`, color: IVORY, textTransform: 'uppercase' }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cmClasses.map((trueCls, rIdx) => (
                      <tr key={trueCls}>
                        <td style={{ padding: '0.4rem', border: `1px solid ${BORDER_LIGHT}`, fontWeight: 700, color: IVORY, textTransform: 'uppercase' }}>
                          {trueCls}
                        </td>
                        {cmClasses.map((predCls, cIdx) => {
                          const val = cmMatrix[rIdx]?.[cIdx];
                          const isDiag = rIdx === cIdx;
                          return (
                            <td
                              key={predCls}
                              style={{
                                padding: '0.4rem',
                                border: `1px solid ${BORDER_LIGHT}`,
                                textAlign: 'center',
                                backgroundColor: isDiag ? 'rgba(200, 107, 60, 0.15)' : 'transparent',
                                color: val != null ? IVORY : 'var(--warm-ivory-dim)',
                              }}
                            >
                              {val != null ? val : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NotEvaluatedState message="4×4 vehicle confusion matrix has not been computed for this checkpoint." />
            )}
          </div>
        </div>

        {/* CHART F: mAP per weather condition */}
        <div className="command-card" style={{ position: 'relative' }} aria-label="Weather Condition Performance Chart">
          {isDemoActive && <ChartWatermark />}
          <div className="command-card-header">
            <span className="card-title">
              <CloudRain size={15} style={{ color: BURNT_ORANGE }} />
              mAP@0.5 per Weather Condition
            </span>
            <span className="label-tactical">ENVIRONMENTAL</span>
          </div>
          <div style={{ padding: '1rem', height: '280px' }}>
            {hasConditionData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conditionData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_LIGHT} />
                  <XAxis dataKey="condition" stroke={IVORY} fontSize={11} />
                  <YAxis stroke={IVORY} fontSize={10} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem', color: IVORY }} />
                  <Bar dataKey="mAP@0.5" fill={OLIVE} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <NotEvaluatedState message="Per-condition mAP (sunny, night, rainy, cloudy) has not been evaluated." />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricsCharts;
