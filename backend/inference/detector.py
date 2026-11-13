"""
Vehicle Detection Inference Pipeline
Integrates Hugging Face pre-trained model iisc-aim/UVH-26 (YOLOv11-S for Indian/dense traffic)
with automatic fallback to yolo11s.pt (COCO classes [2, 3, 5, 7]).
Also preserves Legacy CenterNet and Faster R-CNN backends for backward compatibility.
"""
import os
import platform
import time
from typing import Dict, List, Optional, Tuple, Union
import cv2
import numpy as np
import torch

from detector import (
    get_model as get_uvh_model,
    predict_photo as uvh_predict_photo,
    track_video as uvh_track_video,
    UVH_TO_CANONICAL,
    COCO_TO_CANONICAL,
    COCO_VEHICLE_CLASSES,
)

from backend.models.centernet import ImprovedCenterNet, VEHICLE_CLASSES, decode_centernet

DEFAULT_CHECKPOINT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "checkpoints")
PRIMARY_CHECKPOINT_NAME = "improved_v2_best.pth"
DEFAULT_WEIGHTS_PATH = os.path.join(DEFAULT_CHECKPOINT_DIR, PRIMARY_CHECKPOINT_NAME)


class UVH26VehicleDetector:
    """
    Primary Vehicle Detector powered by Hugging Face iisc-aim/UVH-26 (YOLOv11-S)
    with singleton model caching and automatic fallback to yolo11s.pt.
    Supports both photo inference and video multi-object tracking.
    """
    def __init__(self, default_conf_thresh: float = 0.40):
        self.conf_thresh = default_conf_thresh
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.weights_loaded = True
        self.model_status = "CONFIGURED_ACTIVE"
        self.last_load_error: Optional[str] = None
        self.is_yolo = True

        # Load / retrieve singleton model
        self.model, self.cfg = get_uvh_model()
        self.model_name = self.cfg.get("model_name", "UVH-26 YOLOv11-S (iisc-aim/UVH-26)")
        self.header_tag = self.cfg.get("header_tag", "YOLOV11-S // IISC-AIM UVH-26")
        self.checkpoint_path = str(self.cfg.get("weights_path", "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt"))

    def reload_weights(self, checkpoint_path: str) -> Dict[str, any]:
        """Allows reloading custom or alternative YOLO weights."""
        from ultralytics import YOLO
        try:
            abs_p = os.path.abspath(checkpoint_path)
            if not os.path.exists(abs_p):
                return {"success": False, "status": "ERROR_NOT_FOUND", "message": f"File {abs_p} not found."}
            self.model = YOLO(abs_p)
            self.checkpoint_path = abs_p
            self.weights_loaded = True
            self.model_status = "CONFIGURED_ACTIVE"
            return {"success": True, "status": self.model_status, "checkpoint_path": self.checkpoint_path}
        except Exception as e:
            return {"success": False, "status": "LOAD_ERROR", "message": str(e)}

    def get_system_status(self) -> Dict[str, any]:
        is_cuda = torch.cuda.is_available()
        cpu_info = platform.processor() or "Host CPU"
        device_display = f"CUDA ({torch.cuda.get_device_name(0)})" if is_cuda else f"CPU ({cpu_info})"
        return {
            "model_name": self.model_name,
            "architecture": {
                "backbone": "YOLOv11-S",
                "repository": "iisc-aim/UVH-26",
                "source": self.cfg.get("source_tag", "HF_UVH26"),
                "classes": VEHICLE_CLASSES,
                "input_resolution": "512x288",
                "downsample_ratio": 4,
                "is_coco_fallback": self.cfg.get("is_coco_fallback", False),
            },
            "device": str(self.device),
            "device_display": device_display,
            "is_cuda_available": is_cuda,
            "gpu_name": torch.cuda.get_device_name(0) if is_cuda else "None (CPU Execution)",
            "weights_loaded": self.weights_loaded,
            "model_status": self.model_status,
            "checkpoint_path": self.checkpoint_path,
            "checkpoint_name": os.path.basename(self.checkpoint_path),
            "confidence_threshold": self.conf_thresh,
        }

    def detect(self, img_bgr: np.ndarray, conf_thresh: Optional[float] = None) -> Dict[str, any]:
        """
        Photo inference using YOLOv11 model.predict.
        Returns detections with bounding boxes, scores, and canonical vehicle class mappings.
        """
        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        t0 = time.perf_counter()

        predict_kwargs = {
            "conf": conf,
            "device": 0 if torch.cuda.is_available() else "cpu",
            "verbose": False,
        }
        if self.cfg.get("is_coco_fallback"):
            predict_kwargs["classes"] = COCO_VEHICLE_CLASSES

        results = self.model.predict(img_bgr, **predict_kwargs)
        res = results[0]
        orig_h, orig_w = img_bgr.shape[:2]

        detections: List[Dict[str, any]] = []
        class_counts = {"car": 0, "van": 0, "bus": 0, "others": 0}

        if res.boxes is not None and len(res.boxes) > 0:
            boxes = res.boxes
            for i in range(len(boxes)):
                box = boxes.xyxy[i].cpu().numpy().tolist()
                cls_id = int(boxes.cls[i].cpu().numpy())
                score = float(boxes.conf[i].cpu().numpy())
                raw_name = self.model.names.get(cls_id, str(cls_id)) if hasattr(self.model, "names") else str(cls_id)

                if self.cfg.get("is_coco_fallback"):
                    _, canon_name, canon_id = COCO_TO_CANONICAL.get(cls_id, (raw_name, "others", 3))
                else:
                    canon_name, canon_id = UVH_TO_CANONICAL.get(raw_name.lower().strip(), ("others", 3))

                # Clamp box to valid image bounds
                x1 = max(0.0, min(float(box[0]), float(orig_w)))
                y1 = max(0.0, min(float(box[1]), float(orig_h)))
                x2 = max(x1, min(float(box[2]), float(orig_w)))
                y2 = max(y1, min(float(box[3]), float(orig_h)))

                class_counts[canon_name] = class_counts.get(canon_name, 0) + 1
                detections.append({
                    "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                    "score": round(score, 4),
                    "confidence": round(score, 4),
                    "class_id": int(canon_id),
                    "class_name": canon_name,
                    "raw_class_name": raw_name,
                })

        latency_ms = max(0.1, round((time.perf_counter() - t0) * 1000.0, 2))
        annotated_plot = res.plot()

        return {
            "detections": detections,
            "total_detections": len(detections),
            "latency_ms": latency_ms,
            "model_status": self.model_status,
            "is_trained_weights_loaded": True,
            "execution_mode": "YOLOV11_UVH26_HF" if not self.cfg.get("is_coco_fallback") else "YOLOV11_COCO_FALLBACK",
            "model_name": self.model_name,
            "header_tag": self.header_tag,
            "checkpoint": os.path.basename(self.checkpoint_path),
            "class_counts": class_counts,
            "annotated_plot": annotated_plot,
        }

    def track_frame(self, frame: np.ndarray, conf_thresh: Optional[float] = None, tracker: str = "bytetrack.yaml") -> Dict[str, any]:
        """Runs model.track on a single frame in persistent stream mode."""
        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        track_kwargs = {
            "conf": conf,
            "tracker": tracker,
            "stream": True,
            "device": 0 if torch.cuda.is_available() else "cpu",
            "persist": True,
            "verbose": False,
        }
        if self.cfg.get("is_coco_fallback"):
            track_kwargs["classes"] = COCO_VEHICLE_CLASSES

        results = self.model.track(frame, **track_kwargs)
        res = next(iter(results)) if hasattr(results, "__iter__") else results
        orig_h, orig_w = frame.shape[:2]

        detections = []
        tracked_items = []
        live_counts = {"car": 0, "van": 0, "bus": 0, "others": 0}

        if res.boxes is not None and len(res.boxes) > 0:
            boxes = res.boxes
            for i in range(len(boxes)):
                box = boxes.xyxy[i].cpu().numpy().tolist()
                cls_id = int(boxes.cls[i].cpu().numpy())
                score = float(boxes.conf[i].cpu().numpy())
                raw_name = self.model.names.get(cls_id, str(cls_id)) if hasattr(self.model, "names") else str(cls_id)

                track_id = None
                if boxes.id is not None:
                    try:
                        track_id = int(boxes.id[i].cpu().numpy())
                    except Exception:
                        track_id = None

                if self.cfg.get("is_coco_fallback"):
                    _, canon_name, canon_id = COCO_TO_CANONICAL.get(cls_id, (raw_name, "others", 3))
                else:
                    canon_name, canon_id = UVH_TO_CANONICAL.get(raw_name.lower().strip(), ("others", 3))

                x1 = max(0.0, min(float(box[0]), float(orig_w)))
                y1 = max(0.0, min(float(box[1]), float(orig_h)))
                x2 = max(x1, min(float(box[2]), float(orig_w)))
                y2 = max(y1, min(float(box[3]), float(orig_h)))

                live_counts[canon_name] = live_counts.get(canon_name, 0) + 1
                det_dict = {
                    "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                    "score": round(score, 4),
                    "confidence": round(score, 4),
                    "class_id": int(canon_id),
                    "class_name": canon_name,
                    "raw_class_name": raw_name,
                    "track_id": track_id,
                }
                detections.append(det_dict)
                tracked_items.append(det_dict)

        annotated_frame = res.plot()
        return {
            "detections": detections,
            "tracked": tracked_items,
            "live_counts": live_counts,
            "annotated_frame": annotated_frame,
        }


