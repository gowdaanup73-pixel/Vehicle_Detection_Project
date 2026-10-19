"""
Media Processing Service
Handles image and video frame-by-frame inference, trajectory tracking,
tactical visual annotation in Industrial Command Center style, and video encoding.
"""
import math
import os
import time
import uuid
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np

from backend.inference.detector import VehicleDetector
from backend.models.tracker import VehicleTracker

# Strict Industrial Command Center Color Palette in BGR for OpenCV
COLOR_CHARCOAL = (32, 35, 34)     # #222320
COLOR_WARM_IVORY = (212, 226, 233) # #E9E2D4
COLOR_BURNT_ORANGE = (60, 107, 200)# #C86B3C
COLOR_MUTED_OLIVE = (106, 134, 133)# #85866A
COLOR_BORDER = (53, 57, 56)        # Subtle border

CLASS_COLORS = {
    "car": COLOR_BURNT_ORANGE,
    "van": (80, 140, 215),        # Rich Amber-Orange
    "bus": COLOR_MUTED_OLIVE,
    "others": (160, 160, 150),    # Slate Gray
}


class MediaProcessor:
    def __init__(self, detector: VehicleDetector, media_root: str):
        self.detector = detector
        self.media_root = media_root
        self.uploads_dir = os.path.join(media_root, "uploads")
        self.outputs_dir = os.path.join(media_root, "outputs")
        os.makedirs(self.uploads_dir, exist_ok=True)
        os.makedirs(self.outputs_dir, exist_ok=True)

    def draw_industrial_annotation(
        self,
        frame: np.ndarray,
        detections: List[Dict],
        tracked_vehicles: Optional[List[Dict]] = None,
        tripwire_y: Optional[int] = None,
        crossings_info: Optional[Dict] = None,
    ) -> np.ndarray:
        """
        Renders HUD-grade industrial tactical annotations:
        - Sleek corner brackets and hairline bounding frame
        - Monospaced tactical chip with class, confidence, tracking ID
        - Trajectory path visualization
        - Tripwire counting line
        """
        img = frame.copy()
        h, w = img.shape[:2]

        # Draw Tripwire Line if provided
        if tripwire_y is not None:
            cv2.line(img, (0, tripwire_y), (w, tripwire_y), COLOR_MUTED_OLIVE, 1, cv2.LINE_AA)
            # Tripwire labels
            label_text = "COUNTING TRIPWIRE REF // GATE 01"
            if crossings_info:
                label_text += f" [IN: {crossings_info.get('inbound', 0)} | OUT: {crossings_info.get('outbound', 0)}]"
            cv2.putText(img, label_text, (20, tripwire_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLOR_MUTED_OLIVE, 1, cv2.LINE_AA)

        # Draw Tracked Vehicles or Raw Detections
        items_to_render = tracked_vehicles if tracked_vehicles is not None else detections

        for item in items_to_render:
            bbox = item["bbox"]
            class_name = item.get("class_name", "car")
            score = item.get("confidence") or item.get("score", 0.0)
            track_id = item.get("track_id")

            color = CLASS_COLORS.get(class_name, COLOR_BURNT_ORANGE)
            x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
            bw = x2 - x1
            bh = y2 - y1

            # Draw trajectory trail if available
            trajectory = item.get("trajectory", [])
            if len(trajectory) > 1:
                for idx in range(1, len(trajectory)):
                    pt1 = (int(trajectory[idx - 1][0]), int(trajectory[idx - 1][1]))
                    pt2 = (int(trajectory[idx][0]), int(trajectory[idx][1]))
                    cv2.line(img, pt1, pt2, color, 1, cv2.LINE_AA)
                    cv2.circle(img, pt2, 2, color, -1)

            # Hairline bounding box
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)

            # Precision Corner Brackets (Automotive HUD style)
            corner_len = max(8, min(18, min(bw, bh) // 4))
            thick = 2
            # Top-Left
            cv2.line(img, (x1, y1), (x1 + corner_len, y1), color, thick)
            cv2.line(img, (x1, y1), (x1, y1 + corner_len), color, thick)
            # Top-Right
            cv2.line(img, (x2, y1), (x2 - corner_len, y1), color, thick)
            cv2.line(img, (x2, y1), (x2, y1 + corner_len), color, thick)
            # Bottom-Left
            cv2.line(img, (x1, y2), (x1 + corner_len, y2), color, thick)
            cv2.line(img, (x1, y2), (x1, y2 - corner_len), color, thick)
            # Bottom-Right
            cv2.line(img, (x2, y2), (x2 - corner_len, y2), color, thick)
            cv2.line(img, (x2, y2), (x2, y2 - corner_len), color, thick)

            # Center target crosshair
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            cv2.circle(img, (cx, cy), 3, color, -1)

            # Tactical Label
            if track_id is not None:
                tag = f"#{track_id:03d} {class_name.upper()} {int(score * 100)}%"
            else:
                tag = f"{class_name.upper()} {int(score * 100)}%"

            font_scale = 0.42
            font_thick = 1
            (tw, th), baseline = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)

            chip_y1 = max(0, y1 - th - 8)
            chip_y2 = y1
            chip_x1 = x1
            chip_x2 = min(w, x1 + tw + 10)

            # Charcoal badge with subtle border
            cv2.rectangle(img, (chip_x1, chip_y1), (chip_x2, chip_y2), COLOR_CHARCOAL, -1)
            cv2.rectangle(img, (chip_x1, chip_y1), (chip_x2, chip_y2), color, 1)
            cv2.putText(
                img,
                tag,
                (chip_x1 + 5, chip_y2 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                COLOR_WARM_IVORY,
                font_thick,
                cv2.LINE_AA,
            )

        # Header watermark / telemetry badge
        h_tag = "IMPROVED CENTERNET [RESNET-18 + CBAM + BIFPN] // UA-DETRAC"
        cv2.putText(img, h_tag, (16, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.45, COLOR_WARM_IVORY, 1, cv2.LINE_AA)
        
        return img

    def process_image(
        self,
        image_path: str,
        conf_thresh: float = 0.35,
    ) -> Dict:
        """Processes a single image, generates annotations, and computes class counts."""
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise ValueError(f"Could not read image file at {image_path}")

        det_result = self.detector.detect(img_bgr, conf_thresh=conf_thresh)
        detections = det_result["detections"]

        # Class counts
        class_counts = {"car": 0, "van": 0, "bus": 0, "others": 0}
        for d in detections:
            c = d["class_name"]
            if c in class_counts:
                class_counts[c] += 1
            else:
                class_counts["others"] += 1

        annotated_img = self.draw_industrial_annotation(img_bgr, detections)

        # Save annotated image
        run_id = f"run_{uuid.uuid4().hex[:8]}"
        out_filename = f"{run_id}_annotated.jpg"
        out_path = os.path.join(self.outputs_dir, out_filename)
        cv2.imwrite(out_path, annotated_img)

        return {
            "run_id": run_id,
            "media_type": "image",
            "annotated_path": out_path,
            "annotated_filename": out_filename,
            "detections": detections,
            "total_detections": len(detections),
            "unique_vehicles": len(detections),
            "class_counts": class_counts,
            "latency_ms": det_result["latency_ms"],
            "fps": round(1000.0 / max(det_result["latency_ms"], 1.0), 1),
            "model_status": det_result["model_status"],
            "is_trained_weights_loaded": det_result["is_trained_weights_loaded"],
            "execution_mode": det_result["execution_mode"],
        }

    def process_video(
        self,
        video_path: str,
        conf_thresh: float = 0.35,
        max_frames: int = 300,
        frame_stride: int = 1,
    ) -> Dict:
        """
        Performs frame-by-frame detection and multi-object tracking on video.
        Generates annotated output video, cumulative line-crossing analytics,
        and temporal density curves.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file at {video_path}")

        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps_in = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        run_id = f"run_{uuid.uuid4().hex[:8]}"
        out_filename = f"{run_id}_annotated.mp4"
        out_path = os.path.join(self.outputs_dir, out_filename)

        # Try mp4v or H264 codec
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_writer = cv2.VideoWriter(out_path, fourcc, fps_in / frame_stride, (orig_w, orig_h))

        tracker = VehicleTracker(tripwire_y_ratio=0.55)
        tripwire_y = int(orig_h * 0.55)

        timeline = []
        frame_idx = 0
        processed_frames = 0
        total_detections_sum = 0
        latencies = []

        overall_class_counts = {"car": 0, "van": 0, "bus": 0, "others": 0}

        t_start = time.perf_counter()

        while cap.isOpened() and processed_frames < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_stride != 0:
                frame_idx += 1
                continue

            t_frame_start = time.perf_counter()

            # Run detection
            det_res = self.detector.detect(frame, conf_thresh=conf_thresh)
            dets = det_res["detections"]
            total_detections_sum += len(dets)

            # Update tracker
            tracked = tracker.update(dets, orig_w, orig_h)

            # Record per-class counts in this frame
            frame_classes = {"car": 0, "van": 0, "bus": 0, "others": 0}
            for t in tracked:
                c = t["class_name"]
                if c in frame_classes:
                    frame_classes[c] += 1
                else:
                    frame_classes["others"] += 1
                if c in overall_class_counts:
                    overall_class_counts[c] += 1
                else:
                    overall_class_counts["others"] += 1

            # Compute estimated density
            density_info = tracker.compute_density_estimate(orig_w, orig_h)

            # Draw tactical HUD annotations
            annotated_frame = self.draw_industrial_annotation(
                frame,
                dets,
                tracked_vehicles=tracked,
                tripwire_y=tripwire_y,
                crossings_info=tracker.line_crossings,
            )

            out_writer.write(annotated_frame)

            frame_latency = round((time.perf_counter() - t_frame_start) * 1000.0, 2)
            latencies.append(frame_latency)

            # Record timeline entry
            timeline.append({
                "frame": frame_idx,
                "timestamp_sec": round(frame_idx / fps_in, 2),
                "active_detections": len(dets),
                "unique_vehicles": tracker.total_unique_vehicles,
                "line_crossings": tracker.line_crossings["total"],
                "inbound": tracker.line_crossings["inbound"],
                "outbound": tracker.line_crossings["outbound"],
                "class_breakdown": frame_classes,
                "density_percentage": density_info["occupancy_percentage"],
                "density_level": density_info["density_level"],
                "latency_ms": frame_latency,
            })

            frame_idx += 1
            processed_frames += 1

        cap.release()
        out_writer.release()

        total_time = time.perf_counter() - t_start
        avg_latency = round(np.mean(latencies), 2) if latencies else 0.0
        avg_fps = round(processed_frames / max(total_time, 0.001), 1)

        return {
            "run_id": run_id,
            "media_type": "video",
            "annotated_path": out_path,
            "annotated_filename": out_filename,
            "processed_frames": processed_frames,
            "total_frames_in_video": total_frames,
            "total_detections": total_detections_sum,
            "unique_vehicles": tracker.total_unique_vehicles,
            "line_crossings": tracker.line_crossings["total"],
            "line_crossings_detail": tracker.line_crossings,
            "class_counts": overall_class_counts,
            "timeline": timeline,
            "latency_ms": avg_latency,
            "fps": avg_fps,
            "density_summary": tracker.compute_density_estimate(orig_w, orig_h),
            "model_status": self.detector.model_status,
            "is_trained_weights_loaded": self.detector.weights_loaded,
        }

    def generate_sample_road_media(self) -> Tuple[str, str]:
        """
        Synthesizes a realistic urban road image and traffic video clip
        for instant demonstration without needing external file downloads.
        """
        sample_img_path = os.path.join(self.uploads_dir, "sample_highway_traffic.jpg")
        sample_vid_path = os.path.join(self.uploads_dir, "sample_traffic_stream.mp4")

        # Generate Sample Image
        if not os.path.exists(sample_img_path):
            img = np.zeros((720, 1280, 3), dtype=np.uint8)
            # Sky
            img[0:220, :] = [80, 75, 70]
            # City skyline silhouette
            for x in range(0, 1280, 80):
                h_b = int(np.random.randint(60, 150))
                cv2.rectangle(img, (x, 220 - h_b), (x + 70, 220), (50, 48, 45), -1)
            # Road plane
            img[220:720, :] = [45, 45, 45]
            # Lane markings
            for y in range(250, 720, 60):
                w_lane = int((y / 720.0) * 12)
                for x in [380, 640, 900]:
                    cv2.line(img, (x, y), (x, y + 35), (200, 200, 190), w_lane)

            # Synthetic vehicles with realistic silhouettes
            vehicles = [
                # (x, y, w, h, color, class)
                (280, 420, 110, 75, (120, 140, 190), "car"),
                (440, 380, 100, 70, (50, 60, 160), "car"),
                (700, 460, 150, 95, (100, 110, 115), "van"),
                (890, 360, 180, 140, (180, 150, 60), "bus"),
                (550, 520, 130, 85, (40, 40, 180), "car"),
            ]
            for vx, vy, vw, vh, vc, _ in vehicles:
                # Body
                cv2.rectangle(img, (vx, vy), (vx + vw, vy + vh), vc, -1)
                cv2.rectangle(img, (vx, vy), (vx + vw, vy + vh), (20, 20, 20), 2)
                # Windshield / Cabin
                cv2.rectangle(img, (vx + 15, vy + 10), (vx + vw - 15, vy + vh - 25), (30, 30, 35), -1)
                # Wheels
                cv2.circle(img, (vx + 20, vy + vh), 10, (15, 15, 15), -1)
                cv2.circle(img, (vx + vw - 20, vy + vh), 10, (15, 15, 15), -1)

            cv2.imwrite(sample_img_path, img)

        # Generate Sample Video Clip (60 frames)
        if not os.path.exists(sample_vid_path):
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            vid_writer = cv2.VideoWriter(sample_vid_path, fourcc, 20.0, (1280, 720))

            v_positions = [
                {"x": 280, "y": 240, "w": 80, "h": 55, "speed": 4.5, "color": (120, 140, 190), "cls": "car"},
                {"x": 480, "y": 280, "w": 90, "h": 60, "speed": 5.2, "color": (50, 60, 160), "cls": "car"},
                {"x": 720, "y": 220, "w": 120, "h": 80, "speed": 3.8, "color": (100, 110, 115), "cls": "van"},
                {"x": 920, "y": 210, "w": 160, "h": 120, "speed": 2.9, "color": (180, 150, 60), "cls": "bus"},
            ]

            for f in range(60):
                f_img = np.zeros((720, 1280, 3), dtype=np.uint8)
                f_img[0:220, :] = [80, 75, 70]
                f_img[220:720, :] = [45, 45, 45]
                # Lanes
                for y in range(250, 720, 60):
                    w_lane = int((y / 720.0) * 12)
                    for x in [380, 640, 900]:
                        cv2.line(f_img, (x, y), (x, y + 35), (200, 200, 190), w_lane)

                # Move vehicles forward (perspective scaling)
                for vp in v_positions:
                    curr_y = int(vp["y"] + (f * vp["speed"]))
                    scale = 0.6 + (curr_y / 720.0) * 0.7
                    curr_w = int(vp["w"] * scale)
                    curr_h = int(vp["h"] * scale)
                    curr_x = int(vp["x"] + (f * (vp["speed"] * 0.4)))

                    cv2.rectangle(f_img, (curr_x, curr_y), (curr_x + curr_w, curr_y + curr_h), vp["color"], -1)
                    cv2.rectangle(f_img, (curr_x, curr_y), (curr_x + curr_w, curr_y + curr_h), (20, 20, 20), 2)
                    # Cabin
                    cv2.rectangle(f_img, (curr_x + 10, curr_y + 8), (curr_x + curr_w - 10, curr_y + curr_h - 18), (30, 30, 35), -1)

                vid_writer.write(f_img)

            vid_writer.release()

        return sample_img_path, sample_vid_path
