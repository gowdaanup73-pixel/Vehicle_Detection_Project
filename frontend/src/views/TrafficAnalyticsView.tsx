import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  BarChart3, 
  Calendar, 
  Compass, 
  Download, 
  Filter, 
  Info, 
  Layers, 
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
  const [selectedRunId, setSelectedRunId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Filtered Run Context
  const activeRun = useMemo(() => {
    if (selectedRunId === 'all') {
      return latestVideoRun || allRuns[0] || null;
    }
    return allRuns.find((r) => r.id === selectedRunId) || null;
  }, [selectedRunId, latestVideoRun, allRuns]);

  // Class Counts
  const classCounts = useMemo(() => {
    if (activeRun && selectedRunId !== 'all') {
      return activeRun.class_counts;
    }
    return summary?.class_distribution || { car: 0, van: 0, bus: 0, others: 0 };
  }, [activeRun, selectedRunId, summary]);

  const totalVehicles = Math.max(1, (classCounts.car || 0) + (classCounts.van || 0) + (classCounts.bus || 0) + (classCounts.others || 0));

  // Timeline
  const rawTimeline = activeRun?.timeline || [];
  const timeline = useMemo(() => {
    if (selectedClass === 'all') return rawTimeline;
    return rawTimeline.map((t) => ({
      ...t,
      active_detections: t.class_breakdown?.[selectedClass] || 0,
    }));
  }, [rawTimeline, selectedClass]);

  const uniqueVehicles = activeRun?.unique_vehicles || summary?.total_unique_vehicles || 0;
  const rawDetections = activeRun?.total_detections || summary?.total_detections || 0;
  const lineCrossings = activeRun?.line_crossings || summary?.total_line_crossings || 0;

  // Export CSV
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
    link.setAttribute('download', `traffic_analytics_${selectedRunId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">SPATIAL FLOW & TRAJECTORY TELEMETRY</div>
          <h1 className="section-title">
            <Activity size={22} style={{ color: 'var(--burnt-orange)' }} />
            Traffic Analytics
          </h1>
          <p className="section-subtitle">
            Vehicle class distribution, temporal volume curves, and genuine multi-object trajectory tracking
          </p>
        </div>

        {/* Global Action */}
        <button className="btn btn-secondary" onClick={exportCsv}>
          <Download size={13} />
          Export CSV Report
        </button>
      </div>

      {/* Filter Bar */}
      <div className="command-card" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--warm-ivory)' }}>
            <Filter size={14} style={{ color: 'var(--burnt-orange)' }} />
            <span style={{ fontWeight: 700 }}>FILTERS:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            {/* Run Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="label-tactical">INSPECTION RUN:</span>
              <select 
                className="form-select"
                style={{ width: 'auto', minWidth: '180px', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
              >
                <option value="all">All Combined Records</option>
                {allRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({r.media_type.toUpperCase()} - {r.filename})
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Class Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="label-tactical">CLASS:</span>
              <select 
                className="form-select"
                style={{ width: 'auto', minWidth: '130px', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
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
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        <div className="kpi-block" style={{ borderLeftColor: 'var(--warm-ivory)' }}>
          <div className="kpi-title">Instantaneous Detections</div>
          <div className="kpi-value">{rawDetections.toLocaleString()}</div>
          <div className="kpi-subtext">Sum of bounding box frames</div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--burnt-orange)' }}>
          <div className="kpi-title">Unique Tracked Vehicles</div>
          <div className="kpi-value">
            {activeRun && activeRun.media_type === 'image' ? (
              <span style={{ fontSize: '1.1rem', color: 'var(--warm-ivory-dim)' }}>N/A (Image)</span>
            ) : uniqueVehicles > 0 ? (
              uniqueVehicles.toLocaleString()
            ) : (
              '0'
            )}
          </div>
          <div className="kpi-subtext">
            {activeRun?.media_type === 'image' ? 'Multi-frame tracking requires video' : 'Centroid trajectory de-duplication'}
          </div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--status-green)' }}>
          <div className="kpi-title">Tripwire Crossings</div>
          <div className="kpi-value">
            {activeRun && activeRun.media_type === 'image' ? (
              <span style={{ fontSize: '1.1rem', color: 'var(--warm-ivory-dim)' }}>N/A (Image)</span>
            ) : (
              lineCrossings
            )}
          </div>
          <div className="kpi-subtext">
            {activeRun?.media_type === 'image' ? 'Counting gate requires video' : 'Counted crossing Gate 01'}
          </div>
        </div>

        <div className="kpi-block" style={{ borderLeftColor: 'var(--muted-olive)' }}>
          <div className="kpi-title">Documented Density</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem', paddingTop: '0.4rem' }}>
            {activeRun?.timeline?.length ? 'Spatial Estimate' : allRuns.length === 0 ? 'No Data' : 'Awaiting Video'}
          </div>
          <div className="kpi-subtext">Roadway occupancy ratio calculation</div>
        </div>
      </div>

      {/* Educational Callout: Raw vs Unique */}
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
          SURVEILLANCE METHODOLOGY: RAW DETECTIONS VS. UNIQUE VEHICLES
        </div>
        <p style={{ color: 'var(--warm-ivory-dim)', lineHeight: 1.6 }}>
          In road video analysis, counting raw detections per frame causes substantial multi-counting. The platform applies Euclidean centroid and IoU tracking to maintain trajectory persistence across frames.
        </p>
      </div>

      {/* Class Distribution & Density Model */}
      <div className="grid-2">
        {/* Class Distribution */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Truck size={15} style={{ color: 'var(--burnt-orange)' }} />
              Class Distribution // {selectedRunId === 'all' ? 'All Records' : selectedRunId}
            </span>
            <span className="label-tactical">4 CLASSES</span>
          </div>

          <table className="command-table">
            <thead>
              <tr>
                <th>Vehicle Class</th>
                <th>Count</th>
                <th>Proportion</th>
                <th>Visual Distribution</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Car (Sedan/SUV/Hatchback)', key: 'car', color: 'var(--burnt-orange)' },
                { name: 'Van (MPV/Delivery/Transit)', key: 'van', color: '#D9822B' },
                { name: 'Bus (Public Transit/Coach)', key: 'bus', color: 'var(--muted-olive)' },
                { name: 'Others (Truck/Specialized)', key: 'others', color: '#888982' },
              ].map((item) => {
                const count = (classCounts as any)[item.key] || 0;
                const pct = Math.round((count / totalVehicles) * 100);
                return (
                  <tr key={item.key}>
                    <td style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{item.name}</td>
                    <td>{count.toLocaleString()}</td>
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

        {/* Spatial Density Model */}
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              <Compass size={15} style={{ color: 'var(--muted-olive)' }} />
              Roadway Density Estimation Model
            </span>
            <span className="badge badge-olive">DOCUMENTED SPATIAL MODEL</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
            <div style={{ color: 'var(--warm-ivory-dim)', lineHeight: 1.5 }}>
              Road density is derived as a spatial bounding box area ratio across the video road corridor:
            </div>

            <div style={{ padding: '0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--burnt-orange)', fontWeight: 700, marginBottom: '0.2rem' }}>
                OCCUPANCY RATIO FORMULA
              </div>
              <code style={{ color: 'var(--warm-ivory)', fontSize: '0.72rem' }}>
                Occupancy % = (Σ Area(Vehicle BBoxes) / Frame Area) × 100
              </code>
            </div>

            <div className="grid-2" style={{ gap: '0.4rem' }}>
              <div style={{ padding: '0.45rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--status-green)', fontWeight: 700 }}>Light (&lt; 4%)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)' }}>Free flowing traffic</div>
              </div>
              <div style={{ padding: '0.45rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--muted-olive-light)', fontWeight: 700 }}>Moderate (4% - 12%)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)' }}>Regular vehicle flow</div>
              </div>
              <div style={{ padding: '0.45rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--burnt-orange)', fontWeight: 700 }}>Dense (12% - 22%)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)' }}>Close vehicle spacing</div>
              </div>
              <div style={{ padding: '0.45rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--status-red)', fontWeight: 700 }}>Congested (&gt; 22%)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)' }}>Significant queueing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Volume Timeline */}
      <div className="command-card">
        <div className="command-card-header">
          <div>
            <span className="card-title">
              <BarChart3 size={15} style={{ color: 'var(--warm-ivory)' }} />
              Traffic Volume Over Time
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              Time Period: {timeline.length > 0 
                ? `${activeRun?.filename || 'Current Stream'} (T = 0.0s to ${timeline[timeline.length - 1]?.timestamp_sec || 0}s, ${timeline.length} frames)`
                : 'No recorded video timeline'}
            </div>
          </div>

          <span className="label-tactical">
            {selectedClass === 'all' ? 'ALL CLASSES' : selectedClass.toUpperCase()}
          </span>
        </div>

        {timeline.length > 0 ? (
          <div>
            <div style={{ height: '140px', width: '100%', marginBottom: '1.25rem', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 800 140" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                <line x1="0" y1="70" x2="800" y2="70" stroke="rgba(233,226,212,0.08)" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(233,226,212,0.15)" />

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
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="command-table">
                <thead>
                  <tr>
                    <th>Frame #</th>
                    <th>Elapsed Time</th>
                    <th>Active Vehicles</th>
                    <th>Unique Cumulative</th>
                    <th>Tripwire Crossings</th>
                    <th>Estimated Occupancy</th>
                    <th>Density Level</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.slice(0, 25).map((t, idx) => (
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
            No video timeline records found for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