# Set VehicleDetector to UVH26VehicleDetector by default
VehicleDetector = UVH26VehicleDetector


class LegacyCenterNetDetector:
    """Legacy CenterNet Detector for backward compatibility."""
    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        input_size: Tuple[int, int] = (512, 288),
        default_conf_thresh: float = 0.35,
    ):
        self.input_size = input_size
        self.conf_thresh = default_conf_thresh
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32, device=self.device).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32, device=self.device).view(1, 3, 1, 1)

        chosen_path = checkpoint_path or DEFAULT_WEIGHTS_PATH
        if not os.path.exists(chosen_path):
            alt_path = os.path.join(DEFAULT_CHECKPOINT_DIR, "improved_v2_best.pth")
            if os.path.exists(alt_path):
                chosen_path = alt_path

        self.checkpoint_path = chosen_path
        self.model_name = "Improved CenterNet (ResNet-18 + CBAM + BiFPN)"
        self.header_tag = "IMPROVED CENTERNET [RESNET-18 + CBAM + BIFPN] // UA-DETRAC"
        self.weights_loaded = False
        self.model_status = "INITIALIZING"
        self.last_load_error: Optional[str] = None

        self.model = ImprovedCenterNet(num_classes=len(VEHICLE_CLASSES), feature_dim=64).to(self.device)
        self.model.eval()
        self.reload_weights(self.checkpoint_path)

    def reload_weights(self, checkpoint_path: str) -> Dict[str, any]:
        self.checkpoint_path = os.path.abspath(checkpoint_path)
        if not os.path.exists(self.checkpoint_path):
            self.weights_loaded = False
            self.model_status = "UNCONFIGURED_WEIGHTS_NOT_FOUND"
            self.last_load_error = f"Checkpoint file '{self.checkpoint_path}' does not exist on disk."
            return {"success": False, "status": self.model_status, "message": self.last_load_error}

        try:
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=True)
            if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
            elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            elif isinstance(checkpoint, dict) and "model" in checkpoint:
                state_dict = checkpoint["model"]
            else:
                state_dict = checkpoint

            load_result = self.model.load_state_dict(state_dict, strict=True)
            self.model.eval()
            self.weights_loaded = True
            self.model_status = "CONFIGURED_ACTIVE"
            self.last_load_error = None
            return {"success": True, "status": self.model_status, "load_result": str(load_result)}
        except Exception as e:
            self.weights_loaded = False
            self.model_status = "LOAD_ERROR"
            self.last_load_error = str(e)
            return {"success": False, "status": self.model_status, "message": str(e)}

    def get_system_status(self) -> Dict[str, any]:
        is_cuda = torch.cuda.is_available()
        cpu_info = platform.processor() or "Host CPU"
        device_display = f"CUDA ({torch.cuda.get_device_name(0)})" if is_cuda else f"CPU ({cpu_info})"
        return {
            "model_name": self.model_name,
            "architecture": {
                "backbone": "ResNet-18",
                "attention_module": "CBAM",
                "neck": "BiFPN",
                "classes": VEHICLE_CLASSES,
            },
            "device": str(self.device),
            "device_display": device_display,
            "is_cuda_available": is_cuda,
            "gpu_name": torch.cuda.get_device_name(0) if is_cuda else "None (CPU Execution)",
            "weights_loaded": self.weights_loaded,
            "model_status": self.model_status,
            "checkpoint_path": self.checkpoint_path,
            "checkpoint_name": os.path.basename(self.checkpoint_path),
            "confidence_threshold": self.conf_thresh,
        }

    def detect(self, img_bgr: np.ndarray, conf_thresh: Optional[float] = None) -> Dict[str, any]:
        if not self.weights_loaded:
            raise RuntimeError(f"Weights not loaded. Status: {self.model_status}")

        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        orig_h, orig_w = img_bgr.shape[:2]
        target_w, target_h = self.input_size
        t0 = time.perf_counter()

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(img_rgb, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
        tensor = torch.from_numpy(resized).float().permute(2, 0, 1).unsqueeze(0).to(self.device) / 255.0
        tensor = (tensor - self.mean) / self.std

        with torch.inference_mode():
            outputs = self.model(tensor)
            off_tensor = outputs.get("off", outputs.get("reg"))
            detections = decode_centernet(
                hm=outputs["hm"],
                wh=outputs["wh"],
                reg=off_tensor,
                k=100,
                down_ratio=4,
                conf_thresh=conf,
                original_size=(orig_w, orig_h),
                input_size=(target_w, target_h),
            )

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "detections": detections,
            "total_detections": len(detections),
            "latency_ms": latency_ms,
            "model_status": self.model_status,
            "is_trained_weights_loaded": True,
            "execution_mode": "PYTORCH_IMPROVED_CENTERNET_V2",
            "model_name": self.model_name,
            "header_tag": self.header_tag,
            "checkpoint": os.path.basename(self.checkpoint_path),
        }


