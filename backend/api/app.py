"""
FastAPI Backend Application
Exposes REST endpoints for vehicle detection, video tracking analytics,
model configuration, run persistence, and dataset telemetry.
"""
import asyncio
import os
import shutil
import uuid
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from backend.funnel import FunnelSearchResult, funnel_service, download_image_from_url, validate_url_for_ssrf
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from backend.api.metrics_schema import MetricsResponse, load_metrics_data

MAX_IMAGE_SIZE = 25 * 1024 * 1024  # 25 MB
CHUNK_SIZE = 64 * 1024              # 64 KB


def _secure_destination_path(
    base_dir: str,
    original_filename: str,
    allowed_exts: Tuple[str, ...],
    force_unique: bool = True,
    media_label: str = "file",
) -> Tuple[str, str]:
    """
    Validates file extension, generates a sanitized collision-free server filename,
    and guarantees the canonical destination path resides strictly inside base_dir.
    """
    if not original_filename or not original_filename.strip():
        raise HTTPException(status_code=400, detail="Missing or invalid filename.")

    raw_name = os.path.basename(original_filename.strip().replace("\\", "/"))
    stem, ext = os.path.splitext(raw_name)
    ext = ext.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported {media_label} format {ext}. Supported: {allowed_exts}",
        )

    clean_stem = "".join(c for c in stem if c.isalnum() or c in ("-", "_")).strip()
    clean_stem = clean_stem[:64] if clean_stem else "upload"

    if force_unique:
        unique_id = uuid.uuid4().hex[:8]
        safe_filename = f"{clean_stem}_{unique_id}{ext}"
    else:
        safe_filename = f"{clean_stem}{ext}"
        if os.path.exists(os.path.join(base_dir, safe_filename)):
            safe_filename = f"{clean_stem}_{uuid.uuid4().hex[:8]}{ext}"

    dest_path = os.path.realpath(os.path.join(base_dir, safe_filename))
    base_real = os.path.realpath(base_dir)

    # Strict path traversal validation
    if not (dest_path.startswith(base_real + os.sep) or dest_path == base_real):
        raise HTTPException(status_code=400, detail="Invalid path traversal detected.")

    return dest_path, safe_filename

from backend.database.store import RunsDatabase
from backend.inference.detector import VehicleDetector, get_pretrained_detector
from backend.services.dataset_service import DatasetService
from backend.services.experiments_service import ExperimentsService
from backend.services.media_processor import MediaProcessor

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
MEDIA_ROOT = os.path.join(BASE_DIR, "media")
CHECKPOINTS_DIR = os.path.join(BASE_DIR, "checkpoints")
os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
os.makedirs(os.path.join(MEDIA_ROOT, "uploads"), exist_ok=True)
os.makedirs(os.path.join(MEDIA_ROOT, "outputs"), exist_ok=True)

# Initialize Services
db = RunsDatabase()
detector = VehicleDetector()
media_processor = MediaProcessor(detector=detector, media_root=MEDIA_ROOT)


def resolve_detector(detector_name: Optional[str] = None):
    """Resolves detector instance by name/id. Defaults to CenterNet."""
    d_name = (detector_name or "").strip().lower()
    if d_name in ("pretrained", "faster_rcnn", "fasterrcnn", "coco"):
        try:
            return get_pretrained_detector()
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Pretrained Faster R-CNN detector unavailable: {str(e)}",
            )
    return detector



experiments_service = ExperimentsService()
dataset_service = DatasetService()

# Ensure standard reference benchmark media is available for validation
media_processor.generate_sample_road_media()

app = FastAPI(
    title="Improved CenterNet Vehicle Intelligence API",
    description="Industrial Command Center backend for real-time vehicle detection and traffic analytics",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static media directories
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "service": "Improved CenterNet Vehicle Intelligence Platform",
        "version": "1.0.0",
        "weights_status": detector.model_status,
        "is_weights_loaded": detector.weights_loaded,
    }


@app.get("/api/detectors")
def list_detectors():
    """Returns available detector models."""
    pretrained_avail = True
    try:
        get_pretrained_detector()
    except Exception:
        pretrained_avail = False

    return [
        {
            "id": "centernet",
            "name": "Improved CenterNet (ResNet-18 + CBAM + BiFPN)",
            "available": bool(getattr(detector, "weights_loaded", True)),
            "active": True,
        },
        {
            "id": "pretrained",
            "name": "Pretrained Faster R-CNN (COCO)",
            "available": pretrained_avail,
            "active": False,
        },
    ]


