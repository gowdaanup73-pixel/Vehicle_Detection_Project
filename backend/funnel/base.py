import os
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

DEFAULT_PRESETS = [
    "traffic bus street",
    "highway cars trucks",
    "night traffic road",
    "rainy traffic",
]


def get_user_agent() -> str:
    contact = os.getenv("CONTACT_EMAIL", "vehicle-detection@demo.local")
    return f"VehicleDetectionDemo/1.0 (contact: {contact})"


class FunnelImage(BaseModel):
    id: str
    thumbnail_url: str
    image_url: str
    title: str
    creator: Optional[str] = None
    license: str
    license_url: Optional[str] = None
    source_page_url: str
    provider: str


class FunnelSearchResult(BaseModel):
    query: str
    source: str
    page: int
    limit: int
    total: int
    images: List[FunnelImage] = Field(default_factory=list)
    results: List[FunnelImage] = Field(default_factory=list)
    presets: List[str] = Field(default_factory=lambda: list(DEFAULT_PRESETS))
    error: Optional[str] = None
    errors: Dict[str, str] = Field(default_factory=dict)
