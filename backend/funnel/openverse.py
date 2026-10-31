from typing import List
import httpx

from .base import FunnelImage, get_user_agent


class OpenverseProvider:
    provider_name = "openverse"

    async def search(self, query: str, page: int = 1, limit: int = 20) -> List[FunnelImage]:
        # Openverse anonymous access enforces page_size <= 20
        page_size = min(max(1, limit), 20)
        url = "https://api.openverse.org/v1/images/"
        params = {
            "q": query,
            "license_type": "commercial",
            "page": page,
            "page_size": page_size,
        }
        headers = {
            "User-Agent": get_user_agent(),
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 429:
                    raise Exception("Openverse is rate-limiting, try again or switch to Wikimedia Commons")
                if resp.status_code == 401:
                    raise Exception("Openverse anonymous rate limit reached, switch to Wikimedia Commons")
                if resp.status_code == 404:
                    raise Exception("Openverse endpoint not found")
                if resp.status_code >= 500:
                    raise Exception("Openverse service temporarily unavailable")
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            raise Exception("Openverse request timed out, try again or switch to Wikimedia Commons")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise Exception("Openverse is rate-limiting, try again or switch to Wikimedia Commons")
            raise Exception(f"Openverse HTTP {e.response.status_code}")

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
