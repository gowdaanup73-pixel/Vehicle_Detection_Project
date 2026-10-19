"""
Vehicle Tracking and Spatial Analytics Module
Provides persistent Centroid & IoU trajectory tracking, line-crossing counting,
and road density estimation.
"""
import math
from typing import Dict, List, Tuple, Optional
import numpy as np


class TrackedVehicle:
    def __init__(self, track_id: int, bbox: List[float], class_name: str, confidence: float):
        self.track_id = track_id
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.class_name = class_name
        self.confidence = confidence
        self.center = self._compute_center(bbox)
        self.trajectory: List[Tuple[float, float]] = [self.center]
        self.disappeared_count = 0
        self.speed_vector = (0.0, 0.0)
        self.crossed_line = False
        self.crossing_direction: Optional[str] = None  # "inbound" or "outbound"

    def _compute_center(self, bbox: List[float]) -> Tuple[float, float]:
        return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)

    def update(self, bbox: List[float], confidence: float):
        self.bbox = bbox
        self.confidence = confidence
        new_center = self._compute_center(bbox)
        # Calculate velocity vector
        if len(self.trajectory) > 0:
            last_center = self.trajectory[-1]
            self.speed_vector = (new_center[0] - last_center[0], new_center[1] - last_center[1])
        self.trajectory.append(new_center)
        if len(self.trajectory) > 30:
            self.trajectory.pop(0)
        self.center = new_center
        self.disappeared_count = 0


