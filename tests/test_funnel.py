import asyncio
import os
import sqlite3
import tempfile
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.api.app import app
from backend.database.store import RunsDatabase
from backend.funnel.base import FunnelImage, FunnelSearchResult
from backend.funnel.downloader import validate_url_for_ssrf
from backend.funnel.service import FunnelService


@pytest.fixture
def client():
    return TestClient(app)


class TestFunnelProvidersAndService:
    @pytest.mark.anyio
    async def test_normal_results(self):
        service = FunnelService(cache_ttl_seconds=10)
        img1 = FunnelImage(
            id="commons_1",
            thumbnail_url="http://example.com/thumb1.jpg",
            image_url="http://example.com/img1.jpg",
            title="City Bus",
            creator="Alice",
            license="CC BY-SA 4.0",
            source_page_url="http://example.com/page1",
            provider="commons",
        )
        img2 = FunnelImage(
            id="openverse_2",
            thumbnail_url="http://example.com/thumb2.jpg",
            image_url="http://example.com/img2.jpg",
            title="Highway Traffic",
            creator="Bob",
            license="CC0",
            source_page_url="http://example.com/page2",
            provider="openverse",
        )

        with patch.object(service.commons_provider, "search", new_callable=AsyncMock) as mock_commons, \
             patch.object(service.openverse_provider, "search", new_callable=AsyncMock) as mock_openverse:
            mock_commons.return_value = [img1]
            mock_openverse.return_value = [img2]

            res = await service.search("traffic", source="both", limit=10)
            assert res.total == 2
            assert len(res.images) == 2
            assert res.images[0].provider == "commons"
            assert res.images[1].provider == "openverse"
            assert res.errors == {}

    @pytest.mark.anyio
    async def test_empty_results(self):
        service = FunnelService(cache_ttl_seconds=10)
        with patch.object(service.commons_provider, "search", new_callable=AsyncMock) as mock_commons, \
             patch.object(service.openverse_provider, "search", new_callable=AsyncMock) as mock_openverse:
            mock_commons.return_value = []
            mock_openverse.return_value = []

            res = await service.search("nonexistent query 12345", source="both")
            assert res.total == 0
            assert res.images == []
            assert res.errors == {}

    @pytest.mark.anyio
    async def test_provider_timeout_graceful_degradation(self):
        service = FunnelService(cache_ttl_seconds=10)
        img1 = FunnelImage(
            id="commons_1",
            thumbnail_url="http://example.com/thumb1.jpg",
            image_url="http://example.com/img1.jpg",
            title="Bus",
            creator="Alice",
            license="CC BY-SA 4.0",
            source_page_url="http://example.com/page1",
            provider="commons",
        )

        with patch.object(service.commons_provider, "search", new_callable=AsyncMock) as mock_commons, \
             patch.object(service.openverse_provider, "search", new_callable=AsyncMock) as mock_openverse:
            mock_commons.return_value = [img1]
            mock_openverse.side_effect = asyncio.TimeoutError()

            res = await service.search("traffic", source="both", limit=10)
            assert res.total == 1
            assert res.images[0].provider == "commons"
            assert "openverse" in res.errors
            assert "timed out" in res.errors["openverse"]

    @pytest.mark.anyio
    async def test_malformed_json_graceful_degradation(self):
        service = FunnelService(cache_ttl_seconds=10)
        with patch.object(service.commons_provider, "search", new_callable=AsyncMock) as mock_commons:
            mock_commons.side_effect = ValueError("Malformed JSON from provider")

            res = await service.search("traffic", source="commons")
            assert res.total == 0
            assert res.images == []
            assert "commons" in res.errors
            assert "Malformed JSON" in res.errors["commons"]


