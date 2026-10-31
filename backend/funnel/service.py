import asyncio
import time
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException

from .base import FunnelImage, FunnelSearchResult, DEFAULT_PRESETS
from .commons import WikimediaCommonsProvider
from .openverse import OpenverseProvider


class FunnelService:
    def __init__(self, cache_ttl_seconds: int = 600, rate_limit_per_minute: int = 60):
        self.cache_ttl = cache_ttl_seconds
        self.rate_limit = rate_limit_per_minute
        self.commons_provider = WikimediaCommonsProvider()
        self.openverse_provider = OpenverseProvider()
        self._cache: Dict[str, Tuple[float, FunnelSearchResult]] = {}
        self._ip_requests: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()

    def check_rate_limit(self, client_ip: str) -> None:
        now = time.time()
        window_start = now - 60.0
        timestamps = self._ip_requests.setdefault(client_ip, [])
        # prune old timestamps
        self._ip_requests[client_ip] = [t for t in timestamps if t > window_start]
        if len(self._ip_requests[client_ip]) >= self.rate_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit of {self.rate_limit} search requests per minute exceeded.",
            )
        self._ip_requests[client_ip].append(now)

    def _get_cache_key(self, query: str, source: str, page: int, limit: int) -> str:
        return f"{query.strip().lower()}:{source}:{page}:{limit}"

    async def search(
        self,
        query: str,
        source: str = "both",
        page: int = 1,
        limit: int = 20,
        client_ip: Optional[str] = None,
    ) -> FunnelSearchResult:
        if client_ip:
            self.check_rate_limit(client_ip)

        cleaned_query = (query or "").strip()
        if not cleaned_query:
            cleaned_query = DEFAULT_PRESETS[0]

        source = (source or "both").lower()
        if source not in ("openverse", "commons", "both"):
            source = "both"

        limit = min(max(1, limit), 30)
        page = max(1, page)

        cache_key = self._get_cache_key(cleaned_query, source, page, limit)
        now = time.time()

        async with self._lock:
            if cache_key in self._cache:
                timestamp, cached_result = self._cache[cache_key]
                if now - timestamp < self.cache_ttl:
                    return cached_result
                else:
                    del self._cache[cache_key]

        providers_to_query = []
        if source in ("commons", "both"):
            providers_to_query.append(("commons", self.commons_provider))
        if source in ("openverse", "both"):
            providers_to_query.append(("openverse", self.openverse_provider))

        images: List[FunnelImage] = []
        errors: Dict[str, str] = {}

        tasks = [
            (name, asyncio.wait_for(provider.search(cleaned_query, page=page, limit=limit), timeout=10.0))
            for name, provider in providers_to_query
        ]

        results = await asyncio.gather(
            *[task for _, task in tasks],
            return_exceptions=True,
        )

        for (provider_name, _), res in zip(tasks, results):
            if isinstance(res, Exception):
                if isinstance(res, asyncio.TimeoutError):
                    errors[provider_name] = f"{provider_name} request timed out after 10s"
                else:
                    errors[provider_name] = str(res)
            elif isinstance(res, list):
                images.extend(res)

        # Truncate to requested limit
        images = images[:limit]

        error_msg: Optional[str] = None
        if errors:
            if len(images) == 0:
                error_msg = "; ".join(errors.values())
            else:
                error_msg = f"Notice: {'; '.join(errors.values())}"

        result = FunnelSearchResult(
            query=cleaned_query,
            source=source,
            page=page,
            limit=limit,
            total=len(images),
            images=images,
            results=list(images),
            presets=list(DEFAULT_PRESETS),
            error=error_msg,
            errors=errors,
        )

        # Cache only when at least one result succeeded to allow prompt retries on outage
        if len(images) > 0:
            async with self._lock:
                self._cache[cache_key] = (now, result)

        return result


funnel_service = FunnelService()
