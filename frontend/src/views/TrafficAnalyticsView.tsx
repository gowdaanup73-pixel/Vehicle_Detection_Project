import React from 'react';
import { 
  Activity, 
  ArrowDownRight, 
  ArrowUpRight, 
  BarChart3, 
  Compass, 
  Download, 
  Info, 
  Layers, 
  ShieldAlert, 
  TrendingUp, 
  Truck 
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
  const classCounts = summary?.class_distribution || { car: 0, van: 0, bus: 0, others: 0 };
  const totalVehicles = Math.max(1, classCounts.car + classCounts.van + classCounts.bus + classCounts.others);

  const timeline = latestVideoRun?.timeline || [];
  const lineCrossings = latestVideoRun?.line_crossings || summary?.total_line_crossings || 0;
  const uniqueVehicles = latestVideoRun?.unique_vehicles || summary?.total_unique_vehicles || 0;
  const rawDetections = latestVideoRun?.total_detections || summary?.total_detections || 0;

  // Export analytics CSV
  const exportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,Class,Count,Percentage\n';
    Object.entries(classCounts).forEach(([cls, count]) => {
      const pct = ((count / totalVehicles) * 100).toFixed(1);
      csvContent += `${new Date().toISOString()},${cls},${count},${pct}%\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `traffic_analytics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">SPATIAL FLOW INTELLIGENCE // MULTI-OBJECT TRAJECTORIES</div>
          <h1 className="section-title">
            <Activity size={22} style={{ color: 'var(--burnt-orange)' }} />
            Traffic Flow & Tracking Analytics
          </h1>
          <p className="section-subtitle">
            Temporal trajectory tracking, tripwire counting metrics, and documented road density estimation
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={exportCsv}
        >
          <Download size={13} />
          Export CSV Report
        </button>
      </div>

      {/* KPI Cards: Critical distinction between raw detections and unique vehicles */}
      <div className="grid-4">
        <div className="kpi-block" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div className="kpi-title">RAW FRAME DETECTIONS</div>
          <div className="kpi-value">{rawDetections.toLocaleString()}</div>
          <div className="kpi-subtext">Instantaneous bounding box detections across all frames</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--burnt-orange)' }}>
          <div className="kpi-title">UNIQUE TRACKED VEHICLES</div>
          <div className="kpi-value">{uniqueVehicles.toLocaleString()}</div>
          <div className="kpi-subtext">Persistent IDs via Centroid + IoU tracking</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--status-green)' }}>
          <div className="kpi-title">VIRTUAL TRIPWIRE CROSSINGS</div>
          <div className="kpi-value">{lineCrossings}</div>
          <div className="kpi-subtext">Counted crossing Gate 01 reference line</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div className="kpi-title">DENSITY ESTIMATE INDEX</div>
          <div className="kpi-value">
            {latestVideoRun?.metadata?.line_crossings_detail ? 'MODERATE' : 'OPTIMAL'}
          </div>
          <div className="kpi-subtext">Documented spatial occupancy estimate</div>
        </div>
      </div>

      {/* Distinction Explanation Note */}
      <div 
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--charcoal-800)',
          borderLeft: '4px solid var(--muted-olive)',
          borderTop: '1px solid var(--border-medium)',
          borderRight: '1px solid var(--border-medium)',
          borderBottom: '1px solid var(--border-medium)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--warm-ivory)', marginBottom: '0.35rem' }}>
          <Info size={15} style={{ color: 'var(--muted-olive-light)' }} />
          METHODOLOGY NOTE: RAW DETECTIONS VS. UNIQUE TRACKED VEHICLES
        </div>
        <p style={{ color: 'var(--warm-ivory-dim)', lineHeight: 1.6 }}>
          In continuous video surveillance, counting raw detections per frame causes severe multi-counting (a car present in 60 frames would be counted 60 times). The platform employs a Euclidean & IoU multi-object tracking association that maintains state memory across frames, assigning persistent track IDs (e.g. <code>#001</code>, <code>#002</code>) to measure actual unique vehicles and line-crossing transit events.
        </p>
      </div>

      {/* Class Statistics and Line Crossings */}
      <div className="grid-2">
        {/* Class Breakdown Card */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Truck size={15} style={{ color: 'var(--burnt-orange)' }} />
              Vehicle Class Classification Breakdown
            </span>
            <span className="label-tactical">UA-DETRAC TAXONOMY</span>
          </div>

          <table className="command-table">
            <thead>
              <tr>
                <th>Vehicle Category</th>
                <th>Cumulative Count</th>
                <th>Traffic Proportion</th>
                <th>Visual Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Car (Sedan/SUV/Hatchback)', count: classCounts.car, color: 'var(--burnt-orange)' },
                { name: 'Van (MPV/Delivery/Transit)', count: classCounts.van, color: '#D9822B' },
                { name: 'Bus (Public Transit/Coach)', count: classCounts.bus, color: 'var(--muted-olive)' },
                { name: 'Others (Truck/Specialized)', count: classCounts.others, color: '#888982' },
              ].map((item, idx) => {
                const pct = Math.round((item.count / totalVehicles) * 100);
                return (
                  <tr key={idx}>
                    <td style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{item.name}</td>
                    <td>{item.count.toLocaleString()}</td>
                    <td>{pct}%</td>
                    <td>
                      <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--charcoal-900)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: item.color }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Traffic Density Estimation Methodology Card */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Compass size={15} style={{ color: 'var(--muted-olive)' }} />
              Roadway Density Estimation Model
            </span>
            <span className="badge badge-olive">DOCUMENTED ESTIMATE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            <div style={{ color: 'var(--warm-ivory-dim)', lineHeight: 1.6 }}>
              Traffic density is derived as a documented mathematical estimate rather than an invasive inductive ground measurement:
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--burnt-orange)', fontWeight: 700, marginBottom: '0.2rem' }}>
                OCCUPANCY RATIO FORMULA
              </div>
              <code style={{ color: 'var(--warm-ivory)', fontSize: '0.74rem' }}>
                Occupancy (%) = (Σ Area(Vehicle BBoxes) / Frame Area) × 100
              </code>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--status-green)', fontWeight: 700 }}>LIGHT (&lt; 4%)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Free-flow conditions, zero queuing</div>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--muted-olive-light)', fontWeight: 700 }}>MODERATE (4% - 12%)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Stable traffic progression</div>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--burnt-orange)', fontWeight: 700 }}>DENSE (12% - 22%)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Reduced vehicle headway</div>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--status-red)', fontWeight: 700 }}>CONGESTED (&gt; 22%)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Queue formation and bottlenecks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Temporal Flow Timeline (if video run exists) */}
      <div className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <BarChart3 size={15} style={{ color: 'var(--warm-ivory)' }} />
            Temporal Traffic Flow & Timeline Telemetry
          </span>
          <span className="label-tactical">
            {timeline.length > 0 ? `${timeline.length} TIMESTAMPS SAMPLED` : 'AGGREGATED STREAM'}
          </span>
        </div>

        {timeline.length > 0 ? (
          <div>
            {/* SVG Traffic Volume Graph */}
            <div style={{ height: '140px', width: '100%', marginBottom: '1.5rem', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 800 140" preserveAspectRatio="none">
                {/* Horizontal grid lines */}
                <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                <line x1="0" y1="70" x2="800" y2="70" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(233,226,212,0.15)" />

                {/* Plot line for active vehicle count */}
                {(() => {
                  const maxCount = Math.max(5, ...timeline.map((t) => t.active_detections));
                  const points = timeline.map((t, idx) => {
                    const x = (idx / Math.max(1, timeline.length - 1)) * 800;
                    const y = 120 - (t.active_detections / maxCount) * 100;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="var(--burnt-orange)"
                        strokeWidth="2"
                        points={points}
                      />
                      {timeline.map((t, idx) => {
                        const x = (idx / Math.max(1, timeline.length - 1)) * 800;
                        const y = 120 - (t.active_detections / maxCount) * 100;
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="3"
                            fill="var(--burnt-orange)"
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                <span>T = 0.0s (Entry)</span>
                <span style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>Active Instantaneous Vehicle Count Trend</span>
                <span>T = {timeline[timeline.length - 1]?.timestamp_sec || 0}s (Elapsed)</span>
              </div>
            </div>

            {/* Frame Telemetry Table */}
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              <table className="command-table">
                <thead>
                  <tr>
                    <th>Frame #</th>
                    <th>Elapsed Time</th>
                    <th>Active Vehicles</th>
                    <th>Unique Cumulative</th>
                    <th>Tripwire Crossings</th>
                    <th>Estimated Occupancy</th>
                    <th>Density Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.slice(0, 30).map((t, idx) => (
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
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            NO VIDEO TIMELINE RECORDED YET. Run a video analysis in the Detection Studio to generate frame-by-frame trajectory telemetry.
          </div>
        )}
      </div>
    </div>
  );
};
