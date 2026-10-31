"""
Persistent SQLite Storage for Runs, Telemetry, and Diagnostics
Stores analysis runs, vehicle detections, tracking statistics, and artifact paths.
"""
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime
import json
import os
import sqlite3
import statistics
from typing import Dict, List, Optional

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "runs.db")


from contextlib import contextmanager

class RunsDatabase:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS runs (
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
                    run_type TEXT DEFAULT 'user_upload',
                    source TEXT DEFAULT 'user_upload',
                    source_url TEXT DEFAULT NULL,
                    creator TEXT DEFAULT NULL,
                    license TEXT DEFAULT NULL,
                    source_page_url TEXT DEFAULT NULL
                )
            """)
            # Ensure migration columns exist if table was created in an older schema
            cursor.execute("PRAGMA table_info(runs)")
            cols = [col[1] for col in cursor.fetchall()]
            if "run_type" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN run_type TEXT DEFAULT 'user_upload'")
            if "source" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN source TEXT DEFAULT 'user_upload'")
            if "source_url" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN source_url TEXT DEFAULT NULL")
            if "creator" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN creator TEXT DEFAULT NULL")
            if "license" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN license TEXT DEFAULT NULL")
            if "source_page_url" not in cols:
                cursor.execute("ALTER TABLE runs ADD COLUMN source_page_url TEXT DEFAULT NULL")
            conn.commit()

    def save_run(
        self,
        run_id: str,
        media_type: str,
        filename: str,
        input_url: str,
        annotated_url: str,
        model_name: str,
        weights_status: str,
        latency_ms: float,
        fps: float,
        total_detections: int,
        unique_vehicles: int,
        line_crossings: int,
        class_counts: Dict[str, int],
        timeline: Optional[List[Dict]] = None,
        metadata: Optional[Dict] = None,
        timestamp: Optional[str] = None,
        run_type: str = "user_upload",
        source: str = "user_upload",
        source_url: Optional[str] = None,
        creator: Optional[str] = None,
        license: Optional[str] = None,
        source_page_url: Optional[str] = None,
    ) -> Optional[Dict]:
        # Do not insert demo sample runs into production operational history
        if filename.startswith("sample_") or (metadata and metadata.get("is_sample_media")):
            return None

        now_iso = timestamp or datetime.now().isoformat()
        meta = dict(metadata or {})
        meta["run_type"] = run_type
        meta["source"] = source
        if source_url:
            meta["source_url"] = source_url
        if creator:
            meta["creator"] = creator
        if license:
            meta["license"] = license
        if source_page_url:
            meta["source_page_url"] = source_page_url

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO runs (
                    id, timestamp, media_type, filename, input_url, annotated_url,
                    model_name, weights_status, latency_ms, fps,
                    total_detections, unique_vehicles, line_crossings,
                    class_counts_json, timeline_json, metadata_json, run_type,
                    source, source_url, creator, license, source_page_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id,
                now_iso,
                media_type,
                filename,
                input_url,
                annotated_url,
                model_name,
                weights_status,
                latency_ms,
                fps,
                total_detections,
                unique_vehicles,
                line_crossings,
                json.dumps(class_counts),
                json.dumps(timeline) if timeline else None,
                json.dumps(meta),
                run_type,
                source,
                source_url,
                creator,
                license,
                source_page_url,
            ))
            conn.commit()

        return self.get_run(run_id)

    def get_run(self, run_id: str) -> Optional[Dict]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._format_row(row)

    def list_runs(self, limit: int = 50, media_type: Optional[str] = None) -> List[Dict]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if media_type:
                cursor.execute(
                    """SELECT * FROM runs 
                       WHERE media_type = ? 
                         AND filename NOT LIKE 'sample_%' 
                       ORDER BY timestamp DESC, rowid DESC LIMIT ?""",
                    (media_type, limit)
                )
            else:
                cursor.execute(
                    """SELECT * FROM runs 
                       WHERE filename NOT LIKE 'sample_%' 
                       ORDER BY timestamp DESC, rowid DESC LIMIT ?""",
                    (limit,)
                )
            rows = cursor.fetchall()
            return [self._format_row(r) for r in rows]

    def delete_run(self, run_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM runs WHERE id = ?", (run_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_analytics_summary(self) -> Dict:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, timestamp, media_type, filename, weights_status, latency_ms, total_detections, 
                       unique_vehicles, line_crossings, class_counts_json, metadata_json
                FROM runs 
                WHERE filename NOT LIKE 'sample_%'
                ORDER BY timestamp ASC
            """)
            rows = cursor.fetchall()

            total_runs = len(rows)
            image_runs = sum(1 for r in rows if r["media_type"] == "image")
            video_runs = sum(1 for r in rows if r["media_type"] == "video")

            failed_runs = 0
            successful_runs = 0
            successful_rows = []

            for r in rows:
                meta = {}
                try:
                    meta = json.loads(r["metadata_json"] or "{}")
                except Exception:
                    pass
                is_failed = (
                    r["weights_status"] == "FAILED"
                    or meta.get("status") == "FAILED"
                    or meta.get("error") is not None
                )
                if is_failed:
                    failed_runs += 1
                else:
                    successful_runs += 1
                    successful_rows.append((r, meta))

            success_rate = round((successful_runs / total_runs * 100.0), 1) if total_runs > 0 else 100.0

            latencies = [float(r["latency_ms"]) for r, _ in successful_rows if r["latency_ms"] is not None and float(r["latency_ms"]) > 0]
            avg_latency = round(statistics.mean(latencies), 2) if latencies else 0.0
            median_latency = round(statistics.median(latencies), 2) if latencies else 0.0

            total_detections = 0
            # Unique vehicles are only counted from video runs where multi-object tracking is applied
            total_unique = 0
            total_crossings = 0
            aggregated_classes = {"car": 0, "van": 0, "bus": 0, "others": 0}

            date_volume = defaultdict(lambda: {"detections": 0, "runs": 0})
            confidence_scores = []
            per_run_breakdown = []

            for r, meta in successful_rows:
                dets = r["total_detections"] or 0
                total_detections += dets
                if r["media_type"] == "video":
                    total_unique += r["unique_vehicles"] or 0
                total_crossings += r["line_crossings"] or 0

                per_run_breakdown.append({
                    "id": r["id"],
                    "filename": r["filename"],
                    "media_type": r["media_type"],
                    "detections": dets,
                    "unique_vehicles": r["unique_vehicles"] or 0,
                    "latency_ms": r["latency_ms"],
                    "timestamp": r["timestamp"],
                })

                d_key = r["timestamp"][:10] if r["timestamp"] else "Unknown"
                date_volume[d_key]["detections"] += dets
                date_volume[d_key]["runs"] += 1

                try:
                    c_dict = json.loads(r["class_counts_json"] or "{}")
                    for k, v in c_dict.items():
                        if k in aggregated_classes:
                            aggregated_classes[k] += v
                        else:
                            aggregated_classes["others"] += v
                except Exception:
                    pass

                dets_list = meta.get("detections", [])
                for d in dets_list:
                    score = d.get("score") or d.get("confidence")
                    if score is not None:
                        confidence_scores.append(float(score))

            hist_bins = [
                {"bin": "30-40%", "min": 0.30, "max": 0.40, "count": 0},
                {"bin": "40-50%", "min": 0.40, "max": 0.50, "count": 0},
                {"bin": "50-60%", "min": 0.50, "max": 0.60, "count": 0},
                {"bin": "60-70%", "min": 0.60, "max": 0.70, "count": 0},
                {"bin": "70-80%", "min": 0.70, "max": 0.80, "count": 0},
                {"bin": "80-90%", "min": 0.80, "max": 0.90, "count": 0},
                {"bin": "90-100%", "min": 0.90, "max": 1.01, "count": 0},
            ]
            for s in confidence_scores:
                for b in hist_bins:
                    if b["min"] <= s < b["max"]:
                        b["count"] += 1
                        break

            runs_over_time = [
                {"date": k, "detections": v["detections"], "runs": v["runs"]}
                for k, v in sorted(date_volume.items())
            ]

            return {
                "total_runs": total_runs,
                "successful_runs": successful_runs,
                "failed_runs": failed_runs,
                "success_rate": success_rate,
                "image_runs": image_runs,
                "video_runs": video_runs,
                "total_detections": total_detections,
                "total_unique_vehicles": total_unique,
                "total_line_crossings": total_crossings,
                "average_latency_ms": avg_latency,
                "median_latency_ms": median_latency,
                "class_distribution": aggregated_classes,
                "runs_over_time": runs_over_time,
                "confidence_histogram": hist_bins,
                "total_confidence_samples": len(confidence_scores),
                "per_run_breakdown": per_run_breakdown,
            }

    def _format_row(self, row: sqlite3.Row) -> Dict:
        d = dict(row)
        try:
            d["class_counts"] = json.loads(d.pop("class_counts_json", "{}"))
        except Exception:
            d["class_counts"] = {}

        try:
            d["timeline"] = json.loads(d.pop("timeline_json", "[]")) if d.get("timeline_json") else []
        except Exception:
            d["timeline"] = []

        try:
            d["metadata"] = json.loads(d.pop("metadata_json", "{}")) if d.get("metadata_json") else {}
        except Exception:
            d["metadata"] = {}

        d["run_type"] = d.get("run_type") or (d.get("metadata") or {}).get("run_type", "user_upload")
        d["source"] = d.get("source") or (d.get("metadata") or {}).get("source", "user_upload")
        d["source_url"] = d.get("source_url") or (d.get("metadata") or {}).get("source_url")
        d["creator"] = d.get("creator") or (d.get("metadata") or {}).get("creator")
        d["license"] = d.get("license") or (d.get("metadata") or {}).get("license")
        d["source_page_url"] = d.get("source_page_url") or (d.get("metadata") or {}).get("source_page_url")
        return d
