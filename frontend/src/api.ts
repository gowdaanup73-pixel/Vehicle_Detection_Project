import {
  AnalyticsSummary,
  DatasetInfo,
  ExperimentItem,
  LossPoint,
  MetricsData,
  ModelStatus,
  RunRecord,
} from './types';

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchModelStatus(): Promise<ModelStatus> {
  const res = await fetch(`${API_BASE}/model/status`);
  if (!res.ok) throw new Error(`Model status error: ${res.statusText}`);
  return res.json();
}

export async function configureModel(payload: { checkpoint_path?: string; confidence_threshold?: number }) {
  const res = await fetch(`${API_BASE}/model/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Configure model error: ${res.statusText}`);
  return res.json();
}

export async function uploadCheckpoint(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/model/upload-checkpoint`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function detectImage(file: File, confThresh: number = 0.35) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('conf_thresh', confThresh.toString());
  const res = await fetch(`${API_BASE}/detect/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Image detection failed');
  }
  return res.json();
}

export async function detectVideo(file: File, confThresh: number = 0.35, maxFrames: number = 120, frameStride: number = 1) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('conf_thresh', confThresh.toString());
  formData.append('max_frames', maxFrames.toString());
  formData.append('frame_stride', frameStride.toString());
  const res = await fetch(`${API_BASE}/detect/video`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Video detection failed');
  }
  return res.json();
}

export async function detectSample(mediaType: 'image' | 'video' = 'image', confThresh: number = 0.35) {
  const formData = new FormData();
  formData.append('media_type', mediaType);
  formData.append('conf_thresh', confThresh.toString());
  const res = await fetch(`${API_BASE}/detect/sample?media_type=${mediaType}&conf_thresh=${confThresh}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Sample detection failed');
  }
  return res.json();
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error('Analytics fetch failed');
  return res.json();
}

export async function fetchExperiments(): Promise<{ experiments: ExperimentItem[]; baseline_model: string; proposed_model: string }> {
  const res = await fetch(`${API_BASE}/experiments`);
  if (!res.ok) throw new Error('Experiments fetch failed');
  return res.json();
}

export async function fetchLosses(): Promise<LossPoint[]> {
  const res = await fetch(`${API_BASE}/experiments/losses`);
  if (!res.ok) throw new Error('Losses fetch failed');
  return res.json();
}

export async function fetchDatasetInfo(): Promise<DatasetInfo> {
  const res = await fetch(`${API_BASE}/dataset/info`);
  if (!res.ok) throw new Error('Dataset info fetch failed');
  return res.json();
}

export async function listRuns(mediaType?: string): Promise<RunRecord[]> {
  const url = mediaType ? `${API_BASE}/runs?media_type=${mediaType}` : `${API_BASE}/runs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Runs list failed');
  return res.json();
}

export async function deleteRun(runId: string) {
  const res = await fetch(`${API_BASE}/runs/${runId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete run failed');
  return res.json();
}

export async function fetchMetrics(): Promise<MetricsData> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error('Metrics fetch failed');
  return res.json();
}