@app.get("/api/model/status")
def get_model_status():
    """Returns current architecture, device, and weights configuration."""
    status = detector.get_system_status()
    # List available checkpoints in checkpoints directory
    available_checkpoints = []
    if os.path.exists(CHECKPOINTS_DIR):
        for f in os.listdir(CHECKPOINTS_DIR):
            if f.endswith((".pth", ".pt")):
                fpath = os.path.join(CHECKPOINTS_DIR, f)
                available_checkpoints.append({
                    "filename": f,
                    "path": fpath,
                    "size_mb": round(os.path.getsize(fpath) / (1024 * 1024), 2),
                })
    status["available_checkpoints"] = available_checkpoints
    return status


class ModelConfigRequest(BaseModel):
    checkpoint_path: Optional[str] = None
    confidence_threshold: Optional[float] = None


@app.post("/api/model/configure")
def configure_model(req: ModelConfigRequest):
    if req.confidence_threshold is not None:
        detector.conf_thresh = max(0.05, min(0.95, req.confidence_threshold))

    reload_res = None
    if req.checkpoint_path:
        reload_res = detector.reload_weights(req.checkpoint_path)

    return {
        "success": True,
        "confidence_threshold": detector.conf_thresh,
        "reload_result": reload_res,
        "status": detector.get_system_status(),
    }


@app.post("/api/model/upload-checkpoint")
async def upload_checkpoint(file: UploadFile = File(...)):
    """Uploads a trained PyTorch model weights checkpoint file (.pth or .pt)."""
    dest_path, safe_filename = _secure_destination_path(
        CHECKPOINTS_DIR, file.filename, (".pth", ".pt"), force_unique=False, media_label="checkpoint"
    )

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=500, detail=f"Failed to save checkpoint: {str(e)}")

    res = detector.reload_weights(dest_path)
    return {
        "success": res["success"],
        "message": res["message"],
        "status": detector.model_status,
        "checkpoint_path": dest_path,
        "file_size_mb": round(os.path.getsize(dest_path) / (1024 * 1024), 2),
    }


def _to_float(val, default: float = 0.35) -> float:
    try:
        return float(val)
    except Exception:
        return default


@app.post("/api/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    conf_thresh: float = Form(0.35),
    run_type: Optional[str] = Form(None),
    detector: Optional[str] = Form("centernet"),
):
    """Processes an uploaded image through Improved CenterNet."""
    conf = _to_float(conf_thresh, 0.35)
    allowed_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    uploads_dir = os.path.join(MEDIA_ROOT, "uploads")
    upload_path, upload_filename = _secure_destination_path(
        uploads_dir, file.filename, allowed_exts, force_unique=True, media_label="image"
    )

    # Stream in chunks with 25MB size limit to prevent memory bloat
    file_size = 0
    try:
        with open(upload_path, "wb") as buffer:
            while chunk := await file.read(CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > MAX_IMAGE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Image file exceeds maximum permitted size of 25 MB.",
                    )
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise
    except Exception as e:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")

    if file_size == 0:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Validate image decoding directly from saved file on disk (no duplicate memory buffering)
    img_bgr = cv2.imread(upload_path)
    if img_bgr is None:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=400, detail="Could not decode uploaded image bytes.")

    input_url = f"/media/uploads/{upload_filename}"
    actual_run_type = run_type or ("test_run" if file.filename.startswith(("test_", "custom_cam")) else "user_upload")
    active_det = resolve_detector(detector)

    try:
        result = await asyncio.to_thread(media_processor.process_image, upload_path, conf_thresh=conf, detector=active_det)
    except Exception as e:
        # Persist failed run for analytics accuracy
        fail_id = f"failed_{uuid.uuid4().hex[:8]}"
        db.save_run(
            run_id=fail_id,
            media_type="image",
            filename=file.filename,
            input_url=input_url,
            annotated_url="",
            model_name=getattr(active_det, "model_name", "Improved CenterNet (ResNet-18 + CBAM + BiFPN)"),
            weights_status="FAILED",
            latency_ms=0.0,
            fps=0.0,
            total_detections=0,
            unique_vehicles=0,
            line_crossings=0,
            class_counts={"car": 0, "van": 0, "bus": 0, "others": 0},
            metadata={
                "error": str(e),
                "error_category": "inference_error",
                "status": "FAILED",
                "run_type": actual_run_type,
            },
            run_type=actual_run_type,
        )
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")

    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    # Persist in SQLite
    saved_run = db.save_run(
        run_id=result["run_id"],
        media_type="image",
        filename=file.filename,
        input_url=input_url,
        annotated_url=annotated_url,
        model_name=result.get("model_name", getattr(active_det, "model_name", "Improved CenterNet (ResNet-18 + CBAM + BiFPN)")),
        weights_status=result["model_status"],
        latency_ms=result["latency_ms"],
        fps=result["fps"],
        total_detections=result["total_detections"],
        unique_vehicles=result["unique_vehicles"],
        line_crossings=0,
        class_counts=result["class_counts"],
        metadata={
            "conf_thresh": conf,
            "execution_mode": result["execution_mode"],
            "checkpoint": result.get("checkpoint"),
            "device": result.get("device_display"),
            "run_type": actual_run_type,
            "detections": result.get("detections", []),
        },
        run_type=actual_run_type,
    )

    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = saved_run
    result["run_type"] = actual_run_type
    return result


