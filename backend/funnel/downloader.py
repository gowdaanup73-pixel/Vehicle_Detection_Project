import ipaddress
import os
import socket
import urllib.parse
import uuid
import cv2
import httpx
from fastapi import HTTPException
from .base import get_user_agent

MAX_IMAGE_SIZE = 25 * 1024 * 1024  # 25 MB
CHUNK_SIZE = 64 * 1024


def validate_url_for_ssrf(url: str) -> None:
    """Validates that a URL is safe from SSRF attacks."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.",
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: missing hostname.")

    clean_host = hostname.strip().lower()
    # Direct check for localhost, loopback, or cloud metadata endpoints
    if clean_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
        raise HTTPException(
            status_code=400,
            detail=f"Access to local or internal address '{hostname}' is blocked.",
        )

    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    try:
        addr_infos = socket.getaddrinfo(clean_host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f"Could not resolve host '{hostname}': {e}")

    for family, _, _, _, sockaddr in addr_infos:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_multicast
                or ip.is_reserved
                or ip.is_unspecified
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Access to private or local network address '{ip_str}' is blocked (SSRF protection).",
                )
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid IP address resolved: '{ip_str}'")


async def download_image_from_url(
    url: str,
    dest_dir: str,
    timeout: float = 10.0,
    max_size: int = MAX_IMAGE_SIZE,
) -> str:
    """
    Downloads an image from URL with SSRF protection, size limits, and content-type validation.
    Returns the absolute path to the saved local image file.
    """
    validate_url_for_ssrf(url)

    headers = {
        "User-Agent": get_user_agent(),
        "Accept": "image/jpeg,image/png,image/webp,image/*;q=0.8",
    }

    unique_id = uuid.uuid4().hex[:8]
    filename = f"funnel_{unique_id}.jpg"
    dest_path = os.path.join(dest_dir, filename)

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            async with client.stream("GET", url, headers=headers) as resp:
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Image download failed with HTTP status {resp.status_code}",
                    )

                # Re-validate redirected destination URL
                final_url = str(resp.url)
                if final_url != url:
                    validate_url_for_ssrf(final_url)

                content_type = resp.headers.get("content-type", "").lower()
                # Verify content type
                if content_type and not (
                    content_type.startswith("image/")
                    or "application/octet-stream" in content_type
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid content-type '{content_type}'. Expected an image.",
                    )

                total_bytes = 0
                with open(dest_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=CHUNK_SIZE):
                        total_bytes += len(chunk)
                        if total_bytes > max_size:
                            raise HTTPException(
                                status_code=413,
                                detail=f"Image exceeds maximum permitted size of {max_size // (1024 * 1024)} MB.",
                            )
                        f.write(chunk)

                if total_bytes == 0:
                    raise HTTPException(status_code=400, detail="Downloaded image is empty.")

    except HTTPException:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except OSError:
                pass
        raise
    except Exception as e:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except OSError:
                pass
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")

    # Verify image decoding
    img_bgr = cv2.imread(dest_path)
    if img_bgr is None:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except OSError:
                pass
        raise HTTPException(status_code=400, detail="Downloaded file could not be decoded as an image.")

    return dest_path