def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(1e-5, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1e-5, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    return interArea / float(boxAArea + boxBArea - interArea)


class VehicleTracker:
    """
    Robust multi-object tracker for vehicle surveillance and traffic analytics.
    Tracks vehicle trajectories, counts line crossings across a virtual tripwire,
    and isolates unique tracked vehicles from raw frame detections.
    """
    def __init__(
        self,
        max_disappeared: int = 15,
        max_distance: float = 65.0,
        tripwire_y_ratio: float = 0.55,
    ):
        self.next_track_id = 1
        self.tracked_vehicles: Dict[int, TrackedVehicle] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        self.tripwire_y_ratio = tripwire_y_ratio

        # Cumulative Metrics
        self.total_unique_vehicles = 0
        self.line_crossings = {
            "total": 0,
            "inbound": 0,
            "outbound": 0,
            "by_class": {"car": 0, "van": 0, "bus": 0, "others": 0},
        }

    def update(
        self,
        detections: List[Dict],
        frame_width: int,
        frame_height: int,
    ) -> List[Dict]:
        tripwire_y = frame_height * self.tripwire_y_ratio

        if len(detections) == 0:
            # Mark existing tracks as disappeared
            for track_id in list(self.tracked_vehicles.keys()):
                self.tracked_vehicles[track_id].disappeared_count += 1
                if self.tracked_vehicles[track_id].disappeared_count > self.max_disappeared:
                    del self.tracked_vehicles[track_id]
            return []

        # Current frame candidate centers
        input_boxes = [d["bbox"] for d in detections]
        input_classes = [d["class_name"] for d in detections]
        input_confs = [d["score"] for d in detections]
        input_centers = [
            ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0) for b in input_boxes
        ]

        if len(self.tracked_vehicles) == 0:
            # Register all incoming detections
            for i in range(len(detections)):
                self._register_vehicle(input_boxes[i], input_classes[i], input_confs[i])
        else:
            track_ids = list(self.tracked_vehicles.keys())
            track_centers = [self.tracked_vehicles[tid].center for tid in track_ids]

            # Compute Euclidean distance matrix
            D = np.zeros((len(track_ids), len(input_centers)), dtype=np.float32)
            for i, tc in enumerate(track_centers):
                for j, ic in enumerate(input_centers):
                    # Combine Euclidean distance and IoU penalty
                    dist = math.hypot(tc[0] - ic[0], tc[1] - ic[1])
                    iou = calculate_iou(self.tracked_vehicles[track_ids[i]].bbox, input_boxes[j])
                    cost = dist - (iou * 25.0)
                    D[i, j] = cost

            # Associate tracks with detections using minimum distance
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue

                if D[row, col] > self.max_distance:
                    continue

                track_id = track_ids[row]
                vehicle = self.tracked_vehicles[track_id]
                prev_y = vehicle.center[1]

                vehicle.update(input_boxes[col], input_confs[col])
                curr_y = vehicle.center[1]

                # Check virtual tripwire line crossing
                if not vehicle.crossed_line:
                    if prev_y < tripwire_y <= curr_y:
                        vehicle.crossed_line = True
                        vehicle.crossing_direction = "inbound"
                        self.line_crossings["total"] += 1
                        self.line_crossings["inbound"] += 1
                        cls_key = vehicle.class_name if vehicle.class_name in self.line_crossings["by_class"] else "others"
                        self.line_crossings["by_class"][cls_key] += 1
                    elif prev_y > tripwire_y >= curr_y:
                        vehicle.crossed_line = True
                        vehicle.crossing_direction = "outbound"
                        self.line_crossings["total"] += 1
                        self.line_crossings["outbound"] += 1
                        cls_key = vehicle.class_name if vehicle.class_name in self.line_crossings["by_class"] else "others"
                        self.line_crossings["by_class"][cls_key] += 1

                used_rows.add(row)
                used_cols.add(col)

            # Handle unassigned tracks
            unused_rows = set(range(len(track_ids))).difference(used_rows)
            for row in unused_rows:
                track_id = track_ids[row]
                self.tracked_vehicles[track_id].disappeared_count += 1
                if self.tracked_vehicles[track_id].disappeared_count > self.max_disappeared:
                    del self.tracked_vehicles[track_id]

            # Register new detections
            unused_cols = set(range(len(input_centers))).difference(used_cols)
            for col in unused_cols:
                self._register_vehicle(input_boxes[col], input_classes[col], input_confs[col])

        # Return tracked results formatted for UI display
        results = []
        for track_id, vehicle in self.tracked_vehicles.items():
            if vehicle.disappeared_count == 0:
                results.append({
                    "track_id": track_id,
                    "bbox": vehicle.bbox,
                    "class_name": vehicle.class_name,
                    "confidence": vehicle.confidence,
                    "center": vehicle.center,
                    "trajectory": vehicle.trajectory[-12:],  # Last 12 trajectory points
                    "speed_vector": vehicle.speed_vector,
                    "crossed_line": vehicle.crossed_line,
                    "crossing_direction": vehicle.crossing_direction,
                })

        return results

    def _register_vehicle(self, bbox: List[float], class_name: str, confidence: float):
        track_id = self.next_track_id
        self.next_track_id += 1
        self.tracked_vehicles[track_id] = TrackedVehicle(track_id, bbox, class_name, confidence)
        self.total_unique_vehicles += 1

    def compute_density_estimate(self, frame_width: int, frame_height: int) -> Dict[str, float]:
        """
        Calculates road vehicle density as a documented spatial occupancy estimate:
        Occupancy Ratio = Sum of vehicle bounding box areas / Total frame area
        Vehicles per MegaPixel = Active vehicles / (Area / 1,000,000)
        """
        total_frame_area = max(frame_width * frame_height, 1)
        active_area = 0.0
        active_count = 0

        for vehicle in self.tracked_vehicles.values():
            if vehicle.disappeared_count == 0:
                b = vehicle.bbox
                box_area = max(0.0, (b[2] - b[0])) * max(0.0, (b[3] - b[1]))
                active_area += box_area
                active_count += 1

        occupancy_ratio = min(round((active_area / total_frame_area) * 100.0, 2), 100.0)
        
        # Categorize density level
        if occupancy_ratio < 4.0:
            level = "Light"
        elif occupancy_ratio < 12.0:
            level = "Moderate"
        elif occupancy_ratio < 22.0:
            level = "Dense"
        else:
            level = "Congested"

        return {
            "occupancy_percentage": occupancy_ratio,
            "density_level": level,
            "active_vehicles": active_count,
            "cumulative_unique": self.total_unique_vehicles,
            "metric_type": "Documented Spatial Occupancy Estimate (Non-direct sensor measurement)",
        }
