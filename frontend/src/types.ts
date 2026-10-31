export type NavigationTab = 
  | 'overview'
  | 'detection_studio' 
  | 'analytics' 
  | 'model_evaluation' 
  | 'history'
  | 'dashboard' 
  | 'traffic_analytics' 
  | 'model_laboratory' 
  | 'history_dataset';

export interface ModelStatus {
  model_name: string;
  architecture: {
    backbone: string;
    attention_module: string;
    neck: string;
    heads: string[];
    classes: string[];
    downsample_ratio: number;
    input_resolution?: string;
  };
  device: string;
  device_display?: string;
  is_cuda_available: boolean;
  gpu_name: string;
  weights_loaded: boolean;
  model_status: string;
  checkpoint_path: string;
  checkpoint_name?: string;
  last_load_error: string | null;
  confidence_threshold: number;
  available_checkpoints: Array<{
    filename: string;
    path: string;
    size_mb: number;
  }>;
}

export interface DetectionItem {
  bbox: [number, number, number, number];
  score: number;
  class_id: number;
  class_name: 'car' | 'van' | 'bus' | 'others';
}

export interface TrackedItem {
  track_id: number;
  bbox: [number, number, number, number];
  class_name: string;
  confidence: number;
  center: [number, number];
  trajectory: Array<[number, number]>;
  speed_vector: [number, number];
  crossed_line: boolean;
  crossing_direction: string | null;
}

export interface TimelinePoint {
  frame: number;
  timestamp_sec: number;
  active_detections: number;
  unique_vehicles: number;
  line_crossings: number;
  inbound: number;
  outbound: number;
  class_breakdown: Record<string, number>;
  density_percentage: number;
  density_level: string;
  latency_ms: number;
}

export interface RunRecord {
  id: string;
  timestamp: string;
  media_type: 'image' | 'video';
  filename: string;
  input_url: string;
  annotated_url: string;
  model_name: string;
  weights_status: string;
  latency_ms: number;
  fps: number;
  total_detections: number;
  unique_vehicles: number;
  line_crossings: number;
  class_counts: Record<string, number>;
  timeline?: TimelinePoint[];
  metadata?: Record<string, any>;
  is_sample?: boolean;
  run_type?: 'user_upload' | 'test_run' | 'demo_sample' | 'funnel';
  source?: string;
  source_url?: string;
  creator?: string;
  license?: string;
  source_page_url?: string;
}

export interface ConfidenceBin {
  bin: string;
  min: number;
  max: number;
  count: number;
}

export interface RunTimePoint {
  date: string;
  detections: number;
  runs: number;
}

export interface AnalyticsSummary {
  total_runs: number;
  successful_runs?: number;
  failed_runs?: number;
  success_rate?: number;
  image_runs?: number;
  video_runs?: number;
  total_detections: number;
  total_unique_vehicles: number;
  total_line_crossings: number;
  average_latency_ms: number;
  median_latency_ms?: number;
  class_distribution: {
    car: number;
    van: number;
    bus: number;
    others: number;
  };
  runs_over_time?: RunTimePoint[];
  confidence_histogram?: ConfidenceBin[];
  total_confidence_samples?: number;
  per_run_breakdown?: Array<{
    id: string;
    filename: string;
    media_type: 'image' | 'video';
    detections: number;
    unique_vehicles: number;
    latency_ms: number;
    timestamp: string;
  }>;
}

export interface ExperimentItem {
  id: string;
  name: string;
  backbone: string;
  attention: string;
  neck: string;
  heads: string;
  evaluation_split?: string;
  evaluation_type?: string;
  map_50: number | null;
  map_50_95: number | null;
  ap_75?: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  fps: number | null;
  latency_ms: number | null;
  params_m: number | null;
  gflops: number | null;
  class_ap_50: Record<string, number | null>;
  status: string;
  notes: string;
}

export interface LossPoint {
  epoch: number;
  total_loss: number;
  focal_heatmap_loss: number;
  wh_size_loss: number;
  offset_reg_loss: number;
  val_loss?: number;
  val_map_50?: number;
  val_heatmap_loss?: number;
  val_wh_loss?: number;
  val_offset_loss?: number;
}

export interface DatasetInfo {
  name: string;
  description: string;
  sampling_interval_note?: string;
  target_classes: string[];
  total_sequences: number;
  training_sequences?: number;
  validation_sequences?: number;
  test_sequences?: number;
  total_sampled_images?: number;
  training_sampled_images?: number;
  validation_sampled_images?: number;
  total_annotated_boxes: number;
  training_boxes?: number;
  validation_boxes?: number;
  splits: {
    train: { sequences: number; frames: number | string; bounding_boxes: number | string; percentage: number | null };
    val: { sequences: number; frames: number | string; bounding_boxes: number | string; percentage: number | null };
    test: { sequences: number; frames: number | string; bounding_boxes: number | string; percentage: number | null };
  };
  native_specifications?: {
    native_frame_resolution: string;
    native_approx_total_frames: number;
  };
  weather_conditions?: Array<{ condition: string; sequences: number; percentage: number; challenges: string }>;
  input_specifications: {
    native_resolution: string;
    model_input_resolution: string;
    color_space: string;
    downsampling_ratio: number;
    heatmap_resolution?: string;
  };
}

export interface ModelMetricItem {
  name: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  accuracy: number | null;
  mAP50: number | null;
  mAP50_95: number | null;
  fps: number | null;
  latency_ms: number | null;
  params: number | null;
  gflops: number | null;
}

export interface ClassMetricItem {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  ap50?: number | null;
}

export interface MetricsData {
  models: ModelMetricItem[];
  per_class: Record<string, ClassMetricItem>;
  confusion_matrix: {
    classes: string[];
    matrix: (number | null)[][] | null;
  } | null;
  per_condition: {
    sunny: number | null;
    night: number | null;
    rainy: number | null;
    cloudy: number | null;
  };
  history: Array<{
    epoch: number;
    train_loss: number | null;
    val_loss: number | null;
    val_map_50: number | null;
  }>;
  error?: string | null;
}


export interface FunnelImage {
  id: string;
  thumbnail_url: string;
  image_url: string;
  title: string;
  creator?: string | null;
  license: string;
  license_url?: string | null;
  source_page_url: string;
  provider: 'openverse' | 'commons' | string;
}

export interface FunnelSearchResult {
  query: string;
  source: string;
  page: number;
  limit: number;
  total: number;
  images: FunnelImage[];
  presets: string[];
  errors?: Record<string, string>;
}

export interface FunnelBatchItemResult {
  image_url: string;
  status: 'success' | 'failed';
  run_id?: string;
  input_url?: string;
  annotated_url?: string;
  total_detections?: number;
  unique_vehicles?: number;
  class_counts?: Record<string, number>;
  latency_ms?: number;
  fps?: number;
  title?: string;
  creator?: string;
  license?: string;
  source_page_url?: string;
  error?: string;
  detections?: DetectionItem[];
  saved_run?: RunRecord;
}

export interface FunnelBatchResponse {
  total: number;
  successful: number;
  failed: number;
  results: FunnelBatchItemResult[];
}
