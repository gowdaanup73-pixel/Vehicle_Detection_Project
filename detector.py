"""
UVH-26 YOLOv11-S Vehicle Detection & Multi-Object Tracking Pipeline
Pre-trained model from Hugging Face: iisc-aim/UVH-26 (for Indian/dense traffic)
with automatic fallback to yolo11s.pt (COCO classes [2, 3, 5, 7]).
Supports singleton model loading, photo prediction, and video tracking.
"""
import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
import torch
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

# Global singleton storage
_CACHED_MODEL: Optional[YOLO] = None
_MODEL_CONFIG: Dict[str, any] = {}

UVH_REPO_ID = "iisc-aim/UVH-26"
PRIMARY_HF_FILENAME = "YOLOv11-S/UVH-26-MV/UVH-26-MV-YOLOv11-S.pt"
FALLBACK_HF_FILENAME = "weights/YOLOv11-S/UVH-26-MV/UVH-26-MV-YOLOv11-S.pt"
COCO_FALLBACK_WEIGHTS = "yolo11s.pt"
COCO_VEHICLE_CLASSES = [2, 3, 5, 7]  # car, motorcycle, bus, truck

UVH_TO_CANONICAL = {
    "hatchback": ("car", 0),
    "sedan": ("car", 0),
    "suv": ("car", 0),
    "muv": ("car", 0),
    "bus": ("bus", 1),
    "truck": ("van", 2),
    "three-wheeler": ("others", 3),
    "two-wheeler": ("others", 3),
    "lcv": ("van", 2),
    "mini-bus": ("bus", 1),
    "tempo-traveller": ("van", 2),
    "bicycle": ("others", 3),
    "van": ("van", 2),
    "others": ("others", 3),
}

COCO_TO_CANONICAL = {
    2: ("car", "car", 0),
    3: ("motorcycle", "others", 3),
    5: ("bus", "bus", 1),
    7: ("truck", "van", 2),
}


def get_model() -> Tuple[YOLO, Dict[str, any]]:
    """
    Singleton model loader: loads weights only once into memory.
    1. Primary: Hugging Face iisc-aim/UVH-26 (YOLOv11-S/UVH-26-MV/UVH-26-MV-YOLOv11-S.pt)
    2. Fallback 1: weights/YOLOv11-S/UVH-26-MV/UVH-26-MV-YOLOv11-S.pt
    3. Fallback 2: YOLO('yolo11s.pt') with COCO classes [2, 3, 5, 7]
    """
    global _CACHED_MODEL, _MODEL_CONFIG
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL, _MODEL_CONFIG

    model = None
    weights_path = None
    source_tag = ""
    is_coco_fallback = False

    # 0. Check local repository checkpoints first (instant zero-latency load)
    local_candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "checkpoints", "UVH-26-MV-YOLOv11-S.pt"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints", "UVH-26-MV-YOLOv11-S.pt"),
    ]
    for loc in local_candidates:
        if os.path.exists(loc) and os.path.getsize(loc) > 1024 * 1024:
            try:
                model = YOLO(loc)
                weights_path = loc
                source_tag = "LOCAL_HF_UVH26_CHECKPOINT"
                break
            except Exception:
                continue

    # 1. Try Hugging Face paths if not found locally
    if model is None:
        candidate_filenames = [
            "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt",
            PRIMARY_HF_FILENAME,
            FALLBACK_HF_FILENAME,
        ]
        for fn in candidate_filenames:
            try:
                weights_path = hf_hub_download(repo_id=UVH_REPO_ID, filename=fn)
                model = YOLO(weights_path)
                source_tag = f"HF_UVH26 ({fn})"
                break
            except Exception:
                continue

    if model is None:
        # 3. Fallback to standard yolo11s.pt with COCO classes [2, 3, 5, 7]
        weights_path = COCO_FALLBACK_WEIGHTS
        model = YOLO(weights_path)
        source_tag = "YOLO11S_COCO_FALLBACK"
        is_coco_fallback = True

    _CACHED_MODEL = model
    _MODEL_CONFIG = {
        "source_tag": source_tag,
        "weights_path": weights_path,
        "is_coco_fallback": is_coco_fallback,
        "classes": COCO_VEHICLE_CLASSES if is_coco_fallback else None,
        "model_name": "UVH-26 YOLOv11-S (iisc-aim/UVH-26)" if not is_coco_fallback else "YOLO11-S (COCO Fallback)",
        "header_tag": "YOLOV11-S // IISC-AIM UVH-26" if not is_coco_fallback else "YOLOV11-S // COCO PRETRAINED",
    }
    return _CACHED_MODEL, _MODEL_CONFIG


