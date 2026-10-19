import React, { useState } from 'react';
import { 
  CloudRain, 
  Database, 
  Download, 
  Eye, 
  FileText, 
  Film, 
  Filter, 
  ImageIcon, 
  Moon, 
  Search, 
  Sun, 
  Trash2, 
  X 
} from 'lucide-react';
import { DatasetInfo, RunRecord } from '../types';

interface DatasetRunsViewProps {
  datasetInfo: DatasetInfo | null;
  runs: RunRecord[];
  selectedRun: RunRecord | null;
  onSelectRun: (run: RunRecord | null) => void;
  onDeleteRun: (runId: string) => void;
}

export const DatasetRunsView: React.FC<DatasetRunsViewProps> = ({
  datasetInfo,
  runs,
  selectedRun,
  onSelectRun,
  onDeleteRun,
}) => {
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredRuns = runs.filter((r) => {
    if (mediaFilter !== 'all' && r.media_type !== mediaFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q) ||
        r.model_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">SAVED RUNS & BENCHMARK ARCHIVE // AUDIT TRAIL</div>
          <h1 className="section-title">
            <Database size={22} style={{ color: 'var(--burnt-orange)' }} />
            History & Dataset
          </h1>
          <p className="section-subtitle">
            Saved inference runs, downloadable prediction artifacts, and UA-DETRAC dataset specifications
          </p>
        </div>

        <span className="badge badge-charcoal" style={{ fontSize: '0.74rem' }}>
          {runs.length} PERSISTED RUNS
        </span>
      </div>

      {/* UA-DETRAC Dataset Intelligence Summary */}
      {datasetInfo && (
        <div className="command-card">
          <div className="command-card-header">
            <span className="card-title">
              UA-DETRAC Benchmark Specifications (Traffic Surveillance)
            </span>
            <span className="label-tactical">100 SEQUENCES // 24 INTERSECTIONS</span>
          </div>

          {/* Quick Metrics */}
          <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem' }}>TOTAL FRAMES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warm-ivory)', fontFamily: 'var(--font-display)' }}>
                {datasetInfo.total_frames.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Across 100 sequences</div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem' }}>MANUAL BOUNDING BOXES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warm-ivory)', fontFamily: 'var(--font-display)' }}>
                {(datasetInfo.total_annotated_boxes / 1000000).toFixed(2)}M
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>8,250 unique vehicles</div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem' }}>TARGET CLASSES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--burnt-orange)', fontFamily: 'var(--font-display)' }}>
                4 CLASSES
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>car, van, bus, others</div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem' }}>NATIVE RESOLUTION</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--muted-olive)', fontFamily: 'var(--font-display)' }}>
                960 × 540
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)' }}>Model input: 512×512</div>
            </div>
          </div>

          {/* Splits and Weather Grid */}
          <div className="grid-2">
            {/* Splits */}
            <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ marginBottom: '0.5rem', color: 'var(--burnt-orange)' }}>
                PARTITION SPLITS (TRAIN / VAL / TEST)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--warm-ivory)' }}>TRAINING SET (60 sequences)</span>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>
                      {datasetInfo.splits.train.frames.toLocaleString()} frames ({datasetInfo.splits.train.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--charcoal-800)' }}>
                    <div style={{ width: `${datasetInfo.splits.train.percentage}%`, height: '100%', backgroundColor: 'var(--burnt-orange)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--warm-ivory)' }}>VALIDATION SET (15 sequences)</span>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>
                      {datasetInfo.splits.val.frames.toLocaleString()} frames ({datasetInfo.splits.val.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--charcoal-800)' }}>
                    <div style={{ width: `${datasetInfo.splits.val.percentage}%`, height: '100%', backgroundColor: '#D9822B' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--warm-ivory)' }}>TEST SET (25 sequences)</span>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>
                      {datasetInfo.splits.test.frames.toLocaleString()} frames ({datasetInfo.splits.test.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--charcoal-800)' }}>
                    <div style={{ width: `${datasetInfo.splits.test.percentage}%`, height: '100%', backgroundColor: 'var(--muted-olive)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Weather Breakdown */}
            <div style={{ padding: '0.85rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)' }}>
              <div className="label-tactical" style={{ marginBottom: '0.5rem', color: 'var(--muted-olive)' }}>
                ENVIRONMENTAL TEST CONDITIONS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                {datasetInfo.weather_conditions.map((w, idx) => (
                  <div key={idx} style={{ padding: '0.45rem', backgroundColor: 'var(--charcoal-800)', border: '1px solid var(--border-light)' }}>
                    <div style={{ color: 'var(--warm-ivory)', fontWeight: 700 }}>
                      {w.condition} ({w.percentage}%)
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.15rem' }}>
                      {w.challenges}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Execution Audit Table */}
      <div className="command-card">
        <div className="command-card-header">
          <span className="card-title">
            <FileText size={15} style={{ color: 'var(--warm-ivory)' }} />
            Persistent Execution Audit History
          </span>

          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--warm-ivory-dim)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '26px', fontSize: '0.75rem', padding: '0.35rem 0.6rem 0.35rem 26px' }}
                placeholder="Search run ID or filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.2rem', backgroundColor: 'var(--charcoal-900)', padding: '0.15rem', border: '1px solid var(--border-medium)' }}>
              {(['all', 'image', 'video'] as const).map((m) => (
                <button
                  key={m}
                  className={`btn ${mediaFilter === m ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                  onClick={() => setMediaFilter(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredRuns.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            NO AUDIT RECORDS MATCH CURRENT FILTER.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="command-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Source Filename</th>
                  <th>Detections</th>
                  <th>Unique Tracked</th>
                  <th>Tripwire Crossings</th>
                  <th>Latency</th>
                  <th>Model State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id}>
                    <td style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{run.id}</td>
                    <td>{new Date(run.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <span className={`badge ${run.media_type === 'video' ? 'badge-orange' : 'badge-olive'}`}>
                        {run.media_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.filename}
                    </td>
                    <td>{run.total_detections}</td>
                    <td>{run.unique_vehicles}</td>
                    <td style={{ color: run.line_crossings > 0 ? 'var(--status-green)' : 'var(--warm-ivory-dim)' }}>
                      {run.line_crossings}
                    </td>
                    <td>{run.latency_ms} ms</td>
                    <td>
                      <span className="badge badge-charcoal" style={{ fontSize: '0.65rem' }}>
                        {run.weights_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.68rem' }}
                          onClick={() => onSelectRun(run)}
                          title="Inspect run outputs"
                        >
                          <Eye size={11} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.68rem', color: 'var(--status-red)' }}
                          onClick={() => onDeleteRun(run.id)}
                          title="Delete record"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Run Inspector Modal / Drawer */}
      {selectedRun && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(20, 21, 19, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div 
            className="command-card"
            style={{
              maxWidth: '960px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--burnt-orange)',
            }}
          >
            <div className="command-card-header">
              <span className="card-title">
                Run Inspector // {selectedRun.id}
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => onSelectRun(null)}
              >
                <X size={13} />
              </button>
            </div>

            {/* Media Comparison Preview */}
            <div className="grid-2" style={{ marginBottom: '1rem' }}>
              <div>
                <div className="label-tactical" style={{ marginBottom: '0.3rem' }}>SOURCE INPUT</div>
                <div style={{ height: '260px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedRun.media_type === 'video' ? (
                    <video controls src={selectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Source" src={selectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>

              <div>
                <div className="label-tactical" style={{ marginBottom: '0.3rem', color: 'var(--burnt-orange)' }}>ANNOTATED OUTPUT</div>
                <div style={{ height: '260px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedRun.media_type === 'video' ? (
                    <video controls src={selectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Annotated" src={selectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Run Telemetry Summary */}
            <div className="grid-4" style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>TOTAL DETECTIONS: </span>
                <span style={{ color: 'var(--warm-ivory)', fontWeight: 700 }}>{selectedRun.total_detections}</span>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>UNIQUE VEHICLES: </span>
                <span style={{ color: 'var(--burnt-orange)', fontWeight: 700 }}>{selectedRun.unique_vehicles}</span>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>TRIPWIRE CROSSINGS: </span>
                <span style={{ color: 'var(--status-green)', fontWeight: 700 }}>{selectedRun.line_crossings}</span>
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>LATENCY: </span>
                <span style={{ color: 'var(--warm-ivory)', fontWeight: 700 }}>{selectedRun.latency_ms} ms</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={selectedRun.annotated_url}
                  download
                  className="btn btn-primary"
                  style={{ fontSize: '0.74rem' }}
                >
                  <Download size={12} />
                  Download Annotated File
                </a>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.74rem' }}
                onClick={() => onSelectRun(null)}
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
