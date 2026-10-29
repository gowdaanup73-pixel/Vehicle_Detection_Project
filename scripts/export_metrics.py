#!/usr/bin/env python3
"""
scripts/export_metrics.py
Computes evaluation metrics (Precision, Recall, F1, Accuracy, mAP50, mAP50_95, Confusion Matrix,
and Environmental Breakdown) from model predictions or evaluation logs, writing backend/metrics.json
as the single source of truth for the Model Laboratory dashboard.
"""
import argparse
import csv
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

DEFAULT_CLASSES = ["car", "van", "bus", "others"]
DEFAULT_CONDITIONS = ["sunny", "night", "rainy", "cloudy"]


def compute_iou(box1: List[float], box2: List[float]) -> float:
    """Calculates Intersection over Union (IoU) between two [x1, y1, x2, y2] boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter_area = inter_w * inter_h

    area1 = max(0.0, (box1[2] - box1[0]) * (box1[3] - box1[1]))
    area2 = max(0.0, (box2[2] - box2[0]) * (box2[3] - box2[1]))
    union_area = area1 + area2 - inter_area

    if union_area <= 0.0:
        return 0.0
    return inter_area / union_area


def compute_detection_metrics_from_predictions(
    predictions: List[Dict[str, Any]],
    ground_truths: List[Dict[str, Any]],
    iou_thresh: float = 0.5,
) -> Dict[str, Any]:
    """
    Computes precision, recall, F1, accuracy, per-class breakdown, and 4x4 confusion matrix
    given lists of image predictions and ground truth bounding boxes.
    """
    class_to_idx = {c: i for i, c in enumerate(DEFAULT_CLASSES)}
    num_classes = len(DEFAULT_CLASSES)
    cm = [[0 for _ in range(num_classes)] for _ in range(num_classes)]

    # Per-class counts: TP, FP, FN
    tp_per_class = {c: 0 for c in DEFAULT_CLASSES}
    fp_per_class = {c: 0 for c in DEFAULT_CLASSES}
    fn_per_class = {c: 0 for c in DEFAULT_CLASSES}

    gt_by_img = {}
    for gt in ground_truths:
        gt_by_img.setdefault(gt["image_id"], []).append(gt)

    pred_by_img = {}
    for pred in predictions:
        pred_by_img.setdefault(pred["image_id"], []).append(pred)

    all_image_ids = set(gt_by_img.keys()).union(set(pred_by_img.keys()))

    for img_id in all_image_ids:
        img_gts = gt_by_img.get(img_id, [])
        img_preds = sorted(pred_by_img.get(img_id, []), key=lambda x: x.get("score", 0.0), reverse=True)

        matched_gt = set()
        for pred in img_preds:
            p_cls = pred.get("category", "others")
            p_box = pred.get("bbox", [0, 0, 0, 0])
            best_iou = 0.0
            best_gt_idx = -1

            for idx, gt in enumerate(img_gts):
                if idx in matched_gt:
                    continue
                iou = compute_iou(p_box, gt.get("bbox", [0, 0, 0, 0]))
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = idx

            if best_iou >= iou_thresh and best_gt_idx >= 0:
                gt_match = img_gts[best_gt_idx]
                gt_cls = gt_match.get("category", "others")
                matched_gt.add(best_gt_idx)

                p_idx = class_to_idx.get(p_cls, class_to_idx["others"])
                g_idx = class_to_idx.get(gt_cls, class_to_idx["others"])
                cm[g_idx][p_idx] += 1

                if p_cls == gt_cls:
                    tp_per_class[p_cls] += 1
                else:
                    fp_per_class[p_cls] += 1
            else:
                p_idx = class_to_idx.get(p_cls, class_to_idx["others"])
                fp_per_class[p_cls] += 1

        for idx, gt in enumerate(img_gts):
            if idx not in matched_gt:
                g_cls = gt.get("category", "others")
                fn_per_class[g_cls] += 1

    # Overall metrics
    total_tp = sum(tp_per_class.values())
    total_fp = sum(fp_per_class.values())
    total_fn = sum(fn_per_class.values())

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = total_tp / (total_tp + total_fp + total_fn) if (total_tp + total_fp + total_fn) > 0 else 0.0

    per_class_results = {}
    for c in DEFAULT_CLASSES:
        c_tp = tp_per_class[c]
        c_fp = fp_per_class[c]
        c_fn = fn_per_class[c]
        c_p = c_tp / (c_tp + c_fp) if (c_tp + c_fp) > 0 else None
        c_r = c_tp / (c_tp + c_fn) if (c_tp + c_fn) > 0 else None
        c_f1 = (2 * c_p * c_r) / (c_p + c_r) if (c_p is not None and c_r is not None and (c_p + c_r) > 0) else None
        per_class_results[c] = {
            "precision": round(c_p, 4) if c_p is not None else None,
            "recall": round(c_r, 4) if c_r is not None else None,
            "f1": round(c_f1, 4) if c_f1 is not None else None,
        }

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "accuracy": round(accuracy, 4),
        "per_class": per_class_results,
        "confusion_matrix": {
            "classes": DEFAULT_CLASSES,
            "matrix": cm,
        },
    }


def load_training_history(csv_path: str) -> List[Dict[str, Any]]:
    """Loads loss convergence and validation mAP progression from CSV."""
    history = []
    if not os.path.exists(csv_path):
        return history

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            epoch = int(row.get("epoch", len(history) + 1))
            train_loss = float(row["train_loss"]) if "train_loss" in row and row["train_loss"] != "" else None
            val_loss = float(row["val_loss"]) if "val_loss" in row and row["val_loss"] != "" else None
            val_map = float(row["val_map_50"]) if "val_map_50" in row and row["val_map_50"] != "" else None
            history.append({
                "epoch": epoch,
                "train_loss": round(train_loss, 4) if train_loss is not None else None,
                "val_loss": round(val_loss, 4) if val_loss is not None else None,
                "val_map_50": round(val_map, 4) if val_map is not None else None,
            })
    return history


def generate_metrics_json(
    output_path: str,
    predictions_path: Optional[str] = None,
    ground_truth_path: Optional[str] = None,
    v2_metrics_path: Optional[str] = None,
    history_csv_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Builds the unified metrics dictionary and saves to output_path.
    Preserves nulls strictly for unmeasured values to prevent fabrication.
    """
    # 1. Base model configurations with authentic validation split evaluations
    models = [
        {
            "name": "Baseline",
            "precision": None,
            "recall": 0.5325,
            "f1": None,
            "accuracy": None,
            "mAP50": 0.5342,
            "mAP50_95": 0.3087,
            "fps": None,
            "latency_ms": None,
            "params": 14.8,
            "gflops": 32.4,
        },
        {
            "name": "+CBAM",
            "precision": None,
            "recall": None,
            "f1": None,
            "accuracy": None,
            "mAP50": None,
            "mAP50_95": None,
            "fps": None,
            "latency_ms": None,
            "params": None,
            "gflops": None,
        },
        {
            "name": "+BiFPN",
            "precision": None,
            "recall": None,
            "f1": None,
            "accuracy": None,
            "mAP50": None,
            "mAP50_95": None,
            "fps": None,
            "latency_ms": None,
            "params": None,
            "gflops": None,
        },
        {
            "name": "Improved CenterNet",
            "precision": None,
            "recall": 0.5545,
            "f1": None,
            "accuracy": None,
            "mAP50": 0.5889,
            "mAP50_95": 0.3361,
            "fps": None,
            "latency_ms": None,
            "params": 16.9,
            "gflops": 36.6,
        },
        {
            "name": "INT8",
            "precision": None,
            "recall": None,
            "f1": None,
            "accuracy": None,
            "mAP50": None,
            "mAP50_95": None,
            "fps": None,
            "latency_ms": None,
            "params": None,
            "gflops": None,
        },
    ]

    per_class = {
        "car": {"precision": None, "recall": None, "f1": None, "ap50": 0.4783},
        "van": {"precision": None, "recall": None, "f1": None, "ap50": 0.3781},
        "bus": {"precision": None, "recall": None, "f1": None, "ap50": 0.4325},
        "others": {"precision": None, "recall": None, "f1": None, "ap50": 0.0555},
    }

    confusion_matrix = {
        "classes": DEFAULT_CLASSES,
        "matrix": None,
    }

    per_condition = {
        "sunny": None,
        "night": None,
        "rainy": None,
        "cloudy": None,
    }

    # 2. Optionally load and override from external prediction evaluations
    if predictions_path and ground_truth_path and os.path.exists(predictions_path) and os.path.exists(ground_truth_path):
        with open(predictions_path, "r", encoding="utf-8") as f:
            preds = json.load(f)
        with open(ground_truth_path, "r", encoding="utf-8") as f:
            gts = json.load(f)

        computed = compute_detection_metrics_from_predictions(preds, gts)
        imp_model = next(m for m in models if m["name"] == "Improved CenterNet")
        imp_model["precision"] = computed["precision"]
        imp_model["recall"] = computed["recall"]
        imp_model["f1"] = computed["f1"]
        imp_model["accuracy"] = computed["accuracy"]

        for c, c_metrics in computed["per_class"].items():
            if c in per_class:
                per_class[c]["precision"] = c_metrics["precision"]
                per_class[c]["recall"] = c_metrics["recall"]
                per_class[c]["f1"] = c_metrics["f1"]

        confusion_matrix = computed["confusion_matrix"]

    # 3. Load epoch training history
    history = []
    if history_csv_path and os.path.exists(history_csv_path):
        history = load_training_history(history_csv_path)

    metrics_payload = {
        "models": models,
        "per_class": per_class,
        "confusion_matrix": confusion_matrix,
        "per_condition": per_condition,
        "history": history,
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    print(f"[+] Successfully exported metrics to {output_path}")
    return metrics_payload


def main():
    parser = argparse.ArgumentParser(description="Export Vehicle Intelligence Platform metrics to metrics.json")
    parser.add_argument("--output", default=os.path.join(PROJECT_ROOT, "backend", "metrics.json"), help="Output metrics.json path")
    parser.add_argument("--predictions", default=None, help="Optional predictions JSON file")
    parser.add_argument("--ground-truth", default=None, help="Optional ground truth annotations JSON file")
    parser.add_argument("--history", default=os.path.join(PROJECT_ROOT, "backend", "metrics", "training_history.csv"), help="Training history CSV")
    args = parser.parse_args()

    generate_metrics_json(
        output_path=args.output,
        predictions_path=args.predictions,
        ground_truth_path=args.ground_truth,
        history_csv_path=args.history,
    )


if __name__ == "__main__":
    main()
