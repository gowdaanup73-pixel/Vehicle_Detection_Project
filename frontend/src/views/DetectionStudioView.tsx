import React, { useEffect, useRef, useState } from 'react';
import { 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Download, 
  Eye, 
  FileJson, 
  Film, 
  Globe, 
  ImageIcon, 
  Play, 
  RefreshCw, 
  RotateCcw, 
  Sliders, 
  Upload, 
  Zap 
} from 'lucide-react';
import { detectImage, detectSample, detectVideo, fetchDetectors } from '../api';
import { DetectionItem, DetectorOption, FunnelBatchItemResult, ModelStatus, RunRecord } from '../types';
import { ImageFunnelPanel } from '../components/ImageFunnelPanel';

interface DetectionStudioViewProps {
  modelStatus: ModelStatus | null;
  onRunCompleted: (run: RunRecord) => void;
  preselectedFile?: File | null;
  initialBenchmark?: 'image' | 'video' | null;
  onBenchmarkConsumed?: () => void;
}

export const DetectionStudioView: React.FC<DetectionStudioViewProps> = ({
  modelStatus,
  onRunCompleted,
  preselectedFile = null,
  initialBenchmark = null,
  onBenchmarkConsumed,
}) => {
  const [activeMode, setActiveMode] = useState<'image' | 'video'>('image');
  const [showFunnel, setShowFunnel] = useState<boolean>(false);
  const [detectors, setDetectors] = useState<DetectorOption[]>([
    { id: 'centernet', name: 'Improved CenterNet (ResNet-18 + CBAM + BiFPN)', available: true, active: true },
    { id: 'pretrained', name: 'Pretrained Faster R-CNN (COCO)', available: true, active: false },
  ]);
  const [selectedDetector, setSelectedDetector] = useState<string>('centernet');

  useEffect(() => {
    fetchDetectors()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDetectors(data);
        }
      })
      .catch((err) => console.warn('Failed to load detectors:', err));
  }, []);

  const handleInspectFunnelResult = (itemResult: FunnelBatchItemResult) => {
    if (!itemResult) return;
    setCurrentResult({
      run_id: itemResult.run_id,
      input_url: itemResult.input_url,
      annotated_url: itemResult.annotated_url,
      total_detections: itemResult.total_detections || 0,
      unique_vehicles: itemResult.unique_vehicles || 0,
      class_counts: itemResult.class_counts || {},
      latency_ms: itemResult.latency_ms || 0,
      fps: itemResult.fps || 0,
      detections: itemResult.detections || [],
      creator: itemResult.creator,
      license: itemResult.license,
      source_page_url: itemResult.source_page_url,
      checkpoint: modelStatus?.checkpoint_name || 'improved_v2_best.pth',
      device_display: modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : 'CPU'),
      model_status: 'CONFIGURED_ACTIVE',
      model_name: itemResult.saved_run?.model_name || (selectedDetector === 'pretrained' ? 'Pretrained Faster R-CNN (COCO)' : 'Improved CenterNet (ResNet-18 + CBAM + BiFPN)'),
    });
    setViewMode('annotated');
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(preselectedFile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confThresh, setConfThresh] = useState<number>(0.35);
  const [maxFrames, setMaxFrames] = useState<number>(100);
  const [frameStride, setFrameStride] = useState<number>(1);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'annotated' | 'original'>('annotated');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safe object URL management with revocation
  const updatePreviewUrl = (newUrl: string | null) => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:') && prev !== newUrl) {
        try {
          URL.revokeObjectURL(prev);
        } catch (e) {
          console.warn('Revoke error:', e);
        }
      }
      return newUrl;
    });
  };

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (e) {
          console.warn('Unmount revoke error:', e);
        }
      }
    };
  }, [previewUrl]);

  // Sync with preselected file if passed from dashboard
  useEffect(() => {
    if (preselectedFile) {
      validateAndSetFile(preselectedFile, false);
    }
  }, [preselectedFile]);

  // Sync with initial reference benchmark if triggered from dashboard
  useEffect(() => {
    if (initialBenchmark) {
      handleLoadSample(initialBenchmark);
      onBenchmarkConsumed?.();
    }
  }, [initialBenchmark]);

  // File Selection & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file, false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file, false);
    }
  };

  const validateAndSetFile = (file: File, autoRun: boolean = false) => {
    // 1. Immediately clear any previous result, preview, and error
    setProcessingError(null);
    setCurrentResult(null);
    setSelectedBoxIndex(null);

    const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i));
    const isImage = file.type.startsWith('image/') || Boolean(file.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i));

    if (!isImage && !isVideo) {
      setProcessingError('Unsupported format. Please select an image (.jpg, .png, .webp) or video (.mp4, .avi, .webm).');
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setProcessingError('File size exceeds 150MB limit.');
      return;
    }

    // Auto-detect and switch mode if mismatched
    let targetMode = activeMode;
    if (isVideo && activeMode !== 'video') {
      targetMode = 'video';
      setActiveMode('video');
    } else if (isImage && activeMode !== 'image') {
      targetMode = 'image';
      setActiveMode('image');
    }

    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    updatePreviewUrl(objUrl);
    setViewMode('original');

    // Trigger inference only if explicitly requested
    if (autoRun) {
      executeInference(file, targetMode);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    updatePreviewUrl(null);
    setCurrentResult(null);
    setProcessingError(null);
    setSelectedBoxIndex(null);
    setViewMode('original');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Run Inference on Actual Uploaded File
  const executeInference = async (targetFile?: File, overrideMode?: 'image' | 'video') => {
    const fileToRun = targetFile || selectedFile;
    const modeToUse = overrideMode || activeMode;
    if (!fileToRun) {
      setProcessingError('Please select a media file before running detection.');
      return;
    }

    // Ensure previous detection state is cleared while fresh inference runs
    setIsProcessing(true);
    setProcessingError(null);
    setCurrentResult(null);
    setSelectedBoxIndex(null);

    try {
      let result;
      if (modeToUse === 'image') {
        result = await detectImage(fileToRun, confThresh, selectedDetector);
      } else {
        result = await detectVideo(fileToRun, confThresh, maxFrames, frameStride, selectedDetector);
      }
      setCurrentResult(result);
      setViewMode('annotated');
      if (result.saved_run) {
        onRunCompleted(result.saved_run);
      }
    } catch (err: any) {
      setProcessingError(err.message || 'Error occurred during vehicle detection.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Isolated Demo Benchmark Runner (explicitly isolated sample)
  const handleLoadSample = async (type: 'image' | 'video') => {
    setActiveMode(type);
    setSelectedFile(null);
    updatePreviewUrl(null);
    setCurrentResult(null);
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const result = await detectSample(type, confThresh, selectedDetector);
      setCurrentResult(result);
      updatePreviewUrl(result.input_url);
      setViewMode('annotated');
      if (result.saved_run) {
        onRunCompleted(result.saved_run);
      }
    } catch (err: any) {
      setProcessingError(err.message || 'Failed to process sample media.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadJsonReport = () => {
    if (!currentResult) return;
    const blob = new Blob([JSON.stringify(currentResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentResult.run_id || 'detection'}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detections: DetectionItem[] = currentResult?.detections || [];
  const classCounts = currentResult?.class_counts || {};

  const hasMedia = Boolean(previewUrl || currentResult);
  const displayMode = currentResult ? viewMode : 'original';
  const isMediaVideo = activeMode === 'video' || (currentResult?.media_type === 'video');
  const activeMediaUrl = displayMode === 'annotated' && currentResult?.annotated_url
    ? `${currentResult.annotated_url}?v=${currentResult.run_id}`
    : (previewUrl || currentResult?.input_url || null);

  return (
    <div className="studio-container">
      {/* View Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">INSPECTION WORKFLOW // STEP-BY-STEP VEHICLE DETECTION</div>
          <h1 className="section-title">
            <Zap size={22} style={{ color: 'var(--burnt-orange)' }} />
            Vehicle Detection Studio
          </h1>
          <p className="section-subtitle">
            Upload roadway images or video streams for anchor-free keypoint detection, classification and tracking
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="mode-toggle-group">
          <button
            className={`btn ${activeMode === 'image' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveMode('image');
              handleReset();
            }}
          >
            <ImageIcon size={14} />
            Image Detection
          </button>
          <button
            className={`btn ${activeMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveMode('video');
              handleReset();
            }}
          >
            <Film size={14} />
            Video Stream
          </button>
          <button
            className={`btn ${showFunnel ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFunnel((prev) => !prev)}
            title="Search open-licensed images online via Openverse and Wikimedia Commons"
          >
            <Globe size={14} />
            Find Images Online
          </button>
        </div>
      </div>

      {/* Online Image Funnel Panel */}
      {showFunnel && (
        <ImageFunnelPanel
          confThresh={confThresh}
          detector={selectedDetector}
          onRunCompleted={onRunCompleted}
          onInspectResult={handleInspectFunnelResult}
        />
      )}

      {/* Main Studio Grid */}
      <div className="grid-sidebar">
        {/* Left Column: Controls (Blocks 1 & 3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Block 1: Upload Media Card */}
          <div className="command-card">
            <div className="command-card-header">
              <span className="card-title">
                <Upload size={14} style={{ color: 'var(--burnt-orange)' }} />
                1. Upload {activeMode === 'image' ? 'Road Image' : 'Traffic Video'}
              </span>
              {selectedFile && (
                <button 
                  onClick={handleReset} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                  title="Clear file"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={activeMode === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/avi,video/webm'}
              onChange={handleFileChange}
            />

            <div 
              className={`dropzone ${isDragging ? 'drag-over' : ''}`}
              onClick={openFilePicker}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload size={24} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--warm-ivory)' }}>
                {selectedFile ? selectedFile.name : `Select ${activeMode === 'image' ? 'Image File' : 'Video File'}`}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB (Ready for detection)` : 'Click or drop file to preview & run detection'}
              </div>
            </div>

            {/* Standard Reference Benchmark */}
            <div style={{ marginTop: '0.85rem' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>
                STANDARD REFERENCE BENCHMARK
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.74rem' }}
                onClick={() => handleLoadSample(activeMode)}
                disabled={isProcessing}
              >
                <Play size={12} style={{ color: 'var(--burnt-orange)' }} />
                {isProcessing ? 'Running Benchmark...' : `Run Reference Benchmark (${activeMode === 'image' ? 'Highway Frame' : 'Traffic Stream'})`}
              </button>
            </div>
          </div>

          {/* Block 3: Detection Parameters & Run Trigger */}
          <div className="command-card">
            <div className="command-card-header">
              <span className="card-title">
                <Sliders size={14} style={{ color: 'var(--muted-olive)' }} />
                2. Parameters & Execution
              </span>
            </div>

            {/* Detector Selection Dropdown */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warm-ivory-dim)', fontWeight: 600 }}>
                DETECTION MODEL
              </label>
              <select
                className="input-select"
                value={selectedDetector}
                onChange={(e) => setSelectedDetector(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  backgroundColor: 'var(--charcoal-900)',
                  border: '1px solid var(--charcoal-600)',
                  color: 'var(--warm-ivory)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.76rem',
                  borderRadius: '2px',
                }}
              >
                {detectors.map((d) => (
                  <option key={d.id} value={d.id} disabled={!d.available}>
                    {d.name} {!d.available ? '(Unavailable)' : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                {selectedDetector === 'pretrained' ? 'Torchvision Faster R-CNN (ResNet-50 FPN) with COCO weights' : 'Custom CenterNet (ResNet-18 + CBAM + BiFPN) on UA-DETRAC'}
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>CONFIDENCE FILTER</span>
                <span style={{ color: 'var(--burnt-orange)', fontWeight: 700 }}>{confThresh.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={confThresh}
                onChange={(e) => setConfThresh(parseFloat(e.target.value))}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.2rem' }}>
                Keypoint center probability threshold
              </div>
            </div>

            {activeMode === 'video' && (
              <>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>FRAME LIMIT</span>
                    <span style={{ color: 'var(--warm-ivory)', fontWeight: 700 }}>{maxFrames} frames</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    value={maxFrames}
                    onChange={(e) => setMaxFrames(parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--warm-ivory-dim)' }}>FRAME STRIDE</span>
                    <span style={{ color: 'var(--warm-ivory)', fontWeight: 700 }}>{frameStride}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={frameStride}
                    onChange={(e) => setFrameStride(parseInt(e.target.value))}
                  />
                </div>
              </>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => executeInference()}
              disabled={isProcessing || (!selectedFile && !currentResult)}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Running Neural Detection...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Run Vehicle Detection
                </>
              )}
            </button>
          </div>

          {/* Error Feedback */}
          {processingError && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-800)', border: '1px solid var(--status-red)', color: 'var(--warm-ivory)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={16} style={{ color: 'var(--status-red)', flexShrink: 0 }} />
              <div>{processingError}</div>
            </div>
          )}
        </div>

        {/* Right Column: Previews, Annotations, Summary & Downloads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Blocks 2 & 4: Media Preview & Annotated Output */}
          <div className="command-card" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
            <div className="command-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="card-title">
                  {!hasMedia 
                    ? '2. Media Inspection Canvas' 
                    : displayMode === 'annotated' 
                      ? '3. Annotated Output Preview' 
                      : '2. Original Media Preview'}
                </span>

                {/* View Switcher if Result Exists */}
                {currentResult ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div className="segmented-toggle">
                      <button
                        className={`segment-btn ${viewMode === 'annotated' ? 'active' : ''}`}
                        onClick={() => setViewMode('annotated')}
                      >
                        Annotated
                      </button>
                      <button
                        className={`segment-btn ${viewMode === 'original' ? 'active' : ''}`}
                        onClick={() => setViewMode('original')}
                      >
                        Original
                      </button>
                    </div>
                    {currentResult.is_sample ? (
                      <span className="badge badge-orange" style={{ fontSize: '0.62rem' }}>
                        REFERENCE BENCHMARK // AUDIT ISOLATED
                      </span>
                    ) : (
                      <span className="badge badge-olive" style={{ fontSize: '0.62rem' }}>
                        OPERATIONAL INFERENCE // AUDIT LOGGED
                      </span>
                    )}
                  </div>
                ) : hasMedia ? (
                  <span className="badge badge-olive" style={{ fontSize: '0.62rem' }}>
                    ORIGINAL SOURCE READY
                  </span>
                ) : null}
              </div>

              {/* Block 6: Download Controls in Header */}
              {currentResult && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <a
                    href={currentResult.annotated_url}
                    download
                    className="btn btn-primary"
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Download size={12} />
                    Download Media
                  </a>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                    onClick={downloadJsonReport}
                  >
                    <FileJson size={12} />
                    Export JSON
                  </button>
                </div>
              )}
            </div>

            {/* Canvas Display */}
            <div className="canvas-viewport" style={{ position: 'relative', minHeight: '440px', backgroundColor: 'var(--charcoal-950)' }}>
              {/* Tactical Loading Overlay - Keeps the original media visible underneath */}
              {isProcessing && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    backgroundColor: hasMedia ? 'rgba(15, 17, 21, 0.76)' : 'var(--charcoal-950)',
                    backdropFilter: hasMedia ? 'blur(3px)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    padding: '1.5rem',
                  }}
                >
                  <RefreshCw size={36} className="spin" style={{ color: 'var(--burnt-orange)', margin: '0 auto 1rem auto' }} />
                  <div style={{ color: 'var(--warm-ivory)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em' }}>
                    PROCESSING VEHICLE DETECTIONS...
                  </div>
                  <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                    Passing frames through ResNet-18 + CBAM + BiFPN anchor-free heads
                  </div>
                </div>
              )}

              {/* Media Content Display */}
              {hasMedia && activeMediaUrl ? (
                isMediaVideo ? (
                  <video
                    key={activeMediaUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '460px', 
                      width: 'auto', 
                      height: 'auto', 
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto',
                    }}
                    src={activeMediaUrl}
                    onError={() => setProcessingError('Failed to load video preview. The video codec may not be supported by this browser.')}
                  />
                ) : (
                  <img
                    key={activeMediaUrl}
                    alt={displayMode === 'original' ? 'Original media preview' : 'Annotated detection result'}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '460px', 
                      width: 'auto', 
                      height: 'auto', 
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto',
                    }}
                    src={activeMediaUrl}
                    onError={() => setProcessingError('Failed to render image preview. The file format may be unsupported.')}
                  />
                )
              ) : !isProcessing ? (
                <div style={{ textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
                  <Eye size={36} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontWeight: 600 }}>Inspection Canvas Standby</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Select an image or video file on the left to preview and run vehicle detection
                  </div>
                </div>
              ) : null}
            </div>

            {/* Canvas Telemetry Strip */}
            {currentResult && (
              <div className="canvas-telemetry-strip">
                <div>
                  <span className="strip-label">RUN ID:</span>
                  <span className="strip-val">{currentResult.run_id}</span>
                </div>
                <div>
                  <span className="strip-label">MODEL:</span>
                  <span className="strip-val" style={{ color: 'var(--status-green)' }}>
                    {currentResult.model_name || (selectedDetector === 'pretrained' ? 'Pretrained Faster R-CNN (COCO)' : 'Improved CenterNet (ResNet-18 + CBAM + BiFPN)')}
                  </span>
                </div>
                <div>
                  <span className="strip-label">CHECKPOINT:</span>
                  <span className="strip-val" style={{ color: 'var(--warm-ivory-dim)' }}>
                    {currentResult.checkpoint || modelStatus?.checkpoint_name || 'improved_v2_best.pth'}
                  </span>
                </div>
                <div>
                  <span className="strip-label">DEVICE:</span>
                  <span className="strip-val">{currentResult.device_display || modelStatus?.device_display || (modelStatus?.is_cuda_available ? 'CUDA GPU' : 'CPU')}</span>
                </div>
                <div>
                  <span className="strip-label">LATENCY:</span>
                  <span className="strip-val">{currentResult.latency_ms} ms</span>
                </div>
                <div>
                  <span className="strip-label">SPEED:</span>
                  <span className="strip-val" style={{ color: 'var(--burnt-orange)' }}>{currentResult.fps} FPS</span>
                </div>
              </div>
            )}

            {/* Attribution Bar for Funnel Images */}
            {currentResult && (currentResult.creator || currentResult.license || currentResult.source_page_url) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.45rem 0.75rem',
                  background: 'rgba(200, 107, 60, 0.08)',
                  borderTop: '1px solid rgba(200, 107, 60, 0.2)',
                  fontSize: '0.72rem',
                  color: 'var(--warm-ivory)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>IMAGE ATTRIBUTION:</span>
                {currentResult.creator && <span>Creator: <strong>{currentResult.creator}</strong></span>}
                {currentResult.license && <span className="status-pill" style={{ fontSize: '0.65rem' }}>{currentResult.license}</span>}
                {currentResult.source_page_url && (
                  <a
                    href={currentResult.source_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--burnt-orange)', textDecoration: 'underline', marginLeft: 'auto' }}
                  >
                    View Source Page &rarr;
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Block 5: Vehicle Summary & Class Counts */}
          {currentResult && (
            <div className="command-card">
              <div className="command-card-header">
                <span className="card-title">
                  4. Vehicle Detections & Class Breakdown
                </span>
                <span className="label-tactical">
                  {currentResult.total_detections} TOTAL DETECTIONS // {currentResult.unique_vehicles} UNIQUE
                </span>
              </div>

              {/* Class Count Badges */}
              <div className="grid-4" style={{ marginBottom: '1rem' }}>
                <div className="class-count-chip" style={{ borderLeftColor: 'var(--burnt-orange)' }}>
                  <span className="chip-name">Car</span>
                  <span className="chip-count">{classCounts.car || 0}</span>
                </div>
                <div className="class-count-chip" style={{ borderLeftColor: '#D9822B' }}>
                  <span className="chip-name">Van</span>
                  <span className="chip-count">{classCounts.van || 0}</span>
                </div>
                <div className="class-count-chip" style={{ borderLeftColor: 'var(--muted-olive)' }}>
                  <span className="chip-name">Bus</span>
                  <span className="chip-count">{classCounts.bus || 0}</span>
                </div>
                <div className="class-count-chip" style={{ borderLeftColor: '#888982' }}>
                  <span className="chip-name">Others</span>
                  <span className="chip-count">{classCounts.others || 0}</span>
                </div>
              </div>

              {/* Bounding Box Coordinates Table */}
              {detections.length > 0 && (
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="command-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Class</th>
                        <th>Confidence</th>
                        <th>Coordinates [X1, Y1, X2, Y2]</th>
                        <th>Dimensions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detections.map((det, idx) => {
                        const bw = Math.round(det.bbox[2] - det.bbox[0]);
                        const bh = Math.round(det.bbox[3] - det.bbox[1]);
                        const isSelected = selectedBoxIndex === idx;

                        return (
                          <tr 
                            key={idx}
                            style={{ backgroundColor: isSelected ? 'var(--charcoal-700)' : 'transparent', cursor: 'pointer' }}
                            onClick={() => setSelectedBoxIndex(isSelected ? null : idx)}
                          >
                            <td style={{ color: 'var(--burnt-orange)' }}>#{idx + 1}</td>
                            <td>
                              <span className="badge badge-charcoal" style={{ textTransform: 'uppercase' }}>
                                {det.class_name}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{Math.round(det.score * 100)}%</td>
                            <td style={{ color: 'var(--warm-ivory-dim)' }}>
                              [{det.bbox[0]}, {det.bbox[1]}, {det.bbox[2]}, {det.bbox[3]}]
                            </td>
                            <td>{bw} × {bh} px</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