COCO_VEHICLE_MAP = {
    "car": "car",
    "bus": "bus",
    "truck": "van",
    "motorcycle": "others",
    "bicycle": "others",
}


class PretrainedFasterRCNNDetector:
    """Pretrained Faster R-CNN (ResNet-50 FPN) from torchvision."""
    def __init__(self, default_conf_thresh: float = 0.35):
        self.conf_thresh = default_conf_thresh
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = "Pretrained Faster R-CNN (COCO)"
        self.header_tag = "PRETRAINED FASTER R-CNN [RESNET-50 FPN] // COCO"
        self.checkpoint_path = "torchvision://fasterrcnn_resnet50_fpn_coco"
        self.model_status = "INITIALIZING"
        self.last_load_error: Optional[str] = None
        self.model = None
        self.categories = []
        self._load_model()

    def _load_model(self):
        try:
            from torchvision.models.detection import fasterrcnn_resnet50_fpn, FasterRCNN_ResNet50_FPN_Weights
            weights = FasterRCNN_ResNet50_FPN_Weights.DEFAULT
            self.categories = weights.meta["categories"]
            self.model = fasterrcnn_resnet50_fpn(weights=weights).to(self.device)
            self.model.eval()
            self.model_status = "CONFIGURED_ACTIVE"
            self.last_load_error = None
        except Exception as e:
            self.model = None
            self.model_status = "LOAD_ERROR"
            self.last_load_error = str(e)

    def get_system_status(self) -> Dict[str, any]:
        is_cuda = torch.cuda.is_available()
        cpu_info = platform.processor() or "Host CPU"
        device_display = f"CUDA ({torch.cuda.get_device_name(0)})" if is_cuda else f"CPU ({cpu_info})"
        return {
            "model_name": self.model_name,
            "architecture": {
                "backbone": "ResNet-50",
                "neck": "FPN",
                "classes": VEHICLE_CLASSES,
                "dataset": "COCO Pretrained (torchvision)",
            },
            "device": str(self.device),
            "device_display": device_display,
            "is_cuda_available": is_cuda,
            "gpu_name": torch.cuda.get_device_name(0) if is_cuda else "None (CPU Execution)",
            "weights_loaded": self.model is not None,
            "model_status": self.model_status,
            "checkpoint_path": self.checkpoint_path,
            "checkpoint_name": "fasterrcnn_resnet50_fpn_coco.pth",
            "confidence_threshold": self.conf_thresh,
        }

    def detect(self, img_bgr: np.ndarray, conf_thresh: Optional[float] = None) -> Dict[str, any]:
        if self.model is None or self.model_status != "CONFIGURED_ACTIVE":
            raise RuntimeError(self.last_load_error or "Pretrained model is not loaded.")

        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        t0 = time.perf_counter()

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float().to(self.device) / 255.0

        with torch.inference_mode():
            outputs = self.model([tensor])[0]

        detections = []
        boxes = outputs["boxes"].detach().cpu().numpy()
        scores = outputs["scores"].detach().cpu().numpy()
        labels = outputs["labels"].detach().cpu().numpy()

        for box, score, label_idx in zip(boxes, scores, labels):
            if score < conf:
                continue
            cat_name = self.categories[label_idx] if label_idx < len(self.categories) else ""
            if cat_name not in COCO_VEHICLE_MAP:
                continue
            mapped_class = COCO_VEHICLE_MAP[cat_name]
            class_id = VEHICLE_CLASSES.index(mapped_class) if mapped_class in VEHICLE_CLASSES else 3
            detections.append({
                "bbox": [round(float(box[0]), 2), round(float(box[1]), 2), round(float(box[2]), 2), round(float(box[3]), 2)],
                "score": round(float(score), 4),
                "confidence": round(float(score), 4),
                "class_id": int(class_id),
                "class_name": mapped_class,
            })

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "detections": detections,
            "total_detections": len(detections),
            "latency_ms": latency_ms,
            "model_status": self.model_status,
            "is_trained_weights_loaded": True,
            "execution_mode": "TORCHVISION_FASTER_RCNN_PRETRAINED",
            "model_name": self.model_name,
            "header_tag": self.header_tag,
            "checkpoint": "fasterrcnn_resnet50_fpn_coco.pth",
        }


_cached_pretrained_detector: Optional[PretrainedFasterRCNNDetector] = None
_cached_uvh_detector: Optional[UVH26VehicleDetector] = None


def get_pretrained_detector() -> PretrainedFasterRCNNDetector:
    """Returns singleton instance of PretrainedFasterRCNNDetector."""
    global _cached_pretrained_detector
    if _cached_pretrained_detector is None:
        detector = PretrainedFasterRCNNDetector()
        if detector.model_status != "CONFIGURED_ACTIVE":
            raise RuntimeError(detector.last_load_error or "Failed to load pretrained weights.")
        _cached_pretrained_detector = detector
    return _cached_pretrained_detector


def get_uvh26_detector() -> UVH26VehicleDetector:
    """Returns singleton instance of UVH26VehicleDetector."""
    global _cached_uvh_detector
    if _cached_uvh_detector is None:
        _cached_uvh_detector = UVH26VehicleDetector()
    return _cached_uvh_detector