@app.post("/api/detect/video")
async def detect_video(
    file: UploadFile = File(...),
    conf_thresh: float = Form(0.35),
    max_frames: int = Form(150),
    frame_stride: int = Form(1),
    run_type: Optional[str] = Form(None),
):
    """Processes an uploaded video frame-by-frame with CenterNet and Multi-Object Tracking."""
    conf = _to_float(conf_thresh, 0.35)
    allowed_exts = (".mp4", ".avi", ".mov", ".mkv", ".webm")
    uploads_dir = os.path.join(MEDIA_ROOT, "uploads")
    upload_path, upload_filename = _secure_destination_path(
        uploads_dir, file.filename, allowed_exts, force_unique=True, media_label="video"
    )

    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=500, detail=f"Video upload error: {str(e)}")

    input_url = f"/media/uploads/{upload_filename}"
    actual_run_type = run_type or ("test_run" if file.filename.startswith(("test_", "custom_cam")) else "user_upload")

    try:
        frames_limit = int(max_frames) if not hasattr(max_frames, "default") else 150
        stride = int(frame_stride) if not hasattr(frame_stride, "default") else 1
        result = await asyncio.to_thread(
            media_processor.process_video,
            video_path=upload_path,
            conf_thresh=conf,
            max_frames=frames_limit,
            frame_stride=stride,
        )
    except ValueError as e:
        fail_id = f"failed_{uuid.uuid4().hex[:8]}"
        db.save_run(
            run_id=fail_id,
            media_type="video",
            filename=file.filename,
            input_url=input_url,
            annotated_url="",
            model_name="Improved CenterNet (ResNet-18 + CBAM + BiFPN)",
            weights_status="FAILED",
            latency_ms=0.0,
            fps=0.0,
            total_detections=0,
            unique_vehicles=0,
            line_crossings=0,
            class_counts={"car": 0, "van": 0, "bus": 0, "others": 0},
            metadata={"error": str(e), "error_category": "invalid_video", "status": "FAILED", "run_type": actual_run_type},
            run_type=actual_run_type,
        )
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")
    except Exception as e:
        fail_id = f"failed_{uuid.uuid4().hex[:8]}"
        db.save_run(
            run_id=fail_id,
            media_type="video",
            filename=file.filename,
            input_url=input_url,
            annotated_url="",
            model_name="Improved CenterNet (ResNet-18 + CBAM + BiFPN)",
            weights_status="FAILED",
            latency_ms=0.0,
            fps=0.0,
            total_detections=0,
            unique_vehicles=0,
            line_crossings=0,
            class_counts={"car": 0, "van": 0, "bus": 0, "others": 0},
            metadata={"error": str(e), "error_category": "inference_error", "status": "FAILED", "run_type": actual_run_type},
            run_type=actual_run_type,
        )
        raise HTTPException(status_code=500, detail=f"Video processing error: {str(e)}")

    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    saved_run = db.save_run(
        run_id=result["run_id"],
        media_type="video",
        filename=file.filename,
        input_url=input_url,
        annotated_url=annotated_url,
        model_name="Improved CenterNet (ResNet-18 + CBAM + BiFPN)",
        weights_status=result["model_status"],
        latency_ms=result["latency_ms"],
        fps=result["fps"],
        total_detections=result["total_detections"],
        unique_vehicles=result["unique_vehicles"],
        line_crossings=result["line_crossings"],
        class_counts=result["class_counts"],
        timeline=result["timeline"],
        metadata={
            "conf_thresh": conf,
            "processed_frames": result["processed_frames"],
            "line_crossings_detail": result["line_crossings_detail"],
            "checkpoint": result.get("checkpoint"),
            "device": result.get("device_display"),
            "run_type": actual_run_type,
            "detections": result.get("detections", []),
        },
        run_type=actual_run_type,
    )

    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = saved_run
    result["run_type"] = actual_run_type
    return result



