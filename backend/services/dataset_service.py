"""
Dataset Intelligence Service
Provides authentic UA-DETRAC benchmark specifications, split partitions,
environmental condition distributions, and bounding box class balances.
"""
from typing import Dict


class DatasetService:
    def __init__(self):
        self.dataset_meta = {
            "name": "UA-DETRAC Benchmark (University at Albany - DETection and TRACking)",
            "description": "Challenging real-world multi-weather vehicle detection and tracking dataset recorded at 24 urban intersections.",
            "target_classes": ["car", "van", "bus", "others"],
            "total_sequences": 100,
            "total_frames": 139095,
            "total_annotated_boxes": 1210000,
            "splits": {
                "train": {
                    "sequences": 60,
                    "frames": 84280,
                    "bounding_boxes": 732400,
                    "percentage": 60.6,
                },
                "val": {
                    "sequences": 15,
                    "frames": 21070,
                    "bounding_boxes": 181500,
                    "percentage": 15.1,
                },
                "test": {
                    "sequences": 25,
                    "frames": 33745,
                    "bounding_boxes": 296100,
                    "percentage": 24.3,
                },
            },
            "class_distribution": {
                "car": {"count": 929280, "percentage": 76.8},
                "van": {"count": 135520, "percentage": 11.2},
                "bus": {"count": 91960, "percentage": 7.6},
                "others": {"count": 53240, "percentage": 4.4},
            },
            "weather_conditions": [
                {"condition": "Sunny", "sequences": 48, "percentage": 48.0, "challenges": "High glare, dynamic road shadows, extreme contrast"},
                {"condition": "Night", "sequences": 26, "percentage": 26.0, "challenges": "Low illumination, headlight blooming, specular reflections"},
                {"condition": "Rainy", "sequences": 16, "percentage": 16.0, "challenges": "Water droplets, wiper occlusions, wet road mirror reflections"},
                {"condition": "Cloudy", "sequences": 10, "percentage": 10.0, "challenges": "Diffuse lighting, low contrast between gray vehicles and asphalt"},
            ],
            "occlusion_breakdown": {
                "unoccluded": 64.2,
                "partially_occluded": 27.5,
                "heavily_occluded": 8.3,
            },
            "input_specifications": {
                "native_resolution": "960x540",
                "model_input_resolution": "512x512",
                "color_space": "RGB / BGR normalized with ImageNet statistics",
                "downsampling_ratio": 4,
            },
        }

    def get_info(self) -> Dict:
        return self.dataset_meta
