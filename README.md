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

### D. Model Laboratory
- **Comparative Ablation Matrix**:
  - Baseline CenterNet (ResNet-18)
  - CenterNet + CBAM
  - CenterNet + BiFPN
  - **Improved CenterNet (ResNet-18 + CBAM + BiFPN) [Proposed]**
  - Edge / Quantized Model (INT8)
  - Real metrics: `mAP@0.5`, `mAP@[0.5:0.95]`, Precision, Recall, F1-Score, FPS, Latency (ms), Parameters, and GFLOPs.
  - **Honest Metric Reporting**: Unmeasured metrics are explicitly presented as *"Not evaluated"*, never fabricated.
- **Training Convergence History**: 50-epoch loss curves (Total Loss, Focal Heatmap Loss, L1 Size WH Loss, Subpixel Offset Reg Loss, and Validation mAP).
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
