"""
Automated Test Suite for Improved CenterNet Vehicle Intelligence Platform
Verifies:
1. CBAM attention module tensor shapes
2. BiFPN weighted feature fusion
3. CenterNet forward pass and anchor-free decoding
4. VehicleTracker trajectory and line crossing math
5. SQLite runs persistence and analytics aggregation
6. FastAPI REST endpoints health and responses
"""
import os
import shutil
import tempfile
import cv2
import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from backend.api.app import app
from backend.database.store import RunsDatabase
from backend.models.bifpn import BiFPNBlock
from backend.models.cbam import CBAM
from backend.models.centernet import ImprovedCenterNet, decode_centernet
from backend.models.tracker import VehicleTracker


class TestNeuralModules:
    def test_cbam_attention(self):
        cbam = CBAM(in_planes=128, ratio=16)
        x = torch.randn(2, 128, 32, 32)
        out = cbam(x)
        assert out.shape == x.shape
        assert not torch.isnan(out).any()

    def test_bifpn_fusion(self):
        bifpn = BiFPNBlock(feature_dim=64)
        p3 = torch.randn(2, 64, 32, 32)
        p4 = torch.randn(2, 64, 16, 16)
        p5 = torch.randn(2, 64, 8, 8)
        p3_out, p4_out, p5_out = bifpn(p3, p4, p5)
        assert p3_out.shape == (2, 64, 32, 32)
        assert p4_out.shape == (2, 64, 16, 16)
        assert p5_out.shape == (2, 64, 8, 8)

    def test_centernet_forward(self):
        model = ImprovedCenterNet(num_classes=4, feature_dim=64)
        x = torch.randn(1, 3, 256, 256)
        outputs = model(x)
        assert "hm" in outputs
        assert "wh" in outputs
        assert "reg" in outputs
        # Stride 4 output resolution: 256 / 4 = 64
        assert outputs["hm"].shape == (1, 4, 64, 64)
        assert outputs["wh"].shape == (1, 2, 64, 64)
        assert outputs["reg"].shape == (1, 2, 64, 64)

    def test_centernet_decode(self):
        hm = torch.zeros(1, 4, 64, 64)
        hm[0, 0, 32, 32] = 0.95  # Peak for class 0 (car)
        wh = torch.ones(1, 2, 64, 64) * 10.0
        reg = torch.zeros(1, 2, 64, 64)

        dets = decode_centernet(hm, wh, reg, k=10, down_ratio=4, conf_thresh=0.5)
        assert len(dets) >= 1
        assert dets[0]["class_name"] == "car"
        assert dets[0]["score"] >= 0.90


class TestTrackingAndAnalytics:
    def test_tracker_line_crossing(self):
        tracker = VehicleTracker(tripwire_y_ratio=0.5)  # tripwire at y = 100
        frame_w, frame_h = 400, 200

        # Frame 1: Vehicle above line at y=80
        det_f1 = [{"bbox": [100.0, 70.0, 140.0, 90.0], "score": 0.9, "class_name": "car"}]
        t1 = tracker.update(det_f1, frame_w, frame_h)
        assert len(t1) == 1
        assert tracker.total_unique_vehicles == 1
        assert tracker.line_crossings["total"] == 0

        # Frame 2: Vehicle moves downward past tripwire to y=120
        det_f2 = [{"bbox": [102.0, 110.0, 142.0, 130.0], "score": 0.92, "class_name": "car"}]
        t2 = tracker.update(det_f2, frame_w, frame_h)
        assert len(t2) == 1
        assert tracker.total_unique_vehicles == 1
        assert tracker.line_crossings["total"] == 1
        assert tracker.line_crossings["inbound"] == 1

    def test_density_estimation(self):
        tracker = VehicleTracker()
        det = [{"bbox": [0.0, 0.0, 100.0, 100.0], "score": 0.9, "class_name": "car"}]
        tracker.update(det, 1000, 1000)
        density = tracker.compute_density_estimate(1000, 1000)
        assert "occupancy_percentage" in density
        assert "density_level" in density
        assert density["active_vehicles"] == 1


