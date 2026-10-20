"""
FastAPI Backend Application
Exposes REST endpoints for vehicle detection, video tracking analytics,
model configuration, run persistence, and dataset telemetry.
"""
import asyncio
import os
import shutil
import uuid
from typing import Dict, List, Optional
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.database.store import RunsDatabase
from backend.inference.detector import VehicleDetector
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
experiments_service = ExperimentsService()
dataset_service = DatasetService()

# Pre-generate sample road media for instant one-click demonstration
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
    if not (file.filename.endswith(".pth") or file.filename.endswith(".pt")):
        raise HTTPException(status_code=400, detail="Only .pth or .pt checkpoint files are accepted.")

    dest_path = os.path.join(CHECKPOINTS_DIR, file.filename)
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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
):
    """Processes an uploaded image through Improved CenterNet."""
    conf = _to_float(conf_thresh, 0.35)
    allowed_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported image format {ext}. Supported: {allowed_exts}")

    upload_id = uuid.uuid4().hex[:8]
    upload_filename = f"{upload_id}_{file.filename}"
    upload_path = os.path.join(MEDIA_ROOT, "uploads", upload_filename)

    contents = await file.read()
    if not contents or len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with open(upload_path, "wb") as buffer:
        buffer.write(contents)

    # Validate image bytes decoding
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode uploaded image bytes.")

    try:
        result = await asyncio.to_thread(media_processor.process_image, upload_path, conf_thresh=conf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")

    input_url = f"/media/uploads/{upload_filename}"
    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    actual_run_type = run_type or ("test_run" if file.filename.startswith(("test_", "custom_cam")) else "user_upload")

    # Persist in SQLite
    saved_run = db.save_run(
        run_id=result["run_id"],
        media_type="image",
        filename=file.filename,
        input_url=input_url,
        annotated_url=annotated_url,
        model_name="Improved CenterNet (ResNet-18 + CBAM + BiFPN)",
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
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported video format {ext}. Supported: {allowed_exts}")

    upload_id = uuid.uuid4().hex[:8]
    upload_filename = f"{upload_id}_{file.filename}"
    upload_path = os.path.join(MEDIA_ROOT, "uploads", upload_filename)

    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video processing error: {str(e)}")

    input_url = f"/media/uploads/{upload_filename}"
    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    actual_run_type = run_type or ("test_run" if file.filename.startswith(("test_", "custom_cam")) else "user_upload")

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
        },
        run_type=actual_run_type,
    )

    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = saved_run
    result["run_type"] = actual_run_type
    return result



@app.post("/api/detect/sample")
async def detect_sample(media_type: str = "image", conf_thresh: float = 0.35):
    """Triggers immediate analysis on pre-calibrated sample road footage."""
    conf = _to_float(conf_thresh, 0.35)
    m_type = str(media_type).lower()
    sample_img_path, sample_vid_path = media_processor.generate_sample_road_media()

    try:
        if m_type == "video":
            result = await asyncio.to_thread(
                media_processor.process_video,
                video_path=sample_vid_path,
                conf_thresh=conf,
                max_frames=60,
            )
            filename = "sample_traffic_stream.mp4"
            input_url = "/media/uploads/sample_traffic_stream.mp4"
        else:
            result = await asyncio.to_thread(
                media_processor.process_image,
                image_path=sample_img_path,
                conf_thresh=conf,
            )
            filename = "sample_highway_traffic.jpg"
            input_url = "/media/uploads/sample_highway_traffic.jpg"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample processing error: {str(e)}")

    annotated_url = f"/media/outputs/{result['annotated_filename']}"

    # Explicitly do NOT insert demo sample runs into production audit history
    result["input_url"] = input_url
    result["annotated_url"] = annotated_url
    result["saved_run"] = None
    result["is_sample"] = True
    result["execution_mode"] = "PRE_CALIBRATED_DEMO_SAMPLE"
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
    success = db.delete_run(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Run not found or could not be deleted")
    return {"success": True, "deleted_id": run_id}