class TestSSRFValidation:
    def test_ssrf_blocked_schemes(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            validate_url_for_ssrf("ftp://example.com/image.jpg")
        assert exc.value.status_code == 400
        assert "scheme" in str(exc.value.detail).lower()

    def test_ssrf_blocked_localhost(self):
        from fastapi import HTTPException
        for host in ["localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal"]:
            with pytest.raises(HTTPException) as exc:
                validate_url_for_ssrf(f"http://{host}/secret.jpg")
            assert exc.value.status_code == 400
            assert "blocked" in str(exc.value.detail).lower()


class TestFunnelBatchEndpoint:
    def test_over_limit_rejection(self, client):
        urls = [f"http://example.com/img{i}.jpg" for i in range(21)]
        resp = client.post("/api/funnel/detect-batch", json={"image_urls": urls})
        assert resp.status_code == 400
        assert "maximum batch size is 20" in resp.json().get("detail", "").lower()

    def test_empty_batch_rejection(self, client):
        resp = client.post("/api/funnel/detect-batch", json={"image_urls": []})
        assert resp.status_code == 400
        assert "no image urls" in resp.json().get("detail", "").lower()

    def test_blocked_host_in_batch(self, client):
        resp = client.post(
            "/api/funnel/detect-batch",
            json={"image_urls": ["http://127.0.0.1:8000/private.jpg"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["successful"] == 0
        assert data["failed"] == 1
        res = data["results"][0]
        assert res["status"] == "failed"
        assert "blocked" in res["error"].lower()

    def test_batch_partial_failure_and_attribution(self, client):
        # Find a valid local test image to use for mock download return
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "media", "uploads")
        test_images = [f for f in os.listdir(uploads_dir) if f.endswith((".jpg", ".png"))]
        assert len(test_images) > 0, "At least one test image must exist in backend/media/uploads"
        valid_local_image = os.path.join(uploads_dir, test_images[0])

        async def mock_download(url, dest_dir):
            if "fail" in url:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Remote image not found")
            return valid_local_image

        with patch("backend.api.app.download_image_from_url", side_effect=mock_download):
            payload = {
                "items": [
                    {
                        "image_url": "http://example.com/good_traffic.jpg",
                        "title": "Good Street View",
                        "creator": "Photographer Alice",
                        "license": "CC BY-SA 4.0",
                        "source_page_url": "http://example.com/alice_photo",
                    },
                    {
                        "image_url": "http://example.com/fail_image.jpg",
                        "title": "Broken Link",
                    },
                ]
            }
            resp = client.post("/api/funnel/detect-batch", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["total"] == 2
            assert data["successful"] == 1
            assert data["failed"] == 1

            success_item = next(r for r in data["results"] if r["status"] == "success")
            assert success_item["creator"] == "Photographer Alice"
            assert success_item["license"] == "CC BY-SA 4.0"
            assert success_item["source_page_url"] == "http://example.com/alice_photo"
            assert success_item["run_id"] is not None

            failed_item = next(r for r in data["results"] if r["status"] == "failed")
            assert "Remote image not found" in failed_item["error"]


class TestDatabaseMigration:
    def test_safe_migration_on_legacy_schema(self):
        tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
        try:
            # Create old schema table without funnel columns
            conn = sqlite3.connect(tmp_db)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE runs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    media_type TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    input_url TEXT NOT NULL,
                    annotated_url TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    weights_status TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    fps REAL NOT NULL,
                    total_detections INTEGER NOT NULL,
                    unique_vehicles INTEGER NOT NULL,
                    line_crossings INTEGER NOT NULL,
                    class_counts_json TEXT NOT NULL,
                    timeline_json TEXT,
                    metadata_json TEXT,
                    run_type TEXT DEFAULT 'user_upload'
                )
            """)
            cursor.execute("""
                INSERT INTO runs (
                    id, timestamp, media_type, filename, input_url, annotated_url,
                    model_name, weights_status, latency_ms, fps,
                    total_detections, unique_vehicles, line_crossings,
                    class_counts_json, run_type
                ) VALUES (
                    'legacy_run_1', '2026-01-01T00:00:00', 'image', 'legacy.jpg',
                    '/media/uploads/legacy.jpg', '/media/outputs/legacy.jpg',
                    'CenterNet', 'CONFIGURED_ACTIVE', 10.0, 100.0,
                    2, 2, 0, '{"car": 2}', 'user_upload'
                )
            """)
            conn.commit()
            conn.close()

            # Instantiate RunsDatabase to trigger safe migration
            db = RunsDatabase(tmp_db)

            # Check legacy run
            legacy_run = db.get_run("legacy_run_1")
            assert legacy_run is not None
            assert legacy_run["id"] == "legacy_run_1"
            assert legacy_run["source"] == "user_upload"
            assert legacy_run["creator"] is None
            assert legacy_run["license"] is None

            # Save new funnel run
            new_run = db.save_run(
                run_id="funnel_run_new",
                media_type="image",
                filename="funnel_test.jpg",
                input_url="/media/uploads/funnel_test.jpg",
                annotated_url="/media/outputs/funnel_test.jpg",
                model_name="Improved CenterNet",
                weights_status="CONFIGURED_ACTIVE",
                latency_ms=12.0,
                fps=83.0,
                total_detections=4,
                unique_vehicles=4,
                line_crossings=0,
                class_counts={"car": 3, "bus": 1},
                source="funnel",
                source_url="http://example.com/test.jpg",
                creator="Commons User",
                license="CC-BY-4.0",
                source_page_url="http://commons.wikimedia.org/wiki/File:Test.jpg",
            )
            assert new_run is not None
            assert new_run["source"] == "funnel"
            assert new_run["creator"] == "Commons User"
            assert new_run["license"] == "CC-BY-4.0"
            assert new_run["source_page_url"] == "http://commons.wikimedia.org/wiki/File:Test.jpg"

            # Check list_runs includes both
            all_runs = db.list_runs()
            assert len(all_runs) == 2
        finally:
            if os.path.exists(tmp_db):
                try:
                    os.remove(tmp_db)
                except OSError:
                    pass
