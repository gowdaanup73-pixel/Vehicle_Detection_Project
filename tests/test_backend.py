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
        assert len(data["experiments"]) >= 4

    def test_api_dataset_info(self):
        client = TestClient(app)
        res = client.get("/api/dataset/info")
        assert res.status_code == 200
        data = res.json()
        assert "UA-DETRAC" in data["name"]

    def test_api_detect_sample(self):
        client = TestClient(app)
        res = client.post("/api/detect/sample?media_type=image&conf_thresh=0.35")
        assert res.status_code == 200
        data = res.json()
        assert "run_id" in data
        assert "detections" in data
        assert "annotated_url" in data
