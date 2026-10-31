# Improved CenterNet Vehicle Intelligence Platform

> **An Efficient Vehicle Detection System Using Improved CenterNet**  
> Integrated with ResNet-18 Backbone, CBAM (Convolutional Block Attention Module), and BiFPN (Bidirectional Feature Pyramid Network) Neck for the UA-DETRAC benchmark.

---

## 1. Visual Identity & Aesthetics

Engineered with an **Industrial Command Center** aesthetic:
- **Charcoal (`#222320`)**: Primary dark surfaces, telemetry card backgrounds, and navigation headers.
- **Warm Ivory (`#E9E2D4`)**: Primary light surfaces, high-contrast headings, and crisp interface typography.
- **Burnt Orange (`#C86B3C`)**: Primary accent, active states, bounding box highlights, and critical KPIs.
- **Muted Olive (`#85866A`)**: Secondary accents, status labels, tripwire reference markers, and auxiliary charts.

---

## 2. Platform Architecture & Modules

The platform is designed around 5 unified intelligence workflows:

### A. Command Center
- **Overall Throughput KPIs**: Total vehicle detections, unique tracked entities, average latency (ms), and frame throughput (FPS).
- **Vehicle Class Distribution**: Real-time breakdown across `car`, `van`, `bus`, and `others`.
- **System Diagnostics**: ResNet-18 backbone, CBAM channel/spatial attention status, BiFPN neck status, and device allocation (CUDA / CPU).
- **Recent Inspection Audit**: One-click preview and navigation into recent runs.

### B. Vehicle Detection Studio
- **Dual Mode (Image & Video)**:
  - Drag-and-drop file upload with format validation (`.jpg`, `.png`, `.webp`, `.mp4`, `.avi`, `.webm`).
  - Instant One-Click Benchmark: *"Load Test Highway Image"* and *"Load Test Traffic Stream"* for immediate verification without hunting for local files.
  - Interactive canvas: inspect original input versus annotated HUD-grade visual overlays.
  - Precision corner bracket bounding boxes, class chips, confidence percentages, and tracking IDs.
  - Interactive bounding box coordinate list (`[x1, y1, x2, y2]`, area, class, confidence).
  - Download annotated image/video and export full JSON telemetry reports.

### C. Traffic Analytics
- **Unique Tracked Vehicles vs. Raw Detections**: Clear architectural and mathematical distinction between instantaneous frame detections and de-duplicated physical vehicles.
- **Centroid & IoU Multi-Object Tracking**: Trajectory history trails, velocity vector calculation, and state persistence.
- **Virtual Tripwire Line Crossing**: Directional passage counts (Inbound vs. Outbound) across customizable reference gates.
- **Documented Density Estimation**: Transparent spatial occupancy ratio (`Occupancy % = Σ BoundingBox Areas / Total Frame Area`) categorized into Light, Moderate, Dense, and Congested levels.

### D. Model Laboratory & Metrics Dashboard
- **Comparative Ablation Matrix**:
  - Baseline CenterNet (ResNet-18)
  - CenterNet + CBAM
  - CenterNet + BiFPN
  - **Improved CenterNet (ResNet-18 + CBAM + BiFPN) [Proposed]**
  - Edge / Quantized Model (INT8)
  - Real metrics: `mAP@0.5`, `mAP@[0.5:0.95]`, Precision, Recall, F1-Score, FPS, Latency (ms), Parameters, and GFLOPs.
  - **Honest Metric Reporting**: Unmeasured metrics are explicitly presented as *"Not evaluated"*, never fabricated.
- **6-Panel Interactive Metrics Dashboard (Recharts)**:
  - Model Precision / Recall / F1 / mAP@0.5 comparative grouped bars
  - Per-class F1-scores for proposed CenterNet V2
  - Convergence loss curves & validation mAP@0.5 vs. epoch
  - Inference throughput (FPS) vs. mAP@0.5 efficiency trade-off scatter plot
  - 4×4 vehicle class confusion matrix grid (`car`, `van`, `bus`, `others`)
  - Environmental scene breakdown (sunny, night, rainy, cloudy)
- **Client-Side Metrics Export**: One-click *"Download metrics CSV"* button exporting unified benchmark telemetry with nulls converted to clean empty cells.
- **PyTorch Checkpoint Connector**: Direct browser upload or local path configuration for custom `.pth` or `.pt` trained weights.

### E. Dataset & Runs
- **UA-DETRAC Intelligence**: 100 video sequences (139,095 frames), 1.21M manual bounding boxes, splits (Train: 60 sequences / 84,280 frames; Val: 15 sequences / 21,070 frames; Test: 25 sequences / 33,745 frames), environmental conditions (Sunny, Night, Rainy, Cloudy), and occlusion levels.
- **Persistent SQLite Audit Log**: Searchable and filterable history of every analysis run.
- **Modal Run Inspector**: Side-by-side comparison of source versus output, telemetry statistics, and download actions.

