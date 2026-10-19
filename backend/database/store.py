"""
Persistent SQLite Storage for Runs, Telemetry, and Diagnostics
Stores analysis runs, vehicle detections, tracking statistics, and artifact paths.
"""
import json
import os
import sqlite3
from datetime import datetime
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
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
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
                    metadata_json TEXT
                )
            """)
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
    ) -> Dict:
        now_iso = datetime.now().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO runs (
                    id, timestamp, media_type, filename, input_url, annotated_url,
                    model_name, weights_status, latency_ms, fps,
                    total_detections, unique_vehicles, line_crossings,
                    class_counts_json, timeline_json, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                json.dumps(metadata) if metadata else None,
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
                    "SELECT * FROM runs WHERE media_type = ? ORDER BY timestamp DESC LIMIT ?",
                    (media_type, limit)
                )
            else:
                cursor.execute(
                    "SELECT * FROM runs ORDER BY timestamp DESC LIMIT ?",
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
            cursor.execute("SELECT COUNT(*) as count, AVG(latency_ms) as avg_latency FROM runs")
            agg = cursor.fetchone()

            total_runs = agg["count"] if agg else 0
            avg_latency = round(agg["avg_latency"], 2) if agg and agg["avg_latency"] else 0.0

            cursor.execute("SELECT class_counts_json, unique_vehicles, line_crossings, total_detections FROM runs")
            rows = cursor.fetchall()

            total_detections = 0
            total_unique = 0
            total_crossings = 0
            aggregated_classes = {"car": 0, "van": 0, "bus": 0, "others": 0}

            for r in rows:
                total_detections += r["total_detections"] or 0
                total_unique += r["unique_vehicles"] or 0
                total_crossings += r["line_crossings"] or 0
                try:
                    c_dict = json.loads(r["class_counts_json"] or "{}")
                    for k, v in c_dict.items():
                        if k in aggregated_classes:
                            aggregated_classes[k] += v
                        else:
                            aggregated_classes["others"] += v
                except Exception:
                    pass

            return {
                "total_runs": total_runs,
                "total_detections": total_detections,
                "total_unique_vehicles": total_unique,
                "total_line_crossings": total_crossings,
                "average_latency_ms": avg_latency,
                "class_distribution": aggregated_classes,
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

        return d
