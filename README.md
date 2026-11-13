# Vehicle Detection & Multi-Object Tracking Intelligence Platform

High-performance vehicle detection, multi-class recognition, and ByteTrack spatial tracking system engineered for dense vehicular traffic and highway surveillance benchmarks.

The platform integrates the Hugging Face pre-trained model **`iisc-aim/UVH-26`** (YOLOv11-S optimized for dense traffic conditions) alongside an anchor-free **Improved CenterNet** architecture (ResNet-18 + CBAM Attention + BiFPN Neck) with automated fallback to COCO `yolo11s.pt`.

---

## 1. Model Architecture & Key Technical Innovations

### A. Primary Model: `iisc-aim/UVH-26` (YOLOv11-S)
- **Backbone**: C3k2 multi-scale feature extractor with Spatial Pyramid Pooling - Fast (SPPF).
- **Attention**: Path-level Spatial Attention (PSA) preserving small-vehicle boundary representations under severe occlusion.
- **Neck**: Enhanced Path Aggregation Network (PAN-FPN) facilitating bidirectional multiscale gradient propagation.
- **Head**: Decoupled anchor-free bounding box regression and classification heads.
- **Tracking Backend**: ByteTrack algorithm using low-confidence detection association (`bytetrack.yaml`) to maintain continuous vehicle track IDs through occlusions.

### B. CenterNet Ablation Architecture
- **Backbone**: ResNet-18 initialized with pre-trained ImageNet representations.
- **Attention Module (CBAM)**: Sequential Channel Attention (global max/average pooling with shared MLP) followed by Spatial Attention (7x7 conv) to suppress background road clutter.
- **Feature Neck (BiFPN)**: Multi-scale learned weighted bidirectional feature fusion connecting levels $P_3, P_4, P_5$.
- **Detection Heads**: Decoupled 3x3 conv heads for Gaussian keypoint center heatmaps, bounding box scale regression ($W, H$), and local sub-pixel offset quantization.

### C. Target Vehicle Classes
The system detects and tracks four vehicle categories:
1. `car`: Sedans, hatchbacks, SUVs, and passenger vehicles.
2. `van`: Commercial minivans, delivery vans, and cargo carriers.
3. `bus`: Public transit buses, shuttles, and coaches.
4. `others`: Trucks, three-wheelers, auto-rickshaws, and specialized vehicles.

---

## 2. Benchmark Performance & Ablation Results

Evaluated on the standardized **1,417-image UA-DETRAC validation split** and high-density traffic benchmark sequences:

| Architecture | Backbone | Attention | Feature Neck | mAP@0.5 | mAP@[0.5:0.95] | AP@0.75 | Precision | Recall | F1-Score | FPS (GPU) | Latency |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **UVH-26 (Active SOTA)** | **YOLOv11-S** | **PSA** | **Enhanced PAN** | **91.20%** | **68.45%** | **74.30%** | **92.4%** | **92.8%** | **92.6%** | **156.2** | **6.4 ms** |
| Enhanced CenterNet V2 | ResNet-18 | CBAM | BiFPN | 58.89% | 33.61% | 34.09% | 61.4% | 55.5% | 58.3% | 78.1 | 12.8 ms |
| Enhanced CenterNet V1 | ResNet-18 | CBAM | BiFPN (1-block) | 54.52% | 30.49% | 31.22% | 58.1% | 54.4% | 56.2% | 84.7 | 11.8 ms |
| Baseline CenterNet | ResNet-18 | None | TransposeConv | 53.42% | 30.87% | 31.36% | 56.8% | 53.3% | 55.0% | 94.3 | 10.6 ms |

### Key Benchmark Metrics
- **Detection Accuracy (AP@0.50)**: **91.20%** (+37.78 pp gain over baseline CenterNet).
- **Localization Fidelity (AP@0.75)**: **74.30%** (+42.94 pp gain).
- **COCO Strict Metric (mAP@[0.50:0.95])**: **68.45%** (+37.58 pp gain).
- **Vehicle Recall (AR@100)**: **92.80%** across complex occlusion conditions.
- **Model Efficiency**: 9.4M parameters, 21.5 GFLOPs, 6.4 ms execution latency.

---

## 3. Video Tracking & Analytics Pipeline

1. **ByteTrack Multi-Object Tracking**:
   - High-score detections ($\ge 0.40$) initialize and match existing Kalman filter trajectories.
   - Low-score detections ($0.10 \le \text{conf} < 0.40$) are matched against unmatched tracks to avoid trajectory fragmentation during temporary occlusions.
2. **De-duplicated Vehicle Counting**:
   - Computes unique vehicles per class across video frames via persistent track identities.
   - Prevents multi-frame double counting.
3. **Tripwire Passage Accounting**:
   - Directional tripwire crossing logic (Inbound vs. Outbound) monitors vehicle flow across virtual sensor gates.
4. **Spatial Density Estimation**:
   - Calculates dynamic occupancy ratios: $\text{Occupancy Ratio} = \frac{\sum \text{Area}(\text{Bounding Boxes})}{\text{Frame Width} \times \text{Frame Height}}$.
5. **Video Encoding**:
   - Automated H.264 transcoding (`libx264`, `yuv420p`, `+faststart`) via `imageio-ffmpeg` for compatibility across standard video decoders.

---

## 4. Repository Structure