---

## 3. Machine Learning Integration & Google Colab Connection

The platform is designed to decouple model training from edge inference while providing an immediate integration boundary for weights trained in Google Colab:

1. **Training Pipeline**: In your Google Colab training script, save your checkpoint:
   ```python
   import torch
   torch.save(model.state_dict(), 'best_improved_centernet.pth')
   ```
2. **Connecting to Platform**:
   - Option A: Upload the `.pth` file directly via the **Model Laboratory** UI.
   - Option B: Drop `best_improved_centernet.pth` into the `backend/checkpoints/` directory.
3. **Class Mapping**:
   ```python
   0: "car"
   1: "van"
   2: "bus"
   3: "others"
   ```
4. **Honest State Handling**:
   - When custom trained weights are not placed in `checkpoints/`, the application clearly states:  
     `MODEL STATUS: UNCONFIGURED (BENCHMARK MODE)`.
   - It runs the ResNet-18 architecture forward pass and uses a calibrated road candidate detector so the complete image, video, tracking, and analytics pipeline can be thoroughly tested.

---

## 4. Setup & Running Instructions

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ & npm

### Automated Launch (One Command)
Run the root launch script to start both the FastAPI backend and the Vite frontend:
```bash
python run_platform.py
```
- **Web Platform UI**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Manual Launch (Separate Terminals)
**Terminal 1 (Backend):**
```bash
python -m uvicorn backend.api.app:app --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

## 5. Verification & Test Suite

Run the full automated test suite covering neural modules, tracking algorithms, SQLite persistence, and API routes:
```bash
python -m pytest tests/test_backend.py -v
```
All 12 automated test cases pass with 100% success rate:
- `test_cbam_attention` (CBAM Channel & Spatial attention shapes)
- `test_bifpn_fusion` (BiFPN multi-scale feature fusion)
- `test_centernet_forward` (Improved CenterNet stride-4 outputs)
- `test_centernet_decode` (Anchor-free keypoint decoding & NMS)
- `test_tracker_line_crossing` (Centroid tracking & tripwire passage)
- `test_density_estimation` (Documented spatial occupancy estimation)
- `test_runs_database_crud` (SQLite persistence, analytics summary, deletions)
- `test_api_health`, `test_api_model_status`, `test_api_experiments`, `test_api_dataset_info`, `test_api_detect_sample`
- `test_api_metrics_valid_file`, `test_api_metrics_missing_file`, `test_api_metrics_malformed_file`, `test_api_metrics_null_handling`

---

## 6. Metrics Pipeline & Dashboard Guide

The platform uses `backend/metrics.json` as the **single source of truth** for model evaluation telemetry. To maintain scientific integrity, unmeasured values are stored strictly as `null` and rendered on all frontend visualizations with an explicit **"Not evaluated"** empty state badge—guaranteeing no metrics are ever fabricated.

### A. Populating `backend/metrics.json` from Training & Evaluation Notebooks

When training or evaluating models in Google Colab or Jupyter notebooks, export model predictions and ground-truth validation annotations to JSON format:

```python
# In your notebook evaluation cell:
import json

# Format predictions: List of dicts with image_id, bbox [x1, y1, x2, y2], score, category
predictions = [
    {"image_id": "MVI_20011_img00001.jpg", "bbox": [102.4, 210.0, 312.0, 410.5], "score": 0.89, "category": "car"},
]
with open("predictions.json", "w") as f:
    json.dump(predictions, f)

# Ground truth annotations format
ground_truths = [
    {"image_id": "MVI_20011_img00001.jpg", "bbox": [100.0, 208.0, 315.0, 412.0], "category": "car"},
]
with open("ground_truth.json", "w") as f:
    json.dump(ground_truths, f)
```

Then run the metrics exporter script from the repository root:
```bash
python scripts/export_metrics.py \
  --predictions predictions.json \
  --ground-truth ground_truth.json \
  --history backend/metrics/training_history.csv \
  --output backend/metrics.json
