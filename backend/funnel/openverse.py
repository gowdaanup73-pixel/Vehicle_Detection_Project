from typing import List
import httpx

from .base import FunnelImage, get_user_agent


class OpenverseProvider:
    provider_name = "openverse"

    async def search(self, query: str, page: int = 1, limit: int = 20) -> List[FunnelImage]:
        limit = min(max(1, limit), 30)
        url = "https://api.openverse.org/v1/images/"
        params = {
            "q": query,
            "license_type": "commercial",
            "page": page,
            "page_size": limit,
        }
        headers = {
            "User-Agent": get_user_agent(),
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        results_list = data.get("results", [])
        images: List[FunnelImage] = []
        for item in results_list:
            item_id = item.get("id")
            thumb_url = item.get("thumbnail") or item.get("url")
            img_url = item.get("url") or thumb_url
            if not img_url:
                continue

            license_code = (item.get("license") or "").upper()
            license_ver = item.get("license_version") or ""
            license_str = f"CC {license_code} {license_ver}".strip() if license_code else "Open License"

            images.append(
                FunnelImage(
                    id=f"openverse_{item_id}",
                    thumbnail_url=thumb_url,
                    image_url=img_url,
                    title=item.get("title") or "Untitled",
                    creator=item.get("creator") or None,
                    license=license_str,
                    license_url=item.get("license_url"),
                    source_page_url=item.get("foreign_landing_url") or img_url,
                    provider="openverse",
                )
            )
        return images
