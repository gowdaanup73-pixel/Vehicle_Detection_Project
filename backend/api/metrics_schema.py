import json
import logging
import os
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ModelMetrics(BaseModel):
    name: str
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    accuracy: Optional[float] = None
    mAP50: Optional[float] = None
    mAP50_95: Optional[float] = None
    fps: Optional[float] = None
    latency_ms: Optional[float] = None
    params: Optional[float] = None
    gflops: Optional[float] = None


class ClassMetrics(BaseModel):
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    ap50: Optional[float] = None


class ConfusionMatrixData(BaseModel):
    classes: List[str] = Field(default_factory=lambda: ["car", "van", "bus", "others"])
    matrix: Optional[List[List[Optional[float]]]] = None


class ConditionMetrics(BaseModel):
    sunny: Optional[float] = None
    night: Optional[float] = None
    rainy: Optional[float] = None
    cloudy: Optional[float] = None


class EpochMetrics(BaseModel):
    epoch: int
    train_loss: Optional[float] = None
    val_loss: Optional[float] = None
    val_map_50: Optional[float] = None


class MetricsResponse(BaseModel):
    models: List[ModelMetrics] = Field(default_factory=list)
    per_class: Dict[str, ClassMetrics] = Field(default_factory=dict)
    confusion_matrix: Optional[ConfusionMatrixData] = None
    per_condition: ConditionMetrics = Field(default_factory=ConditionMetrics)
    history: List[EpochMetrics] = Field(default_factory=list)
    error: Optional[str] = None


def get_default_null_metrics(error: Optional[str] = None) -> MetricsResponse:
    default_models = ["Baseline", "+CBAM", "+BiFPN", "Improved CenterNet", "INT8"]
    default_classes = ["car", "van", "bus", "others"]
    return MetricsResponse(
        models=[ModelMetrics(name=name) for name in default_models],
        per_class={c: ClassMetrics() for c in default_classes},
        confusion_matrix=ConfusionMatrixData(classes=default_classes, matrix=None),
        per_condition=ConditionMetrics(),
        history=[],
        error=error,
    )


def load_metrics_data(json_path: str) -> MetricsResponse:
    if not os.path.exists(json_path):
        logger.error(f"Metrics file not found at: {json_path}")
        return get_default_null_metrics(error=f"Metrics file not found: {json_path}")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read/parse metrics JSON from {json_path}: {e}", exc_info=True)
        return get_default_null_metrics(error=f"Malformed metrics JSON: {e}")

    try:
        return MetricsResponse.model_validate(raw_data)
    except Exception as e:
        logger.error(f"Validation error loading metrics from {json_path}: {e}", exc_info=True)
        return get_default_null_metrics(error=f"Metrics schema validation error: {e}")