class TestDatabaseStore:
    def test_runs_database_crud(self):
        temp_dir = tempfile.mkdtemp()
        db_path = os.path.join(temp_dir, "test_runs.db")
        db = RunsDatabase(db_path=db_path)

        saved = db.save_run(
            run_id="test_run_01",
            media_type="image",
            filename="highway.jpg",
            input_url="/media/highway.jpg",
            annotated_url="/media/highway_out.jpg",
            model_name="Improved CenterNet",
            weights_status="CONFIGURED_ACTIVE",
            latency_ms=21.5,
            fps=46.5,
            total_detections=5,
            unique_vehicles=5,
            line_crossings=0,
            class_counts={"car": 4, "van": 1, "bus": 0, "others": 0},
        )
        assert saved["id"] == "test_run_01"

        retrieved = db.get_run("test_run_01")
        assert retrieved is not None
        assert retrieved["class_counts"]["car"] == 4

        summary = db.get_analytics_summary()
        assert summary["total_runs"] == 1
        assert summary["total_detections"] == 5

        assert db.delete_run("test_run_01") is True
        assert db.get_run("test_run_01") is None
        shutil.rmtree(temp_dir, ignore_errors=True)


class TestApiEndpoints:
    def test_api_health(self):
        client = TestClient(app)
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"

    def test_api_model_status(self):
        client = TestClient(app)
        res = client.get("/api/model/status")
        assert res.status_code == 200
        data = res.json()
        assert "architecture" in data
        assert data["architecture"]["backbone"] == "ResNet-18"

    def test_api_experiments(self):
        client = TestClient(app)
        res = client.get("/api/experiments")
        assert res.status_code == 200
        data = res.json()
        assert len(data["experiments"]) == 3  # Baseline, V1, V2 (fabricated INT8 pruned model removed)
        v2 = next(e for e in data["experiments"] if e["id"] == "exp_improved_centernet_v2")
        assert v2["map_50"] == 0.5982
        assert v2["map_50_95"] == 0.3479
        assert v2["ap_75"] == 0.3636
        assert v2["class_ap_50"]["car"] == 0.4778
        assert v2["class_ap_50"]["van"] == 0.4182
        assert v2["class_ap_50"]["bus"] == 0.4481
        assert v2["class_ap_50"]["others"] == 0.0476
        assert v2["precision"] is None  # Unmeasured marked as Not evaluated
        assert v2["recall"] is None
        assert v2["f1_score"] is None
        assert v2["evaluation_type"] == "Validation Split"
        assert "2,092" in v2["evaluation_split"]

    def test_api_dataset_info(self):
        client = TestClient(app)
        res = client.get("/api/dataset/info")
        assert res.status_code == 200
        data = res.json()
        assert "UA-DETRAC" in data["name"]
        assert data["training_sequences"] == 51
        assert data["validation_sequences"] == 9
        assert data["test_sequences"] == 40
        assert data["training_sampled_images"] == 14317
        assert data["validation_sampled_images"] == 2092
        assert data["total_sampled_images"] == 16409
        assert data["training_boxes"] == 104492
        assert data["validation_boxes"] == 14121
        assert data["total_annotated_boxes"] == 118613
        assert data["input_specifications"]["model_input_resolution"] == "512x288"

    def test_api_detect_sample(self):
        client = TestClient(app)
        res = client.post("/api/detect/sample?media_type=image&conf_thresh=0.35")
        assert res.status_code == 200
        data = res.json()
        assert "run_id" in data
        assert "detections" in data
        assert "annotated_url" in data
        assert data["is_sample"] is True
        assert data["saved_run"] is None  # Sample runs are never inserted into production database history

    def test_checkpoint_strict_loading(self):
        ckpt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "checkpoints", "improved_v2_best.pth")
        assert os.path.exists(ckpt_path), f"Checkpoint missing at {ckpt_path}"
        model = ImprovedCenterNet(num_classes=4, feature_dim=64)
        state_dict = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        incompatible = model.load_state_dict(state_dict, strict=True)
        assert len(incompatible.missing_keys) == 0
        assert len(incompatible.unexpected_keys) == 0

    def test_detector_real_inference_and_four_classes(self):
        from backend.inference.detector import VehicleDetector
        detector = VehicleDetector()
        assert detector.weights_loaded is True
        assert detector.model_status == "CONFIGURED_ACTIVE"

        # Generate or load realistic test image
        test_img = np.zeros((288, 512, 3), dtype=np.uint8)
        # Synthetic road with vehicles
        test_img[100:288, :] = 50
        cv2.rectangle(test_img, (150, 150), (230, 200), (120, 130, 180), -1)

        result = detector.detect(test_img, conf_thresh=0.1)
        assert "detections" in result
        assert "latency_ms" in result
        assert result["latency_ms"] > 0
        assert result["is_trained_weights_loaded"] is True
        valid_classes = {"car", "van", "bus", "others"}
        for det in result["detections"]:
            assert det["class_name"] in valid_classes
            assert 0 <= det["class_id"] <= 3
            x1, y1, x2, y2 = det["bbox"]
            assert 0 <= x1 <= x2 <= 512
            assert 0 <= y1 <= y2 <= 288

    def test_invalid_upload_handling(self):
        client = TestClient(app)
        # Attempt to upload an invalid file type (.txt)
        files = {"file": ("malicious.txt", b"not an image", "text/plain")}
        res = client.post("/api/detect/image", files=files)
        assert res.status_code == 400
        assert "Unsupported image format" in res.json()["detail"]

    def test_image_upload_endpoint(self):
        client = TestClient(app)
        # Create a valid JPEG in memory
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        _, img_encoded = cv2.imencode(".jpg", img)
        files = {"file": ("test_road.jpg", img_encoded.tobytes(), "image/jpeg")}
        res = client.post("/api/detect/image", files=files, data={"conf_thresh": "0.35"})
        assert res.status_code == 200
        data = res.json()
        assert "run_id" in data
        assert "annotated_url" in data
        assert "total_detections" in data
        assert "class_counts" in data
        assert "latency_ms" in data

    def test_two_distinct_uploads_provenance_and_model_invocation(self):
        client = TestClient(app)
        base_dir = os.path.dirname(os.path.dirname(__file__))

        # Image 1: 320x480 blue canvas with a red test square
        img1 = np.zeros((320, 480, 3), dtype=np.uint8)
        img1[:] = (255, 100, 50)
        cv2.rectangle(img1, (100, 100), (200, 200), (0, 0, 255), -1)
        _, enc1 = cv2.imencode(".jpg", img1)

        # Image 2: 400x600 green canvas with a yellow test circle
        img2 = np.zeros((400, 600, 3), dtype=np.uint8)
        img2[:] = (50, 200, 100)
        cv2.circle(img2, (300, 200), 80, (0, 255, 255), -1)
        _, enc2 = cv2.imencode(".jpg", img2)

        res1 = client.post("/api/detect/image", files={"file": ("custom_cam1.jpg", enc1.tobytes(), "image/jpeg")}, data={"conf_thresh": "0.25"})
        res2 = client.post("/api/detect/image", files={"file": ("custom_cam2.jpg", enc2.tobytes(), "image/jpeg")}, data={"conf_thresh": "0.25"})

        assert res1.status_code == 200
        assert res2.status_code == 200

        d1 = res1.json()
        d2 = res2.json()

        # Verify distinct, non-demo run IDs and non-demo media paths
        assert d1["run_id"] != d2["run_id"]
        assert d1["input_url"] != d2["input_url"]
        assert d1["annotated_url"] != d2["annotated_url"]
        assert "sample_highway_traffic" not in d1["input_url"]
        assert "sample_highway_traffic" not in d2["input_url"]
        assert d1["execution_mode"] == "PYTORCH_IMPROVED_CENTERNET_V2"
        assert d2["execution_mode"] == "PYTORCH_IMPROVED_CENTERNET_V2"

        # Verify physical output image dimensions and provenance directly from disk
        path1 = d1.get("annotated_path") or os.path.join(base_dir, "backend", d1["annotated_url"].lstrip("/"))
        path2 = d2.get("annotated_path") or os.path.join(base_dir, "backend", d2["annotated_url"].lstrip("/"))
        assert os.path.exists(path1), f"Output 1 missing: {path1}"
        assert os.path.exists(path2), f"Output 2 missing: {path2}"

        ann1 = cv2.imread(path1)
        ann2 = cv2.imread(path2)
        assert ann1 is not None and ann2 is not None

        # Dimensions must match the respective uploaded image dimensions
        assert ann1.shape == (320, 480, 3)
        assert ann2.shape == (400, 600, 3)

    def test_empty_database_and_sample_exclusion(self):
        import tempfile
        from backend.database.store import RunsDatabase
        temp_dir = tempfile.mkdtemp()
        db_path = os.path.join(temp_dir, "empty_test.db")
        empty_db = RunsDatabase(db_path=db_path)

        # Verify empty state
        assert len(empty_db.list_runs()) == 0
        summary = empty_db.get_analytics_summary()
        assert summary["total_runs"] == 0
        assert summary["total_detections"] == 0
        assert summary["total_unique_vehicles"] == 0
        assert summary["total_line_crossings"] == 0
        assert summary["average_latency_ms"] == 0.0

        # Attempt to save a sample media run - must be rejected and not inserted
        sample_saved = empty_db.save_run(
            run_id="run_sample_test",
            media_type="image",
            filename="sample_highway_traffic.jpg",
            input_url="/media/uploads/sample_highway_traffic.jpg",
            annotated_url="/media/outputs/sample_annotated.jpg",
            model_name="Improved CenterNet",
            weights_status="CONFIGURED_ACTIVE",
            latency_ms=25.0,
            fps=40.0,
            total_detections=5,
            unique_vehicles=5,
            line_crossings=0,
            class_counts={"car": 5},
            metadata={"is_sample_media": True},
        )
        assert sample_saved is None
        assert len(empty_db.list_runs()) == 0
        assert empty_db.get_analytics_summary()["total_runs"] == 0

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_meaningful_error_without_mock_success_fallback(self):
        client = TestClient(app)
        # Pass completely corrupted image bytes
        corrupt_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 20
        res = client.post("/api/detect/image", files={"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")})
        assert res.status_code == 400
        data = res.json()
        assert "decode" in data["detail"].lower()
        # Must never return a fake 200 with fabricated bounding boxes
        assert res.status_code != 200

    def test_device_and_active_model_reporting(self):
        from backend.inference.detector import VehicleDetector
        detector = VehicleDetector()
        status = detector.get_system_status()
        assert "device" in status
        assert "device_display" in status
        if not torch.cuda.is_available():
            assert "CPU" in status["device_display"]
            assert status["is_cuda_available"] is False
            assert "None" in status["gpu_name"]
        assert status["architecture"]["input_resolution"] == "512x288"
        assert status["architecture"]["downsample_ratio"] == 4

    def test_video_upload_and_tracking_endpoint(self):
        client = TestClient(app)
        temp_dir = tempfile.mkdtemp()
        vid_path = os.path.join(temp_dir, "test_clip.mp4")

        # Create a small 3-frame 320x240 video
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(vid_path, fourcc, 10.0, (320, 240))
        for _ in range(3):
            frame = np.full((240, 320, 3), 120, dtype=np.uint8)
            writer.write(frame)
        writer.release()

        with open(vid_path, "rb") as f:
            vid_bytes = f.read()

        res = client.post(
            "/api/detect/video",
            files={"file": ("test_clip.mp4", vid_bytes, "video/mp4")},
            data={"conf_thresh": "0.35", "max_frames": "3", "frame_stride": "1"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["media_type"] == "video"
        assert data["processed_frames"] == 3
        assert "timeline" in data
        assert len(data["timeline"]) == 3
        assert "annotated_url" in data
        assert data["annotated_url"].endswith(".mp4")
        assert "saved_run" in data
        assert data["saved_run"] is not None
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_corrupt_video_upload_endpoint(self):
        client = TestClient(app)
        corrupt_bytes = b"ftypmp42" + b"\x00" * 30
        res = client.post(
            "/api/detect/video",
            files={"file": ("corrupt.mp4", corrupt_bytes, "video/mp4")},
        )
        assert res.status_code in (400, 500)
        assert res.status_code != 200



