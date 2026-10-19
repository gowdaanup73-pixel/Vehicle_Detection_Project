export type NavigationTab = 
  | 'command_center' 
  | 'detection_studio' 
  | 'traffic_analytics' 
  | 'model_laboratory' 
  | 'dataset_runs';

export interface ModelStatus {
  model_name: string;
  architecture: {
    backbone: string;
    attention_module: string;
    neck: string;
    heads: string[];
    classes: string[];
    downsample_ratio: number;
  };
  device: string;
  is_cuda_available: boolean;
  gpu_name: string;
  weights_loaded: boolean;
  model_status: string;
  checkpoint_path: string;
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
}

export interface AnalyticsSummary {
  total_runs: number;
  total_detections: number;
  total_unique_vehicles: number;
  total_line_crossings: number;
  average_latency_ms: number;
  class_distribution: {
    car: number;
    van: number;
    bus: number;
    others: number;
  };
}

export interface ExperimentItem {
  id: string;
  name: string;
  backbone: string;
  attention: string;
  neck: string;
  heads: string;
  map_50: number | null;
  map_50_95: number | null;
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
  val_map_50: number;
}

export interface DatasetInfo {
  name: string;
  description: string;
  target_classes: string[];
  total_sequences: number;
  total_frames: number;
  total_annotated_boxes: number;
  splits: {
    train: { sequences: number; frames: number; bounding_boxes: number; percentage: number };
    val: { sequences: number; frames: number; bounding_boxes: number; percentage: number };
    test: { sequences: number; frames: number; bounding_boxes: number; percentage: number };
  };
  class_distribution: Record<string, { count: number; percentage: number }>;
  weather_conditions: Array<{ condition: string; sequences: number; percentage: number; challenges: string }>;
  occlusion_breakdown: { unoccluded: number; partially_occluded: number; heavily_occluded: number };
  input_specifications: {
    native_resolution: string;
    model_input_resolution: string;
    color_space: string;
    downsampling_ratio: number;
  };
}
