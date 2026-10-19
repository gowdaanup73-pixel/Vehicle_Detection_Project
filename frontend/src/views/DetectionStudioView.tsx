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
  ImageIcon, 
  Play, 
  RefreshCw, 
  RotateCcw, 
  Sliders, 
  Upload, 
  Zap 
} from 'lucide-react';
import { detectImage, detectSample, detectVideo } from '../api';
import { DetectionItem, ModelStatus, RunRecord } from '../types';

interface DetectionStudioViewProps {
  modelStatus: ModelStatus | null;
  onRunCompleted: (run: RunRecord) => void;
  preselectedFile?: File | null;
}

export const DetectionStudioView: React.FC<DetectionStudioViewProps> = ({
  modelStatus,
  onRunCompleted,
  preselectedFile = null,
}) => {
  const [activeMode, setActiveMode] = useState<'image' | 'video'>('image');
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

  // Sync with preselected file if passed from dashboard
  useEffect(() => {
    if (preselectedFile) {
      validateAndSetFile(preselectedFile, true);
    }
  }, [preselectedFile]);

  // File Selection & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file, true);
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
      validateAndSetFile(file, true);
    }
  };

  const validateAndSetFile = (file: File, autoRun: boolean = true) => {
    // 1. Immediately clear any previous result, preview, and error
    setProcessingError(null);
    setCurrentResult(null);
    setSelectedBoxIndex(null);

    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i);
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i);

    if (activeMode === 'image' && !isImage) {
      setProcessingError('Please select a valid image file (.jpg, .png, .webp).');
      return;
    }
    if (activeMode === 'video' && !isVideo) {
      setProcessingError('Please select a valid video file (.mp4, .avi, .webm).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setProcessingError('File size exceeds 100MB limit.');
      return;
    }

    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    // 2. Automatically trigger inference for the newly selected file
    if (autoRun) {
      executeInference(file);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCurrentResult(null);
    setProcessingError(null);
    setSelectedBoxIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Run Inference on Actual Uploaded File
  const executeInference = async (targetFile?: File) => {
    const fileToRun = targetFile || selectedFile;
    if (!fileToRun) {
      setProcessingError('Please select a media file before running detection.');
      return;
    }

    // Ensure previous detection state is cleared while fresh inference runs
    setIsProcessing(true);
    setProcessingError(null);
    setCurrentResult(null);

    try {
      let result;
      if (activeMode === 'image') {
        result = await detectImage(fileToRun, confThresh);
      } else {
        result = await detectVideo(fileToRun, confThresh, maxFrames, frameStride);
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCurrentResult(null);
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const result = await detectSample(type, confThresh);
      setCurrentResult(result);
      setPreviewUrl(result.input_url);
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
        </div>
      </div>

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
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload size={24} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--warm-ivory)' }}>
                {selectedFile ? selectedFile.name : `Select ${activeMode === 'image' ? 'Image File' : 'Video File'}`}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB (Auto-detecting...)` : 'Click or drop file to upload & run detection'}
              </div>
            </div>

            {/* Quick Test Demo */}
            <div style={{ marginTop: '0.85rem' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>
                DEMO PRE-CALIBRATED BENCHMARK
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.74rem' }}
                onClick={() => handleLoadSample(activeMode)}
                disabled={isProcessing}
              >
                <Play size={12} style={{ color: 'var(--burnt-orange)' }} />
                {isProcessing ? 'Processing Demo...' : `Load Demo ${activeMode === 'image' ? 'Highway Image' : 'Traffic Video'} (Sample)`}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="card-title">
                  {currentResult ? '3. Annotated Output Preview' : '2. Original Media Preview'}
                </span>

                {/* View Switcher if Result Exists */}
                {currentResult && (
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
                        DEMO SAMPLE (NOT IN AUDIT HISTORY)
                      </span>
                    ) : (
                      <span className="badge badge-olive" style={{ fontSize: '0.62rem' }}>
                        REAL UPLOAD // INFERENCE
                      </span>
                    )}
                  </div>
                )}
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
            <div className="canvas-viewport">
              {isProcessing ? (
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  <RefreshCw size={36} className="spin" style={{ color: 'var(--burnt-orange)', margin: '0 auto 1rem auto' }} />
                  <div style={{ color: 'var(--warm-ivory)', fontWeight: 700, fontSize: '1rem' }}>
                    PROCESSING VEHICLE DETECTIONS...
                  </div>
                  <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                    Passing frames through ResNet-18 + CBAM + BiFPN anchor-free heads
                  </div>
                </div>
              ) : currentResult ? (
                currentResult.media_type === 'video' ? (
                  <video
                    controls
                    autoPlay
                    loop
                    style={{ maxWidth: '100%', maxHeight: '460px', objectFit: 'contain' }}
                    src={viewMode === 'original' ? currentResult.input_url : currentResult.annotated_url}
                  />
                ) : (
                  <img
                    alt="Inspection result"
                    style={{ maxWidth: '100%', maxHeight: '460px', objectFit: 'contain' }}
                    src={viewMode === 'original' 
                      ? `${currentResult.input_url}?v=${currentResult.run_id}` 
                      : `${currentResult.annotated_url}?v=${currentResult.run_id}`}
                  />
                )
              ) : previewUrl ? (
                activeMode === 'video' ? (
                  <video controls src={previewUrl} style={{ maxWidth: '100%', maxHeight: '460px' }} />
                ) : (
                  <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '460px', objectFit: 'contain' }} />
                )
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
                  <Eye size={36} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontWeight: 600 }}>Inspection Canvas Standby</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Select an image or video file on the left to preview and run vehicle detection
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Telemetry Strip */}
            {currentResult && (
              <div className="canvas-telemetry-strip">
                <div>
                  <span className="strip-label">RUN ID:</span>
                  <span className="strip-val">{currentResult.run_id}</span>
                </div>
                <div>
                  <span className="strip-label">LATENCY:</span>
                  <span className="strip-val">{currentResult.latency_ms} ms</span>
                </div>
                <div>
                  <span className="strip-label">THROUGHPUT:</span>
                  <span className="strip-val" style={{ color: 'var(--burnt-orange)' }}>{currentResult.fps} FPS</span>
                </div>
                <div>
                  <span className="strip-label">MODE:</span>
                  <span className="strip-val">{currentResult.execution_mode || 'PYTORCH_CENTERNET'}</span>
                </div>
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
