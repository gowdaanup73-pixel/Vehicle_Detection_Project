import React, { useRef, useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Eye, 
  FileJson, 
  Film, 
  ImageIcon, 
  Play, 
  RefreshCw, 
  Sliders, 
  Upload, 
  Zap 
} from 'lucide-react';
import { detectImage, detectSample, detectVideo } from '../api';
import { DetectionItem, ModelStatus, RunRecord, TimelinePoint } from '../types';

interface DetectionStudioViewProps {
  modelStatus: ModelStatus | null;
  onRunCompleted: (run: RunRecord) => void;
}

export const DetectionStudioView: React.FC<DetectionStudioViewProps> = ({
  modelStatus,
  onRunCompleted,
}) => {
  const [activeMode, setActiveMode] = useState<'image' | 'video'>('image');
  const [confThresh, setConfThresh] = useState<number>(0.35);
  const [maxFrames, setMaxFrames] = useState<number>(100);
  const [frameStride, setFrameStride] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [viewTab, setViewTab] = useState<'annotated' | 'original' | 'split'>('annotated');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setProcessingError(null);
    }
  };

  const executeInference = async (fileToProcess?: File) => {
    const targetFile = fileToProcess || selectedFile;
    if (!targetFile) {
      setProcessingError('Please select or upload a media file first.');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    try {
      let result;
      if (activeMode === 'image') {
        result = await detectImage(targetFile, confThresh);
      } else {
        result = await detectVideo(targetFile, confThresh, maxFrames, frameStride);
      }
      setCurrentResult(result);
      if (result.saved_run) {
        onRunCompleted(result.saved_run);
      }
    } catch (err: any) {
      setProcessingError(err.message || 'Error processing media file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSample = async (type: 'image' | 'video') => {
    setActiveMode(type);
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const result = await detectSample(type, confThresh);
      setCurrentResult(result);
      if (result.saved_run) {
        onRunCompleted(result.saved_run);
      }
    } catch (err: any) {
      setProcessingError(err.message || 'Error executing sample demonstration.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadJsonTelemetry = () => {
    if (!currentResult) return;
    const blob = new Blob([JSON.stringify(currentResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentResult.run_id || 'centernet'}_telemetry.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detections: DetectionItem[] = currentResult?.detections || [];
  const classCounts = currentResult?.class_counts || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Header */}
      <div className="section-header">
        <div>
          <div className="label-tactical">INSPECTION WORKBENCH // HIGH-PRECISION INFERENCE</div>
          <h1 className="section-title">
            <Eye size={22} style={{ color: 'var(--burnt-orange)' }} />
            Vehicle Detection Studio
          </h1>
          <p className="section-subtitle">
            Upload roadway imagery or video stream for CenterNet detection, bounding box extraction, and trajectory tracking
          </p>
        </div>

        {/* Media Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--charcoal-800)', padding: '0.25rem', border: '1px solid var(--border-medium)' }}>
          <button
            className={`btn ${activeMode === 'image' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => {
              setActiveMode('image');
              setSelectedFile(null);
            }}
          >
            <ImageIcon size={13} />
            Image Studio
          </button>
          <button
            className={`btn ${activeMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
            onClick={() => {
              setActiveMode('video');
              setSelectedFile(null);
            }}
          >
            <Film size={13} />
            Video Studio
          </button>
        </div>
      </div>

      {/* Main Grid: Control Sidebar + Media Workbench */}
      <div className="grid-sidebar">
        {/* Left Control Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Upload Card */}
          <div className="command-card">
            <div className="command-card-header">
              <span className="card-title">
                <Upload size={14} style={{ color: 'var(--burnt-orange)' }} />
                Source Media Input
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={activeMode === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/avi,video/webm'}
              onChange={handleFileChange}
            />

            <div 
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--warm-ivory)' }}>
                {selectedFile ? selectedFile.name : `Select ${activeMode === 'image' ? 'Image (.jpg, .png)' : 'Video (.mp4, .avi)'}`}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem' }}>
                {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Click or drop file to load'}
              </div>
            </div>

            {/* Quick Demonstration Actions */}
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div className="label-tactical" style={{ fontSize: '0.65rem' }}>INSTANT BENCHMARK MEDIA</div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.72rem' }}
                onClick={() => handleLoadSample(activeMode)}
                disabled={isProcessing}
              >
                <Play size={11} style={{ color: 'var(--burnt-orange)' }} />
                {isProcessing ? 'Processing...' : `Load Test ${activeMode === 'image' ? 'Highway Image' : 'Traffic Stream'}`}
              </button>
            </div>
          </div>

          {/* Inference Hyperparameters */}
          <div className="command-card">
            <div className="command-card-header">
              <span className="card-title">
                <Sliders size={14} style={{ color: 'var(--muted-olive)' }} />
                Inference Parameters
              </span>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--warm-ivory-dim)' }}>CONFIDENCE THRESHOLD</span>
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
              <div style={{ fontSize: '0.68rem', color: 'var(--warm-ivory-dim)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                CenterNet peak heatmap threshold for class centers.
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
              disabled={isProcessing || !selectedFile}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={13} className="spin" />
                  Running Inference...
                </>
              ) : (
                <>
                  <Zap size={13} />
                  Execute Analysis
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {processingError && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-800)', border: '1px solid var(--status-red)', color: 'var(--warm-ivory)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={15} style={{ color: 'var(--status-red)', flexShrink: 0 }} />
              <div>{processingError}</div>
            </div>
          )}

          {/* Model Status Indicator in Studio */}
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--charcoal-800)', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <div style={{ color: 'var(--muted-olive)', fontWeight: 700, marginBottom: '0.25rem' }}>MODEL BACKBONE DISPATCH</div>
            <div style={{ color: 'var(--warm-ivory)' }}>Improved CenterNet (ResNet-18)</div>
            <div style={{ color: 'var(--warm-ivory-dim)', marginTop: '0.2rem' }}>
              Weights: {modelStatus?.weights_loaded ? 'Active Checkpoint' : 'Calibrated Benchmark Mode'}
            </div>
          </div>
        </div>

        {/* Right Workbench: Media Display & Detections List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Media Inspection Canvas Card */}
          <div className="command-card" style={{ minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
            <div className="command-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="card-title">
                  {currentResult?.media_type === 'video' ? <Film size={14} /> : <ImageIcon size={14} />}
                  Inspection Canvas // {currentResult ? currentResult.run_id : 'STANDBY'}
                </span>

                {/* View switcher */}
                {currentResult && (
                  <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--charcoal-900)', padding: '0.15rem', border: '1px solid var(--border-medium)' }}>
                    <button
                      className={`btn ${viewTab === 'annotated' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                      onClick={() => setViewTab('annotated')}
                    >
                      Annotated Result
                    </button>
                    <button
                      className={`btn ${viewTab === 'original' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                      onClick={() => setViewTab('original')}
                    >
                      Source Input
                    </button>
                  </div>
                )}
              </div>

              {/* Action Downloads */}
              {currentResult && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href={currentResult.annotated_url}
                    download
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Download size={12} />
                    Download Media
                  </a>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                    onClick={downloadJsonTelemetry}
                  >
                    <FileJson size={12} />
                    Export JSON
                  </button>
                </div>
              )}
            </div>

            {/* Canvas Body */}
            <div 
              style={{ 
                flex: 1, 
                backgroundColor: 'var(--charcoal-950)', 
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '400px',
              }}
            >
              {isProcessing ? (
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ color: 'var(--burnt-orange)', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                    ANALYZING ROADWAY MEDIA...
                  </div>
                  <div style={{ color: 'var(--warm-ivory-dim)', fontSize: '0.8rem' }}>
                    Forward pass through ResNet-18 + CBAM + BiFPN + CenterNet keypoint decoding
                  </div>
                </div>
              ) : currentResult ? (
                currentResult.media_type === 'video' ? (
                  <video
                    controls
                    autoPlay
                    loop
                    style={{ maxWidth: '100%', maxHeight: '520px', objectFit: 'contain' }}
                    src={viewTab === 'original' ? currentResult.input_url : currentResult.annotated_url}
                  />
                ) : (
                  <img
                    alt="Analyzed roadway"
                    style={{ maxWidth: '100%', maxHeight: '520px', objectFit: 'contain' }}
                    src={viewTab === 'original' ? currentResult.input_url : currentResult.annotated_url}
                  />
                )
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--warm-ivory-dim)', fontFamily: 'var(--font-mono)' }}>
                  <Eye size={36} style={{ color: 'var(--muted-olive)', margin: '0 auto 0.75rem auto' }} />
                  <div>INSPECTION CANVAS STANDBY</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
                    Select an image/video or load sample highway footage to initiate analysis
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Telemetry Footer */}
            {currentResult && (
              <div 
                style={{ 
                  marginTop: '0.75rem', 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '1.5rem', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.75rem',
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.75rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted-olive)' }}>EXECUTION MODE: </span>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>
                    {currentResult.execution_mode || (currentResult.is_trained_weights_loaded ? 'PYTORCH_CENTERNET' : 'BENCHMARK_FALLBACK')}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted-olive)' }}>LATENCY: </span>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{currentResult.latency_ms} ms</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted-olive)' }}>THROUGHPUT: </span>
                  <span style={{ color: 'var(--burnt-orange)', fontWeight: 600 }}>{currentResult.fps} FPS</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted-olive)' }}>TOTAL DETECTIONS: </span>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{currentResult.total_detections}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted-olive)' }}>UNIQUE VEHICLES: </span>
                  <span style={{ color: 'var(--warm-ivory)', fontWeight: 600 }}>{currentResult.unique_vehicles}</span>
                </div>
                {currentResult.line_crossings > 0 && (
                  <div>
                    <span style={{ color: 'var(--muted-olive)' }}>TRIPWIRE CROSSINGS: </span>
                    <span style={{ color: 'var(--status-green)', fontWeight: 600 }}>{currentResult.line_crossings}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detected Vehicles List & Bounding Box Coordinates */}
          {detections.length > 0 && (
            <div className="command-card">
              <div className="command-card-header">
                <span className="card-title">
                  Object Telemetry & Coordinates ({detections.length} objects)
                </span>
                <span className="label-tactical">PIXEL BOUNDING BOXES [X1, Y1, X2, Y2]</span>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table className="command-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Class</th>
                      <th>Confidence</th>
                      <th>Bounding Box Coordinates</th>
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
                          style={{
                            backgroundColor: isSelected ? 'var(--charcoal-700)' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedBoxIndex(isSelected ? null : idx)}
                        >
                          <td style={{ color: 'var(--burnt-orange)' }}>#{idx + 1}</td>
                          <td>
                            <span 
                              className="badge"
                              style={{
                                backgroundColor: det.class_name === 'car' ? 'var(--burnt-orange-faint)' : 'var(--muted-olive-faint)',
                                color: det.class_name === 'car' ? 'var(--burnt-orange)' : 'var(--muted-olive-light)',
                                border: '1px solid currentColor',
                              }}
                            >
                              {det.class_name.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{Math.round(det.score * 100)}%</td>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
