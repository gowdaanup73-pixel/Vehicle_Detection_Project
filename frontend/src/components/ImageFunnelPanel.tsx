import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  CheckSquare,
  Square,
  Play,
  AlertCircle,
  ExternalLink,
  Loader2,
  CheckCircle,
  Info,
} from 'lucide-react';
import { FunnelImage, FunnelBatchItemResult, RunRecord } from '../types';
import { searchFunnelImages, detectFunnelBatch } from '../api';

interface ImageFunnelPanelProps {
  confThresh?: number;
  detector?: string;
  onRunCompleted?: (run: RunRecord) => void;
  onInspectResult?: (result: FunnelBatchItemResult) => void;
}

const PRESETS = [
  'traffic bus street',
  'highway cars trucks',
  'night traffic road',
  'rainy traffic',
];

export const ImageFunnelPanel: React.FC<ImageFunnelPanelProps> = ({
  confThresh = 0.35,
  detector = 'centernet',
  onRunCompleted,
  onInspectResult,
}) => {
  const [query, setQuery] = useState('traffic bus street');
  const [source, setSource] = useState<'both' | 'commons' | 'openverse'>('both');
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [images, setImages] = useState<FunnelImage[]>([]);
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch detection state
  const [isBatchDetecting, setIsBatchDetecting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResults, setBatchResults] = useState<FunnelBatchItemResult[] | null>(null);
  const [batchSummary, setBatchSummary] = useState<{ total: number; successful: number; failed: number } | null>(null);

  const performSearch = async (targetQuery: string, targetSource = source) => {
    setIsLoading(true);
    setSearchError(null);
    setSelectedIds(new Set());
    setBatchResults(null);
    setBatchSummary(null);

    try {
      const data = await searchFunnelImages(targetQuery, targetSource, 1, 20);
      const retrieved = data.results && data.results.length > 0 ? data.results : (data.images || []);
      setImages(retrieved);
      setProviderErrors(data.errors || {});

      if (data.error) {
        if (retrieved.length === 0) {
          setSearchError(data.error);
        } else {
          setSearchError(null);
        }
      } else if (retrieved.length === 0) {
        setSearchError(null);
      }
    } catch (err: any) {
      const msg = err.message || 'Unable to connect to search service';
      setSearchError(
        msg.includes('404') || msg.toLowerCase().includes('not found')
          ? 'Search service endpoint not found (404). Please ensure backend daemon is running.'
          : msg
      );
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    performSearch('traffic bus street', 'both');
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 20) {
          alert('Maximum batch size is 20 images.');
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      const idsToSelect = images.slice(0, 20).map((img) => img.id);
      setSelectedIds(new Set(idsToSelect));
    }
  };

  const handleRunBatch = async () => {
    const selectedImages = images.filter((img) => selectedIds.has(img.id));
    if (selectedImages.length === 0) return;

    setIsBatchDetecting(true);
    setBatchProgress({ current: 0, total: selectedImages.length });
    setBatchResults(null);
    setBatchSummary(null);

    const items = selectedImages.map((img) => ({
      image_url: img.image_url,
      title: img.title,
      creator: img.creator || undefined,
      license: img.license,
      source_page_url: img.source_page_url,
    }));

    try {
      setBatchProgress({ current: Math.ceil(selectedImages.length / 2), total: selectedImages.length });
      const resp = await detectFunnelBatch(items, confThresh, detector);
      setBatchProgress({ current: selectedImages.length, total: selectedImages.length });
      setBatchResults(resp.results);
      setBatchSummary({
        total: resp.total,
        successful: resp.successful,
        failed: resp.failed,
      });

      // Propagate successful runs to parent
      resp.results.forEach((r) => {
        if (r.status === 'success' && r.saved_run) {
          onRunCompleted?.(r.saved_run);
        }
      });

      // If at least one succeeded, automatically inspect the first one
      const firstSuccess = resp.results.find((r) => r.status === 'success');
      if (firstSuccess) {
        onInspectResult?.(firstSuccess);
      }
    } catch (err: any) {
      alert(`Batch detection error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBatchDetecting(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="command-card" style={{ marginBottom: '1.25rem' }}>
      <div className="command-card-header">
        <span className="card-title">
          <Globe size={15} style={{ color: 'var(--burnt-orange)' }} />
          Find Images Online // Image Funnel
        </span>
        <span className="label-tactical">
          OPEN-LICENSED DATASET FUNNEL
        </span>
      </div>

      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Search controls row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--warm-ivory-dim)',
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') performSearch(query, source);
              }}
              placeholder="Search images (e.g. traffic bus street)..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(233, 226, 212, 0.15)',
                borderRadius: '4px',
                color: 'var(--warm-ivory)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <select
            value={source}
            onChange={(e) => {
              const newSource = e.target.value as 'both' | 'commons' | 'openverse';
              setSource(newSource);
              performSearch(query, newSource);
            }}
            style={{
              padding: '0.45rem 0.65rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(233, 226, 212, 0.15)',
              borderRadius: '4px',
              color: 'var(--warm-ivory)',
              fontSize: '0.82rem',
            }}
          >
            <option value="both">Both Providers (Commons + Openverse)</option>
            <option value="commons">Wikimedia Commons</option>
            <option value="openverse">Openverse (Commercial)</option>
          </select>

          <button
            onClick={() => performSearch(query, source)}
            disabled={isLoading || isBatchDetecting}
            className="btn btn-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
          >
            {isLoading ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
            Search
          </button>
        </div>

        {/* Preset chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Presets:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                performSearch(p, source);
              }}
              disabled={isLoading || isBatchDetecting}
              className="btn btn-secondary"
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.72rem',
                borderColor: query === p ? 'var(--burnt-orange)' : undefined,
                color: query === p ? 'var(--burnt-orange)' : undefined,
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Provider warning note if any provider degraded */}
        {Object.entries(providerErrors).length > 0 && (
          <div
            style={{
              padding: '0.4rem 0.65rem',
              background: 'rgba(200, 107, 60, 0.1)',
              border: '1px solid rgba(200, 107, 60, 0.25)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              color: 'var(--warm-ivory)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Info size={13} style={{ color: 'var(--burnt-orange)', flexShrink: 0 }} />
            <span>
              Provider notice: {Object.entries(providerErrors).map(([prov, msg]) => `${prov} (${msg})`).join('; ')}
            </span>
          </div>
        )}

        {/* Batch action bar */}
        {images.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.4rem 0.65rem',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '4px',
              border: '1px solid rgba(233, 226, 212, 0.08)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleSelectAll}
                disabled={isBatchDetecting}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
              >
                {selectedIds.size === images.length ? <CheckSquare size={13} /> : <Square size={13} />}
                {selectedIds.size === images.length ? 'Deselect All' : 'Select All'}
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--warm-ivory)' }}>
                Selected: <strong style={{ color: 'var(--burnt-orange)' }}>{selectedIds.size}</strong> / {Math.min(images.length, 20)}
              </span>
            </div>

            <button
              onClick={handleRunBatch}
              disabled={selectedIds.size === 0 || isBatchDetecting}
              className="btn btn-primary"
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {isBatchDetecting ? (
                <>
                  <Loader2 size={13} className="spin" />
                  Detecting ({selectedIds.size})...
                </>
              ) : (
                <>
                  <Play size={13} />
                  Detect Selected ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress bar during batch detection */}
        {isBatchDetecting && batchProgress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--warm-ivory)' }}>
              <span>Running batch inference through {detector === 'pretrained' ? 'Pretrained Faster R-CNN (COCO)' : 'Improved CenterNet'}...</span>
              <span>{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'rgba(233, 226, 212, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--burnt-orange)',
                  width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Batch Results Summary Alert */}
        {batchSummary && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              background: batchSummary.failed === 0 ? 'rgba(74, 122, 89, 0.15)' : 'rgba(200, 107, 60, 0.15)',
              border: `1px solid ${batchSummary.failed === 0 ? 'var(--status-green)' : 'var(--burnt-orange)'}`,
              borderRadius: '4px',
              fontSize: '0.78rem',
              color: 'var(--warm-ivory)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {batchSummary.failed === 0 ? (
                <CheckCircle size={15} style={{ color: 'var(--status-green)' }} />
              ) : (
                <AlertCircle size={15} style={{ color: 'var(--burnt-orange)' }} />
              )}
              <span>
                Batch complete: <strong>{batchSummary.successful}</strong> successful
                {batchSummary.failed > 0 && <>, <strong>{batchSummary.failed}</strong> failed</>}.
              </span>
            </div>
            {batchResults && batchResults.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--warm-ivory-dim)' }}>
                Click any thumbnail result below to view annotated detections.
              </span>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontSize: '0.85rem' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem auto', color: 'var(--burnt-orange)' }} />
            <div>Searching open-licensed imagery across online repositories...</div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && searchError && images.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontSize: '0.82rem' }}>
            <AlertCircle size={22} style={{ color: 'var(--burnt-orange)', margin: '0 auto 0.5rem auto' }} />
            <div style={{ color: 'var(--warm-ivory)', marginBottom: '0.5rem', maxWidth: '480px', margin: '0 auto' }}>
              {searchError}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => performSearch(query, source)}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                Retry Search
              </button>
              {source !== 'commons' && (
                <button
                  onClick={() => {
                    setSource('commons');
                    performSearch(query, 'commons');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Switch to Wikimedia Commons
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !searchError && images.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--warm-ivory-dim)', fontSize: '0.85rem' }}>
            <div>No open-licensed images found matching "{query}".</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>Try selecting one of the suggested preset queries above.</div>
          </div>
        )}

        {/* Thumbnail Grid */}
        {!isLoading && images.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '0.65rem',
              maxHeight: '440px',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {images.map((img) => {
              const isSelected = selectedIds.has(img.id);
              const batchResult = batchResults?.find((r) => r.image_url === img.image_url);

              return (
                <div
                  key={img.id}
                  className="funnel-thumbnail-card"
                  onClick={() => handleToggleSelect(img.id)}
                  style={{
                    position: 'relative',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: `1px solid ${isSelected ? 'var(--burnt-orange)' : 'rgba(233, 226, 212, 0.12)'}`,
                    boxShadow: isSelected ? '0 0 0 1px var(--burnt-orange)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Image container */}
                  <div style={{ width: '100%', height: '110px', overflow: 'hidden', position: 'relative', background: '#111' }}>
                    <img
                      src={img.thumbnail_url}
                      alt={img.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      onError={(e) => {
                        // Fallback to original image_url if thumbnail fails
                        (e.target as HTMLImageElement).src = img.image_url;
                      }}
                    />

                    {/* Selection checkbox pill */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        color: isSelected ? 'var(--burnt-orange)' : 'var(--warm-ivory)',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.7rem',
                      }}
                    >
                      {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                    </div>

                    {/* Provider tag */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.75)',
                        color: 'var(--warm-ivory-dim)',
                        borderRadius: '3px',
                        padding: '1px 4px',
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      {img.provider}
                    </div>

                    {/* Batch outcome indicator if executed */}
                    {batchResult && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (batchResult.status === 'success') {
                            onInspectResult?.(batchResult);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          right: '4px',
                          background: batchResult.status === 'success' ? 'rgba(74, 122, 89, 0.9)' : 'rgba(200, 107, 60, 0.9)',
                          color: '#fff',
                          borderRadius: '3px',
                          padding: '2px 4px',
                          fontSize: '0.68rem',
                          textAlign: 'center',
                          fontWeight: 600,
                          cursor: batchResult.status === 'success' ? 'pointer' : 'default',
                        }}
                      >
                        {batchResult.status === 'success' ? (
                          <>Inspect ({batchResult.total_detections} dets) &rarr;</>
                        ) : (
                          <>Failed: {batchResult.error || 'Error'}</>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card metadata & hover attribution */}
                  <div style={{ padding: '0.45rem', fontSize: '0.7rem' }}>
                    <div
                      title={img.title}
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--warm-ivory)',
                        fontWeight: 600,
                        marginBottom: '0.2rem',
                      }}
                    >
                      {img.title || 'Untitled'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--warm-ivory-dim)', fontSize: '0.65rem' }}>
                      <span title={`License: ${img.license}`} style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.license}
                      </span>
                      <a
                        href={img.source_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open source page"
                        style={{ color: 'var(--burnt-orange)', display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    {img.creator && (
                      <div
                        title={`Creator: ${img.creator}`}
                        style={{
                          color: 'var(--warm-ivory-dim)',
                          fontSize: '0.62rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '0.15rem',
                        }}
                      >
                        by {img.creator}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