@app.post("/api/detect/sample")
async def detect_sample(
    request: Request,
    media_type: Optional[str] = None,
    conf_thresh: Optional[float] = None,
    detector: Optional[str] = None,
):
    """Triggers immediate analysis on pre-calibrated sample road footage."""
    m_type = media_type or "image"
    conf_val = conf_thresh if conf_thresh is not None else 0.35

    # Check query params first
    det_param = detector
    if "detector" in request.query_params:
        det_param = request.query_params["detector"]
    if "media_type" in request.query_params:
        m_type = request.query_params["media_type"]
    if "conf_thresh" in request.query_params:
        conf_val = _to_float(request.query_params["conf_thresh"], conf_val)

    # Check body (FormData or JSON)
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            if "detector" in form:
                det_param = str(form["detector"])
            if "media_type" in form:
                m_type = str(form["media_type"])
            if "conf_thresh" in form:
                conf_val = _to_float(form["conf_thresh"], conf_val)
        except Exception:
            pass
    elif "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                if "detector" in body:
                    det_param = str(body["detector"])
                if "media_type" in body:
                    m_type = str(body["media_type"])
                if "conf_thresh" in body:
                    conf_val = _to_float(body["conf_thresh"], conf_val)
        except Exception:
            pass

    conf = _to_float(conf_val, 0.35)
    m_type = str(m_type).lower()
    sample_img_path, sample_vid_path = media_processor.generate_sample_road_media()

    try:
        active_det = resolve_detector(det_param)
        if m_type == "video":
            result = await asyncio.to_thread(
                media_processor.process_video,
                video_path=sample_vid_path,
                conf_thresh=conf,
                max_frames=60,
                detector=active_det,
            )
            filename = "sample_traffic_stream.mp4"
            input_url = "/media/uploads/sample_traffic_stream.mp4"
        else:
            result = await asyncio.to_thread(
                media_processor.process_image,
                image_path=sample_img_path,
                conf_thresh=conf,
                detector=active_det,
            )
            filename = "sample_highway_traffic.jpg"
            input_url = "/media/uploads/sample_highway_traffic.jpg"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample processing error: {str(e)}")

    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    # Reference benchmark samples are evaluated in-memory and isolated from production audit records
    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = None
    result["is_sample"] = True
    result["execution_mode"] = "REFERENCE_BENCHMARK_SAMPLE"
    return result


@app.get("/api/analytics/summary")
def get_analytics_summary():
    return db.get_analytics_summary()


@app.get("/api/experiments")
def get_experiments():
    return {
        "experiments": experiments_service.get_experiments(),
        "baseline_model": "Baseline CenterNet",
        "proposed_model": "Improved CenterNet (Proposed)",
    }


@app.get("/api/experiments/losses")
def get_experiment_losses():
    return experiments_service.get_loss_history()


@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics():
    metrics_path = os.path.join(BASE_DIR, "metrics.json")
    return load_metrics_data(metrics_path)


@app.get("/api/dataset/info")
def get_dataset_info():
    return dataset_service.get_info()


