import html
import re
from typing import List
import httpx

from .base import FunnelImage, get_user_agent


def clean_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    return html.unescape(clean).strip()


class WikimediaCommonsProvider:
    provider_name = "commons"

    async def search(self, query: str, page: int = 1, limit: int = 20) -> List[FunnelImage]:
        limit = min(max(1, limit), 30)
        offset = (page - 1) * limit
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": 6,  # File namespace
            "gsrlimit": limit,
            "gsroffset": offset,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|dimensions|mime",
            "iiurlwidth": 1280,
            "format": "json",
        }
        headers = {
            "User-Agent": get_user_agent(),
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        pages = data.get("query", {}).get("pages", {})
        results: List[FunnelImage] = []
        for page_id, page_info in pages.items():
            imageinfo = page_info.get("imageinfo", [])
            if not imageinfo:
                continue
            info = imageinfo[0]
            thumb_url = info.get("thumburl") or info.get("url")
            full_url = info.get("url") or thumb_url
            if not thumb_url:
                continue

            mime = info.get("mime", "")
            if mime and not mime.startswith("image/"):
                continue

            raw_title = page_info.get("title", "")
            if raw_title.lower().startswith("file:"):
                raw_title = raw_title[5:].strip()

            extmeta = info.get("extmetadata", {})
            artist_raw = extmeta.get("Artist", {}).get("value", "")
            creator = clean_html(artist_raw) or None

            license_raw = extmeta.get("LicenseShortName", {}).get("value", "")
            license_name = clean_html(license_raw) or "CC-BY-SA"

            license_url = extmeta.get("LicenseUrl", {}).get("value") or None
            source_page_url = info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{raw_title}"

            results.append(
                FunnelImage(
                    id=f"commons_{page_id}",
                    thumbnail_url=thumb_url,
                    image_url=thumb_url,  # ~1280px version
                    title=raw_title,
                    creator=creator,
                    license=license_name,
                    license_url=license_url,
                    source_page_url=source_page_url,
                    provider="commons",
                )
            )
        return results
