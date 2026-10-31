import React, { useMemo, useState } from 'react';
import { 
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Database, 
  Download, 
  Eye, 
  FileText, 
  Film, 
  Filter, 
  ImageIcon, 
  Search, 
  Trash2, 
  X 
} from 'lucide-react';
import { DatasetInfo, RunRecord } from '../types';

interface DatasetRunsViewProps {
  datasetInfo?: DatasetInfo | null;
  runs: RunRecord[];
  selectedRun: RunRecord | null;
  onSelectRun: (run: RunRecord | null) => void;
  onDeleteRun: (runId: string) => void;
}

export const DatasetRunsView: React.FC<DatasetRunsViewProps> = ({
  runs,
  selectedRun,
  onSelectRun,
  onDeleteRun,
}) => {
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'detections' | 'latency'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Filtered & Sorted Runs
  const processedRuns = useMemo(() => {
    let result = runs.filter((r) => {
      if (mediaFilter !== 'all' && r.media_type !== mediaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.filename.toLowerCase().includes(q) ||
          (r.model_name && r.model_name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'timestamp') {
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortBy === 'detections') {
        comparison = a.total_detections - b.total_detections;
      } else if (sortBy === 'latency') {
        comparison = a.latency_ms - b.latency_ms;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [runs, mediaFilter, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedRuns.length / pageSize));
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRuns.slice(start, start + pageSize);
  }, [processedRuns, currentPage, pageSize]);

  const handleSortChange = (newSort: 'timestamp' | 'detections' | 'latency') => {
    if (sortBy === newSort) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(newSort);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">EXECUTION AUDIT TRAIL // PERSISTENT RECORDS</div>
          <h1 className="section-title">
            <FileText size={22} style={{ color: 'var(--burnt-orange)' }} />
            Execution History & Inspection
          </h1>
          <p className="section-subtitle">
            Auditable log of all genuine operational vehicle inference runs, detection bounding boxes, and media outputs
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge badge-charcoal" style={{ fontSize: '0.74rem' }}>
            {runs.length} TOTAL AUDIT RECORDS
          </span>
          <span className="badge badge-olive" style={{ fontSize: '0.74rem' }}>
            PERSISTENT SQLITE STORE
          </span>
        </div>
      </div>

      {/* Main Execution History Card */}
      <div className="command-card">
        <div className="command-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="card-title">
              Inference Records ({processedRuns.length} matching)
            </span>
          </div>

          {/* Search, Filter, & Sort Controls */}
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--warm-ivory-dim)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '26px', fontSize: '0.74rem', padding: '0.35rem 0.6rem 0.35rem 26px' }}
                placeholder="Search Run ID or filename..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Media Filter */}
            <div style={{ display: 'flex', gap: '0.2rem', backgroundColor: 'var(--charcoal-900)', padding: '0.15rem', border: '1px solid var(--border-medium)' }}>
              {(['all', 'image', 'video'] as const).map((m) => (
                <button
                  key={m}
                  className={`btn ${mediaFilter === m ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                  onClick={() => {
                    setMediaFilter(m);
                    setCurrentPage(1);
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                onClick={() => handleSortChange('timestamp')}
                title="Sort by Date"
              >
                Date {sortBy === 'timestamp' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                onClick={() => handleSortChange('detections')}
                title="Sort by Detections"
              >
                Detections {sortBy === 'detections' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                onClick={() => handleSortChange('latency')}
                title="Sort by Latency"
              >
                Latency {sortBy === 'latency' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
            </div>
          </div>
        </div>

        {runs.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            <Database size={32} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.75rem auto' }} />
            <div style={{ color: 'var(--warm-ivory)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              NO PERSISTED OPERATIONAL RUNS FOUND
            </div>
            <div style={{ fontSize: '0.74rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
              Perform inference in Detection Studio to generate persistent execution records in the SQLite database.
            </div>
          </div>
        ) : processedRuns.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
            NO AUDIT RECORDS MATCH THE CURRENT FILTER OR SEARCH QUERY.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="command-table">
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Timestamp</th>
                    <th>Media</th>
                    <th>Source Filename</th>
                    <th>Detections</th>
                    <th>Unique Tracked</th>
                    <th>Tripwire Crossings</th>
                    <th>Latency</th>
                    <th>Execution Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRuns.map((run) => (
                    <tr key={run.id}>
                      <td style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{run.id}</td>
                      <td style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.72rem' }}>
                        {new Date(run.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <span className={`badge ${run.media_type === 'video' ? 'badge-orange' : 'badge-olive'}`}>
                          {run.media_type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div>{run.filename}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--warm-ivory-dim)', marginTop: '1px' }}>
                          {run.model_name || 'Improved CenterNet'}
                        </div>
                        {(run.creator || run.license) && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--burnt-orange)', marginTop: '2px' }}>
                            {run.license || 'Open License'} {run.creator ? `// ${run.creator}` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--warm-ivory)' }}>
                        {run.total_detections}
                      </td>
                      <td style={{ color: run.unique_vehicles > 0 ? 'var(--burnt-orange)' : 'var(--warm-ivory-dim)' }}>
                        {run.unique_vehicles}
                      </td>
                      <td style={{ color: run.line_crossings > 0 ? 'var(--status-green)' : 'var(--warm-ivory-dim)' }}>
                        {run.line_crossings}
                      </td>
                      <td>{run.latency_ms} ms</td>
                      <td>
                        <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>
                          COMPLETED
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem' }}
                            onClick={() => onSelectRun(run)}
                            title="Inspect Run Details"
                          >
                            <Eye size={11} style={{ marginRight: '0.25rem' }} />
                            View
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.45rem', fontSize: '0.68rem', color: 'var(--status-red)' }}
                            onClick={() => onDeleteRun(run.id)}
                            title="Delete Record"
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>
                  Page {currentPage} of {totalPages} ({processedRuns.length} total runs)
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={12} /> Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Individual Run Inspector Modal */}
      {selectedRun && (
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
        >
          <div 
            className="command-card"
            style={{
              maxWidth: '980px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              border: '1px solid var(--burnt-orange)',
            }}
          >
            <div className="command-card-header">
              <span className="card-title">
                Run Inspector // {selectedRun.id} ({selectedRun.filename})
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
            <div className="grid-2" style={{ marginBottom: '1rem', padding: '0 0.85rem' }}>
              <div>
                <div className="label-tactical" style={{ marginBottom: '0.3rem' }}>ORIGINAL SOURCE INPUT</div>
                <div style={{ height: '280px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedRun.media_type === 'video' ? (
                    <video controls src={selectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Source" src={selectedRun.input_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>

              <div>
                <div className="label-tactical" style={{ marginBottom: '0.3rem', color: 'var(--burnt-orange)' }}>ANNOTATED OUTPUT (BOUNDING BOXES)</div>
                <div style={{ height: '280px', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedRun.media_type === 'video' ? (
                    <video controls src={selectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <img alt="Annotated" src={selectedRun.annotated_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Run Telemetry Summary */}
            <div className="kpi-row-4" style={{ marginBottom: '1rem', padding: '0 0.85rem' }}>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)' }}>
                <div className="label-tactical" style={{ fontSize: '0.62rem' }}>TOTAL DETECTIONS</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warm-ivory)' }}>{selectedRun.total_detections}</div>
              </div>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)' }}>
                <div className="label-tactical" style={{ fontSize: '0.62rem' }}>UNIQUE VEHICLES</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--burnt-orange)' }}>{selectedRun.unique_vehicles}</div>
              </div>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)' }}>
                <div className="label-tactical" style={{ fontSize: '0.62rem' }}>TRIPWIRE CROSSINGS</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-green)' }}>{selectedRun.line_crossings}</div>
              </div>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)' }}>
                <div className="label-tactical" style={{ fontSize: '0.62rem' }}>INFERENCE LATENCY</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warm-ivory)' }}>{selectedRun.latency_ms} ms</div>
              </div>
            </div>

            {/* Run Metadata Details */}
            <div style={{ padding: '0 0.85rem 1rem 0.85rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-900)', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                <div style={{ color: 'var(--muted-olive)', fontWeight: 700, marginBottom: '0.4rem' }}>
                  RECORD AUDIT METADATA
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', color: 'var(--warm-ivory-dim)' }}>
                  <div>Detector Model: <span style={{ color: 'var(--warm-ivory)' }}>{selectedRun.model_name || 'Improved CenterNet (ResNet-18 + CBAM + BiFPN)'}</span></div>
                  <div>Execution Timestamp: <span style={{ color: 'var(--warm-ivory)' }}>{new Date(selectedRun.timestamp).toISOString()}</span></div>
                  <div>Weights Status: <span style={{ color: 'var(--warm-ivory)' }}>{selectedRun.weights_status}</span></div>
                  <div>Media Type: <span style={{ color: 'var(--warm-ivory)' }}>{selectedRun.media_type}</span></div>
                </div>
                {(selectedRun.creator || selectedRun.license || selectedRun.source_page_url) && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(233, 226, 212, 0.1)' }}>
                    <div style={{ color: 'var(--burnt-orange)', fontWeight: 700, marginBottom: '0.3rem' }}>
                      IMAGE ATTRIBUTION (OPEN LICENSE)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', color: 'var(--warm-ivory-dim)' }}>
                      {selectedRun.creator && <div>Creator: <span style={{ color: 'var(--warm-ivory)' }}>{selectedRun.creator}</span></div>}
                      {selectedRun.license && <div>License: <span style={{ color: 'var(--warm-ivory)' }}>{selectedRun.license}</span></div>}
                      {selectedRun.source_page_url && (
                        <div style={{ gridColumn: 'span 2' }}>
                          Source Page:{' '}
                          <a
                            href={selectedRun.source_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--burnt-orange)', textDecoration: 'underline' }}
                          >
                            {selectedRun.source_page_url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', padding: '0.75rem 0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={selectedRun.annotated_url}
                  download
                  className="btn btn-primary"
                  style={{ fontSize: '0.74rem' }}
                >
                  <Download size={12} />
                  Download Annotated Media
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