```text
Vehicle_Detection_Project/
├── backend/
│   ├── api/
│   │   ├── app.py                     # FastAPI application routes
│   │   └── schemas.py                 # Pydantic request/response schemas
│   ├── checkpoints/                   # Checkpoint weight storage (.pt / .pth)
│   │   └── UVH-26-MV-YOLOv11-S.pt     # Primary cached model weights (57 MB)
│   ├── data/
│   │   └── database.py                # SQLite telemetry store (runs, detections)
│   ├── inference/
│   │   └── detector.py                # Singleton model loader and inference engine
│   ├── metrics/
│   │   ├── uvh26_validation_metrics.json
│   │   └── improved_v2_validation_metrics.json
│   ├── models/
│   │   ├── centernet.py               # Improved CenterNet PyTorch implementation
│   │   ├── cbam.py                    # Convolutional Block Attention Module
│   │   ├── bifpn.py                   # Bidirectional Feature Pyramid Network
│   │   └── tracker.py                 # Centroid & IoU trajectory tracker
│   └── services/
│       ├── experiments_service.py     # Benchmark data provider
│       └── media_processor.py         # Image inference & video tracking service
├── detector.py                        # Standalone CLI entry point
├── scripts/
│   └── export_metrics.py              # Benchmark evaluation metric exporter
├── tests/
│   └── test_backend.py                # 31 unit and integration test suites
├── requirements.txt                   # Production Python dependencies
└── run_platform.py                    # Root service launcher
```

---

## 5. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- PyTorch 2.0+
- FFmpeg (or `imageio-ffmpeg` bundled binary)
- CUDA-capable GPU (optional; automatic CPU fallback supported)

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/gowdaanup73-pixel/Vehicle_Detection_Project.git
cd Vehicle_Detection_Project

# Create and activate a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Model Checkpoints
The model loader automatically downloads `iisc-aim/UVH-26` weights (`UVH-26-MV-YOLOv11-S.pt`) on initial startup. Alternatively, weights can be cached manually:
```bash
# Local checkpoint destination
backend/checkpoints/UVH-26-MV-YOLOv11-S.pt
```
If weights are unavailable, the engine falls back to standard `yolo11s.pt` with COCO vehicle class filtering (`[2, 3, 5, 7]`).

---

## 6. CLI Usage

Run standalone inference directly on image or video files using `detector.py`:

### Image Detection
```bash
python detector.py \
  --source backend/media/uploads/sample_highway_traffic.jpg \
  --conf 0.25 \
  --device cpu
```

### Video Tracking
```bash
python detector.py \
  --source backend/media/uploads/sample_traffic_stream.mp4 \
  --conf 0.25 \
  --max-frames 120 \
  --device cpu
```

### CLI Arguments
| Flag | Default | Description |
| :--- | :--- | :--- |
| `--source` | *Required* | Filepath to input image or video stream |
| `--conf` | `0.40` | Detection confidence threshold |
| `--device` | `auto` | Target compute accelerator (`0`, `cuda`, `cpu`) |
| `--tracker` | `bytetrack.yaml` | Tracker configuration file |
| `--max-frames`| `None` | Optional frame processing cap for video inputs |

---

## 7. REST API Endpoints

The backend exposes a REST API via FastAPI:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/model/status` | Active model checkpoint, weights state, and device allocation |
| `GET` | `/api/detectors` | Enumerates available detection engines (`uvh26`, `centernet`, `pretrained`) |
| `POST` | `/api/detect/image` | Multipart image upload for detection and annotation |
| `POST` | `/api/detect/video` | Multipart video upload for frame-by-frame ByteTrack tracking |
| `POST` | `/api/detect/sample` | Runs inference on built-in reference benchmark imagery or video |
| `GET` | `/api/experiments` | Returns comparative ablation matrix data |
| `GET` | `/api/metrics` | Serves model validation metrics and per-class performance data |
| `GET` | `/api/dataset/info` | Returns dataset composition and sequence statistics |
| `GET` | `/api/runs` | Queries persisted SQLite execution records |
| `DELETE` | `/api/runs/{id}` | Deletes a stored run record and associated media artifacts |

### API Documentation
Interactive OpenAPI documentation is accessible when running the server:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

---

## 8. Automated Verification & Test Suite

Run the full automated test suite covering neural attention modules, BiFPN feature fusion, anchor-free center decoding, ByteTrack logic, SQLite persistence, and API routes:

```bash
python -m pytest tests/test_backend.py -v
```

All 31 test suites pass with 100% success rate:
- `TestNeuralModules`:
  - `test_cbam_attention`: Channel and Spatial attention tensor shapes.
  - `test_bifpn_fusion`: Multi-scale weighted bidirectional feature fusion.
  - `test_centernet_forward`: CenterNet stride-4 multi-head feature outputs.
  - `test_centernet_decode`: Gaussian heatmap peak extraction and coordinate decoding.
- `TestTrackingAndAnalytics`:
  - `test_tracker_line_crossing`: Trajectory history and directional gate passage accounting.
  - `test_density_estimation`: Spatial occupancy ratio estimation.
- `TestDatabaseStore`:
  - `test_runs_database_crud`: SQLite persistence, telemetry retrieval, and deletion cascading.
- `TestApiEndpoints`:
  - `test_api_health`, `test_api_model_status`, `test_api_experiments`, `test_api_dataset_info`
  - `test_api_detect_sample`: Image and video reference inference.
  - `test_image_upload_endpoint` & `test_video_upload_and_tracking_endpoint`: Multipart uploads and real inference.
  - `test_dual_image_provenance_and_model_invocation_roadway_and_spiderman`: Verifies detection fidelity and absence of hardcoded mock outputs.
  - `test_api_metrics_valid_file`, `test_api_metrics_null_handling`: Schema compliance and null safety.
  - `test_api_detectors_endpoint` & `test_detector_selection_on_detect_routes`: Multi-detector backend routing.

---

## 9. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. Model weights from `iisc-aim/UVH-26` are subject to their respective upstream licenses.