@app.get("/api/runs")
def list_runs(limit: int = 50, media_type: Optional[str] = None):
    return db.list_runs(limit=limit, media_type=media_type)


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or could not be deleted")

    uploads_real = os.path.realpath(os.path.join(MEDIA_ROOT, "uploads"))
    outputs_real = os.path.realpath(os.path.join(MEDIA_ROOT, "outputs"))

    files_to_remove = []
    for key, allowed_dir in [("input_url", uploads_real), ("annotated_url", outputs_real)]:
        url = run.get(key)
        if url and isinstance(url, str):
            clean_rel = url.replace("/media/", "").lstrip("/\\")
            candidate = os.path.realpath(os.path.join(MEDIA_ROOT, clean_rel))
            # Verify candidate path stays strictly inside permitted media directory
            if candidate.startswith(allowed_dir + os.sep):
                basename = os.path.basename(candidate)
                # Never delete shared sample benchmark media
                if not basename.startswith("sample_"):
                    files_to_remove.append(candidate)

    # Delete database record first
    success = db.delete_run(run_id)
    if not success:
        raise HTTPException(status_code=500, detail="Database deletion failed.")

    # Safely remove owned files
    for fpath in files_to_remove:
        try:
            if os.path.exists(fpath):
                os.remove(fpath)
        except OSError:
            pass

    return {"success": True, "deleted_id": run_id}


