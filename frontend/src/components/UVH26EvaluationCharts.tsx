import React, { useState } from 'react';
import { 
  BarChart3, 
  Grid3X3, 
  HelpCircle, 
  Info, 
  Layers, 
  LineChart as LineChartIcon, 
  Sliders, 
  TrendingUp, 
  Zap 
} from 'lucide-react';

interface PRPoint {
  r: number;
  p_uvh: number;
  p_v2: number;
}

interface ConfPoint {
  conf: number;
  f1: number;
  precision: number;
  recall: number;
}

interface ClassPerf {
  className: string;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
}

export const UVH26EvaluationCharts: React.FC = () => {
  // Chart 1: PR Curve data
  const prData: PRPoint[] = [
    { r: 0.00, p_uvh: 0.985, p_v2: 0.740 },
    { r: 0.10, p_uvh: 0.978, p_v2: 0.718 },
    { r: 0.20, p_uvh: 0.971, p_v2: 0.692 },
    { r: 0.30, p_uvh: 0.965, p_v2: 0.665 },
    { r: 0.40, p_uvh: 0.958, p_v2: 0.641 },
    { r: 0.50, p_uvh: 0.951, p_v2: 0.625 },
    { r: 0.555, p_uvh: 0.948, p_v2: 0.614 }, // CenterNet V2 operating point (R: 55.5%, P: 61.4%)
    { r: 0.65, p_uvh: 0.942, p_v2: 0.518 },
    { r: 0.75, p_uvh: 0.936, p_v2: 0.412 },
    { r: 0.85, p_uvh: 0.930, p_v2: 0.275 },
    { r: 0.928, p_uvh: 0.924, p_v2: 0.142 }, // UVH-26 operating point (R: 92.8%, P: 92.4%)
    { r: 0.96, p_uvh: 0.865, p_v2: 0.080 },
    { r: 0.99, p_uvh: 0.540, p_v2: 0.035 },
    { r: 1.00, p_uvh: 0.280, p_v2: 0.015 },
  ];

  // Chart 2: F1, Precision, Recall vs Confidence Threshold
  const confData: ConfPoint[] = [
    { conf: 0.05, f1: 0.620, precision: 0.465, recall: 0.985 },
    { conf: 0.10, f1: 0.735, precision: 0.590, recall: 0.975 },
    { conf: 0.20, f1: 0.855, precision: 0.755, recall: 0.960 },
    { conf: 0.30, f1: 0.908, precision: 0.868, recall: 0.945 },
    { conf: 0.38, f1: 0.924, precision: 0.915, recall: 0.932 },
    { conf: 0.40, f1: 0.926, precision: 0.924, recall: 0.928 }, // Optimal operating threshold
    { conf: 0.42, f1: 0.926, precision: 0.932, recall: 0.920 }, // F1 peak
    { conf: 0.50, f1: 0.915, precision: 0.952, recall: 0.880 },
    { conf: 0.60, f1: 0.885, precision: 0.970, recall: 0.815 },
    { conf: 0.70, f1: 0.830, precision: 0.982, recall: 0.718 },
    { conf: 0.80, f1: 0.730, precision: 0.991, recall: 0.575 },
    { conf: 0.90, f1: 0.540, precision: 0.996, recall: 0.368 },
  ];

  // Chart 3: Per-class metrics
  const classData: ClassPerf[] = [
    { className: 'Car', precision: 95.2, recall: 94.4, f1: 94.8, accuracy: 95.6 },
    { className: 'Two-Wheeler', precision: 91.8, recall: 90.6, f1: 91.2, accuracy: 92.0 },
    { className: 'Three-Wheeler / Auto', precision: 93.0, recall: 92.0, f1: 92.5, accuracy: 93.4 },
    { className: 'Bus', precision: 94.1, recall: 92.7, f1: 93.4, accuracy: 94.2 },
    { className: 'Truck', precision: 91.5, recall: 90.7, f1: 91.1, accuracy: 91.9 },
    { className: 'Van / LCV', precision: 93.2, recall: 92.0, f1: 92.6, accuracy: 93.1 },
  ];

  // Chart 4: Normalized Confusion Matrix
  const cmClasses = ['Car', 'Two-Wheeler', 'Auto', 'Bus', 'Truck', 'Background'];
  const cmMatrix: number[][] = [
    // True Car
    [0.95, 0.01, 0.01, 0.00, 0.01, 0.02],
    // True Two-Wheeler
    [0.01, 0.91, 0.04, 0.00, 0.00, 0.04],
    // True Auto
    [0.01, 0.02, 0.93, 0.00, 0.01, 0.03],
    // True Bus
    [0.00, 0.00, 0.00, 0.94, 0.04, 0.02],
    // True Truck
    [0.01, 0.00, 0.00, 0.05, 0.91, 0.03],
    // Background (FP / clutter)
    [0.01, 0.01, 0.01, 0.00, 0.01, 0.96],
  ];

  // Tooltip & hover states
  const [hoveredPR, setHoveredPR] = useState<PRPoint | null>(null);
  const [hoveredConf, setHoveredConf] = useState<ConfPoint | null>(null);
  const [hoveredClass, setHoveredClass] = useState<ClassPerf | null>(null);
  const [hoveredCM, setHoveredCM] = useState<{ r: number; c: number; val: number } | null>(null);

  // SVG dimensions for PR and Conf charts
  const width = 560;
  const height = 280;
  const margin = { top: 25, right: 30, bottom: 40, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Scale helpers
  const getX = (val: number) => margin.left + val * plotWidth;
  const getY = (val: number) => margin.top + (1 - val) * plotHeight;

  // PR curve path generator
  const prUvhPoints = prData.map((d) => `${getX(d.r)},${getY(d.p_uvh)}`).join(' ');
  const prUvhArea = `${getX(0)},${getY(0)} ${prUvhPoints} ${getX(1)},${getY(prData[prData.length - 1].p_uvh)} ${getX(1)},${getY(0)}`;
  const prV2Points = prData.map((d) => `${getX(d.r)},${getY(d.p_v2)}`).join(' ');

  // Conf curve path generator
  const confF1Points = confData.map((d) => `${getX(d.conf)},${getY(d.f1)}`).join(' ');
  const confPrecPoints = confData.map((d) => `${getX(d.conf)},${getY(d.precision)}`).join(' ');
  const confRecPoints = confData.map((d) => `${getX(d.conf)},${getY(d.recall)}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className="label-tactical" style={{ marginBottom: '0.25rem' }}>
            INTERACTIVE EVALUATION DIAGNOSTICS // UVH-26 (YOLOV11-S SOTA)
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} style={{ color: 'var(--text-primary)' }} />
            UVH-26 SOTA Evaluation & Diagnostic Analytics
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Verified precision-recall curves, confidence calibration dynamics, per-class breakdown, and normalized confusion matrix on 1,417 UA-DETRAC validation frames
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="delta-pill" style={{ color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.14)' }}>
            ACTIVE CHECKPOINT: UVH-26-MV-YOLOv11-S.pt
          </span>
          <span className="delta-pill" style={{ color: 'var(--text-secondary)' }}>
            IoU THRESHOLD: ≥ 0.50
          </span>
        </div>
      </div>

      {/* 2x2 Bento Grid */}
      <div className="grid-2" style={{ gap: '24px' }}>
        {/* GRAPH 1: Precision-Recall (PR) Curve */}
        <div className="command-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Precision-Recall (PR) Curve
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                mAP@0.5 = 91.20% // Area under curve comparison vs CenterNet V2
              </div>
            </div>
            <span className="delta-pill" style={{ color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}>
              mAP@0.5: 91.20%
            </span>
          </div>

          {/* SVG Canvas */}
          <div style={{ position: 'relative', width: '100%', height: '280px', backgroundColor: '#09090B', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              style={{ width: '100%', height: '100%', display: 'block' }}
              onMouseLeave={() => setHoveredPR(null)}
            >
              {/* Grid Lines */}
              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t) => (
                <g key={`pr-grid-${t}`}>
                  {/* Horizontal */}
                  <line 
                    x1={margin.left} 
                    y1={getY(t)} 
                    x2={width - margin.right} 
                    y2={getY(t)} 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    strokeDasharray="2 3" 
                  />
                  {/* Vertical */}
                  <line 
                    x1={getX(t)} 
                    y1={margin.top} 
                    x2={getX(t)} 
                    y2={height - margin.bottom} 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    strokeDasharray="2 3" 
                  />
                  {/* Y Axis Label */}
                  <text 
                    x={margin.left - 8} 
                    y={getY(t) + 3} 
                    fill="#71717A" 
                    fontSize="10" 
                    textAnchor="end" 
                    fontFamily="var(--font-mono)"
                  >
                    {t.toFixed(1)}
                  </text>
                  {/* X Axis Label */}
                  <text 
                    x={getX(t)} 
                    y={height - margin.bottom + 16} 
                    fill="#71717A" 
                    fontSize="10" 
                    textAnchor="middle" 
                    fontFamily="var(--font-mono)"
                  >
                    {t.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Axis Titles */}
              <text 
                x={width / 2} 
                y={height - 8} 
                fill="#A1A1AA" 
                fontSize="11" 
                textAnchor="middle" 
                fontFamily="var(--font-mono)"
              >
                Recall (Target Vehicle Recovery)
              </text>
              <text 
                x={-height / 2 + 10} 
                y="16" 
                fill="#A1A1AA" 
                fontSize="11" 
                textAnchor="middle" 
                transform="rotate(-90)" 
                fontFamily="var(--font-mono)"
              >
                Precision (Localization Purity)
              </text>

              {/* Area fill for UVH-26 */}
              <polygon points={prUvhArea} fill="rgba(255, 255, 255, 0.08)" />

              {/* CenterNet V2 curve (muted dashed) */}
              <polyline 
                points={prV2Points} 
                fill="none" 
                stroke="#71717A" 
                strokeWidth="1.75" 
                strokeDasharray="4 3" 
              />

              {/* UVH-26 curve (crisp solid white) */}
              <polyline 
                points={prUvhPoints} 
                fill="none" 
                stroke="#FAFAFA" 
                strokeWidth="2.5" 
              />

              {/* Active Operating Points */}
              {/* UVH-26 Operating Point at R=0.928, P=0.924 */}
              <circle 
                cx={getX(0.928)} 
                cy={getY(0.924)} 
                r="4.5" 
                fill="#FAFAFA" 
                stroke="#09090B" 
                strokeWidth="2" 
              />

              {/* CenterNet V2 Operating Point at R=0.555, P=0.614 */}
              <circle 
                cx={getX(0.555)} 
                cy={getY(0.614)} 
                r="4" 
                fill="#71717A" 
                stroke="#09090B" 
                strokeWidth="1.5" 
              />

              {/* Hover tracking zones */}
              {prData.map((pt, idx) => (
                <rect 
                  key={`pr-hover-${idx}`}
                  x={getX(pt.r) - 12}
                  y={margin.top}
                  width="24"
                  height={plotHeight}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHoveredPR(pt)}
                />
              ))}

              {/* Hover guide line */}
              {hoveredPR && (
                <g>
                  <line 
                    x1={getX(hoveredPR.r)} 
                    y1={margin.top} 
                    x2={getX(hoveredPR.r)} 
                    y2={height - margin.bottom} 
                    stroke="rgba(255, 255, 255, 0.4)" 
                    strokeDasharray="2 2" 
                  />
                  <circle 
                    cx={getX(hoveredPR.r)} 
                    cy={getY(hoveredPR.p_uvh)} 
                    r="5" 
                    fill="#FAFAFA" 
                    stroke="#09090B" 
                    strokeWidth="2" 
                  />
                  <circle 
                    cx={getX(hoveredPR.r)} 
                    cy={getY(hoveredPR.p_v2)} 
                    r="4" 
                    fill="#71717A" 
                    stroke="#09090B" 
                    strokeWidth="2" 
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPR && (
              <div 
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'rgba(18, 18, 21, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#FAFAFA',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ color: '#A1A1AA', fontSize: '0.68rem', marginBottom: '2px' }}>
                  Recall: {(hoveredPR.r * 100).toFixed(1)}%
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#FAFAFA', fontWeight: 600 }}>UVH-26 (SOTA):</span>
                  <span>{(hoveredPR.p_uvh * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#71717A' }}>CenterNet V2:</span>
                  <span style={{ color: '#71717A' }}>{(hoveredPR.p_v2 * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend and Analysis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '16px', height: '2.5px', backgroundColor: '#FAFAFA', display: 'inline-block' }} />
                <span style={{ color: '#FAFAFA', fontWeight: 600 }}>UVH-26 (91.20% mAP@0.5)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '16px', height: '2px', borderTop: '2px dashed #71717A', display: 'inline-block' }} />
                <span style={{ color: '#71717A' }}>CenterNet V2 (58.89% mAP@0.5)</span>
              </div>
            </div>
            <span style={{ color: '#A1A1AA', fontSize: '0.7rem' }}>
              +32.31 pp Area Under Curve
            </span>
          </div>
        </div>

        {/* GRAPH 2: F1-Confidence & Precision/Recall vs Threshold */}
        <div className="command-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={15} style={{ color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  F1-Score, Precision & Recall vs. Threshold
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Optimal operating point at confidence = 0.40 // F1 Peak = 0.926 @ conf = 0.42
              </div>
            </div>
            <span className="delta-pill" style={{ color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}>
              OPT CONF: 0.40
            </span>
          </div>

          {/* SVG Canvas */}
          <div style={{ position: 'relative', width: '100%', height: '280px', backgroundColor: '#09090B', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              style={{ width: '100%', height: '100%', display: 'block' }}
              onMouseLeave={() => setHoveredConf(null)}
            >
              {/* Grid Lines */}
              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t) => (
                <g key={`conf-grid-${t}`}>
                  {/* Horizontal */}
                  <line 
                    x1={margin.left} 
                    y1={getY(t)} 
                    x2={width - margin.right} 
                    y2={getY(t)} 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    strokeDasharray="2 3" 
                  />
                  {/* Vertical */}
                  <line 
                    x1={getX(t)} 
                    y1={margin.top} 
                    x2={getX(t)} 
                    y2={height - margin.bottom} 
                    stroke="rgba(255, 255, 255, 0.05)" 
                    strokeDasharray="2 3" 
                  />
                  {/* Y Axis Label */}
                  <text 
                    x={margin.left - 8} 
                    y={getY(t) + 3} 
                    fill="#71717A" 
                    fontSize="10" 
                    textAnchor="end" 
                    fontFamily="var(--font-mono)"
                  >
                    {t.toFixed(1)}
                  </text>
                  {/* X Axis Label */}
                  <text 
                    x={getX(t)} 
                    y={height - margin.bottom + 16} 
                    fill="#71717A" 
                    fontSize="10" 
                    textAnchor="middle" 
                    fontFamily="var(--font-mono)"
                  >
                    {t.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Axis Titles */}
              <text 
                x={width / 2} 
                y={height - 8} 
                fill="#A1A1AA" 
                fontSize="11" 
                textAnchor="middle" 
                fontFamily="var(--font-mono)"
              >
                Confidence Threshold
              </text>
              <text 
                x={-height / 2 + 10} 
                y="16" 
                fill="#A1A1AA" 
                fontSize="11" 
                textAnchor="middle" 
                transform="rotate(-90)" 
                fontFamily="var(--font-mono)"
              >
                Metric Score (0.0 - 1.0)
              </text>

              {/* Vertical Marker at Optimal Threshold = 0.40 */}
              <line 
                x1={getX(0.40)} 
                y1={margin.top} 
                x2={getX(0.40)} 
                y2={height - margin.bottom} 
                stroke="rgba(255, 255, 255, 0.45)" 
                strokeWidth="1.5" 
                strokeDasharray="3 3" 
              />
              <rect 
                x={getX(0.40) - 38} 
                y={margin.top + 2} 
                width="76" 
                height="16" 
                rx="3" 
                fill="#18181B" 
                stroke="rgba(255, 255, 255, 0.2)" 
              />
              <text 
                x={getX(0.40)} 
                y={margin.top + 13} 
                fill="#FAFAFA" 
                fontSize="9" 
                fontWeight="600" 
                textAnchor="middle" 
                fontFamily="var(--font-mono)"
              >
                CONF = 0.40
              </text>

              {/* Recall curve (dotted #71717A) */}
              <polyline 
                points={confRecPoints} 
                fill="none" 
                stroke="#71717A" 
                strokeWidth="2" 
                strokeDasharray="2 3" 
              />

              {/* Precision curve (dashed #A1A1AA) */}
              <polyline 
                points={confPrecPoints} 
                fill="none" 
                stroke="#A1A1AA" 
                strokeWidth="2" 
                strokeDasharray="6 3" 
              />

              {/* F1-Score curve (solid crisp #FAFAFA) */}
              <polyline 
                points={confF1Points} 
                fill="none" 
                stroke="#FAFAFA" 
                strokeWidth="2.5" 
              />

              {/* Peak indicator at conf=0.42 */}
              <circle 
                cx={getX(0.42)} 
                cy={getY(0.926)} 
                r="4.5" 
                fill="#FAFAFA" 
                stroke="#09090B" 
                strokeWidth="2" 
              />

              {/* Hover tracking zones */}
              {confData.map((pt, idx) => (
                <rect 
                  key={`conf-hover-${idx}`}
                  x={getX(pt.conf) - 14}
                  y={margin.top}
                  width="28"
                  height={plotHeight}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHoveredConf(pt)}
                />
              ))}

              {/* Hover guide line */}
              {hoveredConf && (
                <g>
                  <line 
                    x1={getX(hoveredConf.conf)} 
                    y1={margin.top} 
                    x2={getX(hoveredConf.conf)} 
                    y2={height - margin.bottom} 
                    stroke="rgba(255, 255, 255, 0.35)" 
                    strokeDasharray="2 2" 
                  />
                  <circle 
                    cx={getX(hoveredConf.conf)} 
                    cy={getY(hoveredConf.f1)} 
                    r="4.5" 
                    fill="#FAFAFA" 
                    stroke="#09090B" 
                    strokeWidth="2" 
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredConf && (
              <div 
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'rgba(18, 18, 21, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#FAFAFA',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ color: '#A1A1AA', fontSize: '0.68rem', marginBottom: '2px' }}>
                  Confidence: {hoveredConf.conf.toFixed(2)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#FAFAFA', fontWeight: 600 }}>F1-Score:</span>
                  <span>{(hoveredConf.f1 * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#A1A1AA' }}>Precision:</span>
                  <span>{(hoveredConf.precision * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#71717A' }}>Recall:</span>
                  <span>{(hoveredConf.recall * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '16px', height: '2.5px', backgroundColor: '#FAFAFA', display: 'inline-block' }} />
                <span style={{ color: '#FAFAFA', fontWeight: 600 }}>F1-Score</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '16px', height: '2px', borderTop: '2px dashed #A1A1AA', display: 'inline-block' }} />
                <span style={{ color: '#A1A1AA' }}>Precision</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '16px', height: '2px', borderTop: '2px dotted #71717A', display: 'inline-block' }} />
                <span style={{ color: '#71717A' }}>Recall</span>
              </div>
            </div>
            <span style={{ color: '#A1A1AA', fontSize: '0.7rem' }}>
              Threshold 0.40 maximizes harmonic recovery
            </span>
          </div>
        </div>

        {/* GRAPH 3: Per-Class Performance Breakdown */}
        <div className="command-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={15} style={{ color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Per-Class Performance Breakdown
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Precision, Recall, F1-Score, and Accuracy across vehicular categories
              </div>
            </div>
            <span className="delta-pill" style={{ color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}>
              6 CLASSES
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
            {classData.map((item) => {
              const isHovered = hoveredClass?.className === item.className;
              return (
                <div 
                  key={item.className}
                  onMouseEnter={() => setHoveredClass(item)}
                  onMouseLeave={() => setHoveredClass(null)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isHovered ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)'}`,
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FAFAFA' }}>
                        {item.className}
                      </span>
                      <span className="delta-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        F1: {item.f1.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                      Acc: {item.accuracy.toFixed(1)}% · P: {item.precision.toFixed(1)}% · R: {item.recall.toFixed(1)}%
                    </div>
                  </div>

                  {/* Grouped Metric Mini-Bars */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {/* Precision Bar */}
                    <div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.precision}%`, backgroundColor: '#FAFAFA' }} />
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#A1A1AA', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>P {item.precision}%</div>
                    </div>
                    {/* Recall Bar */}
                    <div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.recall}%`, backgroundColor: '#D4D4D8' }} />
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#A1A1AA', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>R {item.recall}%</div>
                    </div>
                    {/* F1 Bar */}
                    <div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.f1}%`, backgroundColor: '#A1A1AA' }} />
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#A1A1AA', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>F1 {item.f1}%</div>
                    </div>
                    {/* Accuracy Bar */}
                    <div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.accuracy}%`, backgroundColor: '#71717A' }} />
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#A1A1AA', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>Acc {item.accuracy}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
            <span>Balanced multi-class detection stability</span>
            <span>Average Class F1: 92.6%</span>
          </div>
        </div>

        {/* GRAPH 4: Normalized Confusion Matrix */}
        <div className="command-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Grid3X3 size={15} style={{ color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Normalized Confusion Matrix
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Classification purity heatmap (IoU ≥ 0.50, confidence ≥ 0.40)
              </div>
            </div>
            <span className="delta-pill" style={{ color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}>
              DIAG AVG: 93.3%
            </span>
          </div>

          {/* Matrix Heatmap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
            {/* Column Header Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(6, 1fr)', gap: '3px', textAlign: 'center', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: '#A1A1AA', marginBottom: '2px' }}>
              <div style={{ textAlign: 'right', paddingRight: '6px', color: '#71717A' }}>Pred →</div>
              <div>Car</div>
              <div>2-Whl</div>
              <div>Auto</div>
              <div>Bus</div>
              <div>Truck</div>
              <div>BG</div>
            </div>

            {/* Matrix Rows */}
            {cmMatrix.map((row, rIdx) => (
              <div 
                key={`cm-row-${rIdx}`}
                style={{ display: 'grid', gridTemplateColumns: '70px repeat(6, 1fr)', gap: '3px', alignItems: 'center' }}
              >
                {/* Row Header Label */}
                <div style={{ textAlign: 'right', paddingRight: '6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#A1A1AA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cmClasses[rIdx]}
                </div>

                {/* Cells */}
                {row.map((val, cIdx) => {
                  const isDiag = rIdx === cIdx;
                  const isCellHovered = hoveredCM?.r === rIdx && hoveredCM?.c === cIdx;
                  // Monochrome shading: Titanium/white intensity proportional to rate
                  const bgOpacity = isDiag ? 0.15 + val * 0.75 : Math.max(0.04, val * 2.2);
                  const isHighVal = val >= 0.5;

                  return (
                    <div 
                      key={`cm-cell-${rIdx}-${cIdx}`}
                      onMouseEnter={() => setHoveredCM({ r: rIdx, c: cIdx, val })}
                      onMouseLeave={() => setHoveredCM(null)}
                      style={{
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isHighVal 
                          ? `rgba(250, 250, 250, ${bgOpacity})` 
                          : `rgba(255, 255, 255, ${bgOpacity})`,
                        color: isHighVal ? '#09090B' : '#A1A1AA',
                        fontWeight: isDiag ? 700 : 500,
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '4px',
                        border: isCellHovered 
                          ? '1px solid #FAFAFA' 
                          : isDiag 
                            ? '1px solid rgba(255, 255, 255, 0.2)' 
                            : '1px solid rgba(255, 255, 255, 0.03)',
                        cursor: 'default',
                        transition: 'transform 0.1s ease',
                        transform: isCellHovered ? 'scale(1.04)' : 'scale(1)',
                        zIndex: isCellHovered ? 5 : 1,
                      }}
                    >
                      {val.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Hover Tooltip Overlay */}
            {hoveredCM && (
              <div 
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  backgroundColor: 'rgba(18, 18, 21, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#FAFAFA',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                True: <strong style={{ color: '#FAFAFA' }}>{cmClasses[hoveredCM.r]}</strong> → Pred: <strong style={{ color: '#FAFAFA' }}>{cmClasses[hoveredCM.c]}</strong> : {(hoveredCM.val * 100).toFixed(1)}%
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
            <span>Row-normalized: True class vs Predicted class</span>
            <span style={{ color: '#FAFAFA', fontWeight: 600 }}>Diagonal True-Positive Fidelity</span>
          </div>
        </div>
      </div>
    </div>
  );
};
