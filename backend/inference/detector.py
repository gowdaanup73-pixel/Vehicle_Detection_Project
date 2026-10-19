"""
Vehicle Detection Inference Pipeline
Integrates Improved CenterNet PyTorch model with GPU/CPU dispatching,
strict checkpoint loading (improved_v2_best.pth), exact 512x288 bilinear preprocessing,
and anchor-free top-K decoding.
"""
import os
import time
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np
import torch
import torch.nn.functional as F

from backend.models.centernet import ImprovedCenterNet, VEHICLE_CLASSES, decode_centernet

DEFAULT_CHECKPOINT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "checkpoints")
PRIMARY_CHECKPOINT_NAME = "improved_v2_best.pth"
DEFAULT_WEIGHTS_PATH = os.path.join(DEFAULT_CHECKPOINT_DIR, PRIMARY_CHECKPOINT_NAME)


class VehicleDetector:
    """
    Production-grade inference interface for Improved CenterNet.
    Manages model initialization, strict checkpoint loading, device dispatch (CUDA/CPU),
    ImageNet standardization, and anchor-free CenterNet decoding.
    """
    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        input_size: Tuple[int, int] = (512, 288),  # (width, height)
        default_conf_thresh: float = 0.35,
    ):
        self.input_size = input_size  # (W, H) = (512, 288)
        self.conf_thresh = default_conf_thresh
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Resolve checkpoint path
        chosen_path = checkpoint_path or DEFAULT_WEIGHTS_PATH
        if not os.path.exists(chosen_path):
            alt_path = os.path.join(DEFAULT_CHECKPOINT_DIR, "improved_v2_best.pth")
            if os.path.exists(alt_path):
                chosen_path = alt_path

        self.checkpoint_path = chosen_path
        self.weights_loaded = False
        self.model_status = "INITIALIZING"
        self.last_load_error: Optional[str] = None

        # Build exact architecture matching trained checkpoint
        self.model = ImprovedCenterNet(
            num_classes=len(VEHICLE_CLASSES),
            feature_dim=64,
        ).to(self.device)
        self.model.eval()

        # Load weights strictly
        self.reload_weights(self.checkpoint_path)

    def reload_weights(self, checkpoint_path: str) -> Dict[str, any]:
        """
        Loads model weights strictly using load_state_dict(..., strict=True).
        Verifies that all parameters load successfully without missing or unexpected keys.
        """
        self.checkpoint_path = os.path.abspath(checkpoint_path)
        if not os.path.exists(self.checkpoint_path):
            self.weights_loaded = False
            self.model_status = "UNCONFIGURED_WEIGHTS_NOT_FOUND"
            self.last_load_error = f"Checkpoint file '{self.checkpoint_path}' does not exist on disk."
            return {
                "success": False,
                "status": self.model_status,
                "message": self.last_load_error,
                "checkpoint_path": self.checkpoint_path,
            }

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

            # Strict loading: verifies every key matches
            load_result = self.model.load_state_dict(state_dict, strict=True)
            self.model.eval()
            self.weights_loaded = True
            self.model_status = "CONFIGURED_ACTIVE"
            self.last_load_error = None

            return {
                "success": True,
                "status": self.model_status,
                "message": f"Checkpoint loaded successfully with strict=True: {os.path.basename(self.checkpoint_path)}",
                "checkpoint_path": self.checkpoint_path,
                "load_result": str(load_result),
            }
        except Exception as e:
            self.weights_loaded = False
            self.model_status = "LOAD_ERROR"
            self.last_load_error = str(e)
            return {
                "success": False,
                "status": self.model_status,
                "message": f"Failed to load weights: {str(e)}",
                "checkpoint_path": self.checkpoint_path,
            }

    def get_system_status(self) -> Dict[str, any]:
        """Returns comprehensive diagnostic metadata about runtime and model configuration."""
        import platform
        is_cuda = torch.cuda.is_available()
        cpu_info = platform.processor() or "Host CPU"
        device_display = f"CUDA ({torch.cuda.get_device_name(0)})" if is_cuda else f"CPU ({cpu_info})"
        return {
            "model_name": "Improved CenterNet V2 (ResNet-18 + CBAM + 2x BiFPN)",
            "architecture": {
                "backbone": "ResNet-18",
                "attention_module": "CBAM (Channel & Spatial Attention)",
                "neck": "BiFPN (Two blocks with learned weighted feature fusion)",
                "heads": ["Heatmap (4 classes)", "WH (Size)", "Off (Subpixel Offset)"],
                "classes": VEHICLE_CLASSES,
                "downsample_ratio": 4,
                "input_resolution": f"{self.input_size[0]}x{self.input_size[1]}",
            },
            "device": str(self.device),
            "device_display": device_display,
            "is_cuda_available": is_cuda,
            "gpu_name": torch.cuda.get_device_name(0) if is_cuda else "None (CPU Execution)",
            "weights_loaded": self.weights_loaded,
            "model_status": self.model_status,
            "checkpoint_path": self.checkpoint_path,
            "checkpoint_name": os.path.basename(self.checkpoint_path),
            "last_load_error": self.last_load_error,
            "confidence_threshold": self.conf_thresh,
        }

    def preprocess(self, img_bgr: np.ndarray) -> Tuple[torch.Tensor, float, float]:
        """
        Exact preprocessing matching training:
        - RGB conversion
        - Resized to 512 x 288 using bilinear interpolation
        - Scaled to [0, 1]
        - ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225]
        Returns: (input_tensor, scale_x, scale_y)
        """
        orig_h, orig_w = img_bgr.shape[:2]
        target_w, target_h = self.input_size

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(img_rgb, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

        tensor = torch.from_numpy(resized).float().permute(2, 0, 1) / 255.0
        mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32).view(3, 1, 1)
        tensor = (tensor - mean) / std

        scale_x = orig_w / float(target_w)
        scale_y = orig_h / float(target_h)

        return tensor.unsqueeze(0).to(self.device), scale_x, scale_y

    def detect(
        self,
        img_bgr: np.ndarray,
        conf_thresh: Optional[float] = None,
    ) -> Dict[str, any]:
        """
        Performs vehicle detection on an input BGR image.
        Uses pure deep neural network inference on trained checkpoint.
        Never mocks or fabricates detections.
        """
        if not self.weights_loaded:
            raise RuntimeError(
                f"Model weights are not loaded. Status: {self.model_status}. "
                f"Error: {self.last_load_error}. Checkpoint: {self.checkpoint_path}"
            )

        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        orig_h, orig_w = img_bgr.shape[:2]
        target_w, target_h = self.input_size
        t0 = time.perf_counter()

        tensor, _, _ = self.preprocess(img_bgr)
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
            "checkpoint": os.path.basename(self.checkpoint_path),
        }