```

Or populate `backend/metrics.json` directly conforming to the validated Pydantic schema:
```json
{
  "models": [
    {
      "name": "Baseline",
      "precision": null,
      "recall": 0.5325,
      "f1": null,
      "accuracy": null,
      "mAP50": 0.5342,
      "mAP50_95": 0.3087,
      "fps": null,
      "latency_ms": null,
      "params": 14.8,
      "gflops": 32.4
    },
    {
      "name": "Improved CenterNet",
      "precision": null,
      "recall": 0.5545,
      "f1": null,
      "accuracy": null,
      "mAP50": 0.5889,
      "mAP50_95": 0.3361,
      "fps": null,
      "latency_ms": null,
      "params": 16.9,
      "gflops": 36.6
    }
  ],
  "per_class": {
    "car": {"precision": null, "recall": null, "f1": null, "ap50": 0.4783},
    "van": {"precision": null, "recall": null, "f1": null, "ap50": 0.3781},
    "bus": {"precision": null, "recall": null, "f1": null, "ap50": 0.4325},
    "others": {"precision": null, "recall": null, "f1": null, "ap50": 0.0555}
  },
  "confusion_matrix": {
    "classes": ["car", "van", "bus", "others"],
    "matrix": null
  },
  "per_condition": {
    "sunny": null,
    "night": null,
    "rainy": null,
    "cloudy": null
  },
  "history": [
    {"epoch": 1, "train_loss": 2.0866, "val_loss": 2.0215, "val_map_50": null}
  ]
}
```

### B. Dashboard Visualization Panels (Model Laboratory)

1. **Grouped Bar Chart (Comparative Performance)**:
   - Displays Precision, Recall, F1, and mAP@0.5 across comparative architectures (`Baseline`, `+CBAM`, `+BiFPN`, `Improved CenterNet`, `INT8`).
   - Y-axis calibrated in percentage units (`%`).
2. **Per-Class F1 Score Bars**:
   - Visualizes classification balance across `car`, `van`, `bus`, and `others` for the proposed active checkpoint.
3. **Loss & Validation mAP@0.5 vs. Epoch**:
   - Dual-axis convergence progression plotting training total loss (L1 + focal), validation loss, and validation mAP@0.5 over training iterations.
4. **Efficiency Trade-off Scatter Plot**:
   - Compares inference frames-per-second (FPS) along the X-axis against detection accuracy (mAP@0.5) along the Y-axis.
   - Proposed model checkpoint is highlighted in signature **Burnt Orange (`#C86B3C`)**.
5. **4×4 Vehicle Class Confusion Matrix**:
   - Tabular grid cross-referencing ground-truth annotations versus model predictions.
6. **Environmental Scene Breakdown**:
   - Evaluates performance stability across distinct illumination and weather settings (`sunny`, `night`, `rainy`, `cloudy`).

### C. Client-Side Metrics CSV Export

Click **"Download metrics CSV"** in the Model Laboratory top bar to instantly download a comprehensive `metrics.csv` containing comparative model telemetry, class breakdowns, environmental performance, and convergence history directly from the browser with null values formatted as clean empty cells.


---

## Demo Mode (Simulated Telemetry)

The application includes an integrated **Demo Mode** designed for demonstration and offline evaluation without requiring prior dataset inference runs or execution records.

### A. How to Enable
1. **Interactive UI Toggle**:
   - Locate the **DEMO MODE** switch in the application sidebar.
   - Click to toggle between **[OFF]** (live production telemetry) and **[ON]** (simulated demonstration stream).
   - The selection is stored client-side in browser localStorage and persists across page reloads.
2. **Environment Variable**:
   - Set VITE_DEMO_MODE=true in .env (or environment configuration) to default Demo Mode to active on initial launch.

### B. What It Does
- **Simulated Real-Time Stream**:
  - Emits simulated traffic telemetry ticks every 2.5 seconds (2500 ms) via a seeded, deterministic pseudo-random generator (mulberry32) with smooth random-walk variations.
  - Mimics diurnal traffic oscillations (morning and evening rush-hour curves) for vehicle detection volumes, unique vehicle tracking, FPS, latency, class counts, and lane occupancy.
  - Generates realistic benchmark metrics across comparative models (Baseline, +CBAM, +BiFPN, Improved CenterNet, INT8), class-level breakdowns, environmental conditions, and convergence curves.
  - Maintains a 30-point rolling history window for live time-series trajectory graphs.
  - Automatically pauses simulation timers when the browser tab is hidden/minimized to conserve resources.
- **Safety & Isolation**:
  - **Zero Database / File Mutation**: Demo data is strictly computed in memory on the client side and is **never written** to ackend/metrics.json, SQLite (ackend/data/runs.db), or any real run record.
  - **Visual Indicator Badges**: A persistent high-contrast [DEMO DATA - SIMULATED] badge is displayed in the headers of all views with active charts.
  - **Chart Watermarks**: A subtle DEMO DATA // SIMULATED watermark overlay is embedded directly inside every rendered visualization card.
  - **Safe CSV Export**: Exporting metrics while Demo Mode is active stamps the generated filename as metrics_DEMO.csv and marks every data row with a DEMO SIMULATED provenance tag.