def predict_photo(
    source: Union[str, np.ndarray],
    conf: float = 0.25,
    output_path: Optional[str] = None,
    device: Optional[Union[int, str]] = None,
) -> Dict[str, any]:
    """
    Photo inference: runs model.predict, returns/saves annotated image results[0].plot()
    plus detailed class counts and bounding boxes.
    """
    model, cfg = get_model()
    dev = device if device is not None else (0 if torch.cuda.is_available() else "cpu")

    predict_kwargs = {"conf": conf, "device": dev, "verbose": False}
    if cfg["is_coco_fallback"]:
        predict_kwargs["classes"] = cfg["classes"]

    results = model.predict(source, **predict_kwargs)
    res = results[0]
    annotated_img = res.plot()

    class_counts: Dict[str, int] = {}
    canonical_counts: Dict[str, int] = {"car": 0, "van": 0, "bus": 0, "others": 0}
    detections: List[Dict[str, any]] = []

    if res.boxes is not None and len(res.boxes) > 0:
        boxes = res.boxes
        for i in range(len(boxes)):
            box = boxes.xyxy[i].cpu().numpy().tolist()
            cls_id = int(boxes.cls[i].cpu().numpy())
            score = float(boxes.conf[i].cpu().numpy())
            raw_class_name = model.names.get(cls_id, str(cls_id)) if hasattr(model, "names") else str(cls_id)

            # Map to canonical 4 vehicle classes
            if cfg["is_coco_fallback"]:
                _, canon_name, canon_id = COCO_TO_CANONICAL.get(cls_id, (raw_class_name, "others", 3))
            else:
                canon_name, canon_id = UVH_TO_CANONICAL.get(raw_class_name.lower().strip(), ("others", 3))

            class_counts[raw_class_name] = class_counts.get(raw_class_name, 0) + 1
            canonical_counts[canon_name] = canonical_counts.get(canon_name, 0) + 1

            detections.append({
                "bbox": [round(b, 2) for b in box],
                "score": round(score, 4),
                "confidence": round(score, 4),
                "class_id": int(canon_id),
                "class_name": canon_name,
                "raw_class_name": raw_class_name,
                "raw_class_id": cls_id,
            })

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cv2.imwrite(output_path, annotated_img)

    return {
        "annotated_image": annotated_img,
        "output_path": output_path,
        "detections": detections,
        "total_detections": len(detections),
        "class_counts": class_counts,
        "canonical_counts": canonical_counts,
        "model_name": cfg["model_name"],
        "header_tag": cfg["header_tag"],
        "weights_path": cfg["weights_path"],
    }