@app.get("/api/funnel/search", response_model=FunnelSearchResult)
async def funnel_search(
    request: Request,
    q: str = Query("traffic bus street", description="Search query"),
    source: str = Query("both", description="Source provider: openverse, commons, or both"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=30, description="Results limit (max 30)"),
):
    """Searches open-licensed images from Openverse and/or Wikimedia Commons."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        return await funnel_service.search(
            query=q,
            source=source,
            page=page,
            limit=limit,
            client_ip=client_ip,
        )
    except Exception as e:
        return FunnelSearchResult(
            query=q,
            source=source,
            page=page,
            limit=limit,
            total=0,
            images=[],
            results=[],
            error=str(e),
            errors={"service": str(e)},
        )


class FunnelItemInput(BaseModel):
    image_url: str
    title: Optional[str] = None
    creator: Optional[str] = None
    license: Optional[str] = None
    source_page_url: Optional[str] = None


class FunnelBatchRequest(BaseModel):
    image_urls: List[str] = []
    items: Optional[List[FunnelItemInput]] = None
    detector: Optional[str] = None
    conf_thresh: Optional[float] = 0.35


@app.post("/api/detect/url")
async def detect_url(
    url: str = Form(...),
    conf_thresh: float = Form(0.35),
    run_type: Optional[str] = Form(None),
    detector: Optional[str] = Form("centernet"),
):
    """Processes an image from a remote URL with SSRF protection."""
    conf = _to_float(conf_thresh, 0.35)
    uploads_dir = os.path.join(MEDIA_ROOT, "uploads")
    local_path = await download_image_from_url(url, uploads_dir)
    filename = os.path.basename(local_path)
    input_url = f"/media/uploads/{filename}"
    actual_run_type = run_type or "url_download"
    active_det = resolve_detector(detector)

    try:
        result = await asyncio.to_thread(media_processor.process_image, local_path, conf_thresh=conf, detector=active_det)
    except Exception as e:
        fail_id = f"failed_{uuid.uuid4().hex[:8]}"
        db.save_run(
            run_id=fail_id,
            media_type="image",
            filename=filename,
            input_url=input_url,
            annotated_url="",
            model_name=getattr(active_det, "model_name", "Improved CenterNet (ResNet-18 + CBAM + BiFPN)"),
            weights_status="FAILED",
            latency_ms=0.0,
            fps=0.0,
            total_detections=0,
            unique_vehicles=0,
            line_crossings=0,
            class_counts={"car": 0, "van": 0, "bus": 0, "others": 0},
            metadata={"error": str(e), "status": "FAILED", "run_type": actual_run_type, "source_url": url},
            run_type=actual_run_type,
            source="url",
            source_url=url,
        )
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")

    annotated_url = f"/media/outputs/{result['annotated_filename']}"
    saved_run = db.save_run(
        run_id=result["run_id"],
        media_type="image",
        filename=filename,
        input_url=input_url,
        annotated_url=annotated_url,
        model_name=result.get("model_name", getattr(active_det, "model_name", "Improved CenterNet (ResNet-18 + CBAM + BiFPN)")),
        weights_status=result["model_status"],
        latency_ms=result["latency_ms"],
        fps=result["fps"],
        total_detections=result["total_detections"],
        unique_vehicles=result["unique_vehicles"],
        line_crossings=0,
        class_counts=result["class_counts"],
        metadata={
            "conf_thresh": conf,
            "execution_mode": result["execution_mode"],
            "checkpoint": result.get("checkpoint"),
            "device": result.get("device_display"),
            "run_type": actual_run_type,
            "source_url": url,
            "detections": result.get("detections", []),
        },
        run_type=actual_run_type,
        source="url",
        source_url=url,
    )

    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = saved_run
    result["run_type"] = actual_run_type
    return result


@app.post("/api/funnel/detect-batch")
async def funnel_detect_batch(batch_req: FunnelBatchRequest):
    """Batch-runs vehicle detection on open-licensed funnel images with limited concurrency (3)."""
    input_items: List[FunnelItemInput] = []
    if batch_req.items:
        input_items = list(batch_req.items)
    elif batch_req.image_urls:
        input_items = [FunnelItemInput(image_url=u) for u in batch_req.image_urls]

    if not input_items:
        raise HTTPException(status_code=400, detail="No image URLs provided in batch request.")

    if len(input_items) > 20:
        raise HTTPException(status_code=400, detail="Maximum batch size is 20 images.")

    semaphore = asyncio.Semaphore(3)
    uploads_dir = os.path.join(MEDIA_ROOT, "uploads")
    conf = _to_float(batch_req.conf_thresh, 0.35)
    active_det = resolve_detector(batch_req.detector)

    async def process_single(item: FunnelItemInput) -> Dict:
        async with semaphore:
            try:
                local_path = await download_image_from_url(item.image_url, uploads_dir)
                filename = os.path.basename(local_path)
                input_url = f"/media/uploads/{filename}"

                result = await asyncio.to_thread(media_processor.process_image, local_path, conf_thresh=conf, detector=active_det)
                annotated_url = f"/media/outputs/{result['annotated_filename']}"

                saved_run = db.save_run(
                    run_id=result["run_id"],
                    media_type="image",
                    filename=filename,
                    input_url=input_url,
                    annotated_url=annotated_url,
                    model_name=result.get("model_name", getattr(active_det, "model_name", "Improved CenterNet (ResNet-18 + CBAM + BiFPN)")),
                    weights_status=result["model_status"],
                    latency_ms=result["latency_ms"],
                    fps=result["fps"],
                    total_detections=result["total_detections"],
                    unique_vehicles=result["unique_vehicles"],
                    line_crossings=0,
                    class_counts=result["class_counts"],
                    metadata={
                        "conf_thresh": conf,
                        "execution_mode": result["execution_mode"],
                        "checkpoint": result.get("checkpoint"),
                        "device": result.get("device_display"),
                        "run_type": "funnel",
                        "source": "funnel",
                        "source_url": item.image_url,
                        "creator": item.creator,
                        "license": item.license,
                        "source_page_url": item.source_page_url,
                        "title": item.title,
                        "detections": result.get("detections", []),
                    },
                    run_type="funnel",
                    source="funnel",
                    source_url=item.image_url,
                    creator=item.creator,
                    license=item.license,
                    source_page_url=item.source_page_url,
                )

                return {
                    "image_url": item.image_url,
                    "status": "success",
                    "run_id": result["run_id"],
                    "input_url": input_url,
                    "annotated_url": annotated_url,
                    "total_detections": result["total_detections"],
                    "unique_vehicles": result["unique_vehicles"],
                    "class_counts": result["class_counts"],
                    "latency_ms": result["latency_ms"],
                    "fps": result["fps"],
                    "title": item.title,
                    "creator": item.creator,
                    "license": item.license,
                    "source_page_url": item.source_page_url,
                    "detections": result.get("detections", []),
                    "saved_run": saved_run,
                }
            except Exception as e:
                return {
                    "image_url": item.image_url,
                    "status": "failed",
                    "error": str(e),
                    "title": item.title,
                    "creator": item.creator,
                    "license": item.license,
                    "source_page_url": item.source_page_url,
                }

    tasks = [process_single(item) for item in input_items]
    results = await asyncio.gather(*tasks)

    return {
        "total": len(input_items),
        "successful": sum(1 for r in results if r["status"] == "success"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "results": results,
    }