def track_video(
    source: Union[str, int],
    conf: float = 0.25,
    output_path: Optional[str] = None,
    tracker: str = "bytetrack.yaml",
    device: Optional[Union[int, str]] = None,
    max_frames: Optional[int] = None,
    frame_stride: int = 1,
) -> Dict[str, any]:
    """
    Video inference: uses model.track over cv2.VideoCapture frames,
    drawing bounding boxes, track IDs, and live vehicle counts per class,
    and saving the processed output video.
    """
    model, cfg = get_model()
    dev = device if device is not None else (0 if torch.cuda.is_available() else "cpu")

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise ValueError(f"Could not open video source at {source}")

    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if not output_path:
        source_stem = Path(str(source)).stem if isinstance(source, (str, Path)) else "stream"
        output_path = f"{source_stem}_uvh26_annotated.mp4"

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    out_fps = max(1.0, fps_in / max(1, frame_stride))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_writer = cv2.VideoWriter(output_path, fourcc, out_fps, (orig_w, orig_h))

    track_kwargs = {
        "conf": conf,
        "tracker": tracker,
        "stream": True,
        "device": dev,
        "persist": True,
        "verbose": False,
    }
    if cfg["is_coco_fallback"]:
        track_kwargs["classes"] = cfg["classes"]

    frame_idx = 0
    processed_count = 0
    unique_track_ids = set()
    overall_class_counts: Dict[str, int] = {}
    frame_timeline = []

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_stride != 0:
                frame_idx += 1
                continue

            if max_frames and processed_count >= max_frames:
                break

            # Frame-by-frame inference using model.track with stream=True
            track_results = model.track(frame, **track_kwargs)
            res = next(iter(track_results)) if hasattr(track_results, "__iter__") else track_results

            annotated_frame = res.plot()
            live_counts: Dict[str, int] = {}
            frame_detections: List[Dict[str, any]] = []

            if res.boxes is not None and len(res.boxes) > 0:
                boxes = res.boxes
                for i in range(len(boxes)):
                    box = boxes.xyxy[i].cpu().numpy().tolist()
                    cls_id = int(boxes.cls[i].cpu().numpy())
                    score = float(boxes.conf[i].cpu().numpy())
                    raw_name = model.names.get(cls_id, str(cls_id)) if hasattr(model, "names") else str(cls_id)

                    track_id = None
                    if boxes.id is not None:
                        try:
                            track_id = int(boxes.id[i].cpu().numpy())
                            unique_track_ids.add(track_id)
                        except Exception:
                            track_id = None

                    if cfg["is_coco_fallback"]:
                        _, canon_name, canon_id = COCO_TO_CANONICAL.get(cls_id, (raw_name, "others", 3))
                    else:
                        canon_name, canon_id = UVH_TO_CANONICAL.get(raw_name.lower().strip(), ("others", 3))

                    live_counts[canon_name] = live_counts.get(canon_name, 0) + 1
                    overall_class_counts[canon_name] = overall_class_counts.get(canon_name, 0) + 1

                    frame_detections.append({
                        "bbox": [round(b, 2) for b in box],
                        "score": round(score, 4),
                        "class_id": int(canon_id),
                        "class_name": canon_name,
                        "raw_class_name": raw_name,
                        "track_id": track_id,
                    })

            # Overlay tactical live vehicle counts and tracker HUD
            badge = " | ".join(f"{k.upper()}: {v}" for k, v in sorted(live_counts.items())) if live_counts else "NONE"
            hud_text = f"LIVE VEHICLES: {badge}  [ACTIVE TRACKS: {len(unique_track_ids)}]"
            cv2.putText(
                annotated_frame,
                hud_text,
                (20, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                annotated_frame,
                f"{cfg['header_tag']} // FRAME #{frame_idx}",
                (20, orig_h - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (212, 226, 233),
                1,
                cv2.LINE_AA,
            )

            out_writer.write(annotated_frame)

            frame_timeline.append({
                "frame": frame_idx,
                "timestamp_sec": round(frame_idx / max(1.0, fps_in), 2),
                "active_detections": len(frame_detections),
                "unique_vehicles": len(unique_track_ids),
                "live_counts": live_counts,
            })

            frame_idx += 1
            processed_count += 1
    finally:
        cap.release()
        out_writer.release()

    return {
        "output_path": output_path,
        "processed_frames": processed_count,
        "total_video_frames": total_video_frames,
        "unique_vehicles": len(unique_track_ids),
        "class_counts": overall_class_counts,
        "timeline": frame_timeline,
        "model_name": cfg["model_name"],
        "header_tag": cfg["header_tag"],
    }


def main():
    parser = argparse.ArgumentParser(
        description="UVH-26 YOLOv11-S Vehicle Detection & Multi-Object Tracking (Hugging Face / YOLO11s fallback)"
    )
    parser.add_argument("--source", type=str, required=True, help="Path to input photo or video file")
    parser.add_argument("--output", type=str, default=None, help="Path for output annotated media")
    parser.add_argument("--conf", type=float, default=0.40, help="Confidence threshold (default: 0.40)")
    parser.add_argument("--tracker", type=str, default="bytetrack.yaml", help="Tracker config (default: bytetrack.yaml)")
    parser.add_argument("--device", type=str, default=None, help="Inference device (e.g. 0 or cpu)")
    parser.add_argument("--max-frames", type=int, default=None, help="Max video frames to process")
    args = parser.parse_args()

    source_path = args.source
    if not os.path.exists(source_path):
        print(f"Error: Source file '{source_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    ext = Path(source_path).suffix.lower()
    video_exts = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

    if ext in video_exts:
        print(f"Running video tracking on {source_path} (conf={args.conf})...")
        res = track_video(
            source=source_path,
            conf=args.conf,
            output_path=args.output,
            tracker=args.tracker,
            device=args.device,
            max_frames=args.max_frames,
        )
        print(f"Tracking complete: {res['processed_frames']} frames, {res['unique_vehicles']} unique vehicles.")
        print(f"Annotated video saved to: {res['output_path']}")
    else:
        print(f"Running photo inference on {source_path} (conf={args.conf})...")
        res = predict_photo(
            source=source_path,
            conf=args.conf,
            output_path=args.output,
            device=args.device,
        )
        print(f"Inference complete: {res['total_detections']} detections found.")
        print(f"Class counts: {res['class_counts']}")
        if res["output_path"]:
            print(f"Annotated image saved to: {res['output_path']}")


if __name__ == "__main__":
    main()
