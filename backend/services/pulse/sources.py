"""Industry Pulse — three source adapters.

Each `fetch_*` is an async generator yielding normalized posting dicts of shape:
  {
    "source", "employer_slug", "title_raw", "location_raw", "posted_at_raw",
    "description_raw", "external_url", "raw_payload"
  }

The crawler wraps each yield with dedupe / persistence logic. Adapters are
polite (1 req/s per domain, jittered backoff on 429/5xx). One bad tenant
must not kill the run — errors bubble to the crawler which per-employer
try/excepts them.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import AsyncIterator, Optional
from urllib.parse import urljoin

import httpx

from services.pulse.parser import strip_html

log = logging.getLogger(__name__)


class SourceListError(Exception):
    """Raised when a source's LIST endpoint returns non-200 or fails transport.

    Detail-endpoint failures (e.g. per-posting fetches on Workday) don't raise
    — they skip the individual posting. Only the initial list call being
    unhealthy signals that the employer/site slug itself is wrong or blocked,
    which the crawler counts as a failed employer.
    """
    def __init__(self, source: str, url: str, http_status: int | None, message: str):
        self.source = source
        self.url = url
        self.http_status = http_status
        self.message = message
        super().__init__(f"{source} list endpoint {url} — HTTP {http_status}: {message}")


USER_AGENT = "HCMOrbit-PulseBot/0.1 (+https://hcmorbit.com/pulse)"
HTTP_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
PER_DOMAIN_DELAY_S = 1.0                  # ≥1 req/sec/domain
MAX_RETRIES = 3
RETRY_BASE_S = 2.0
WORKDAY_PAGE_LIMIT = 20                   # per source docs
WORKDAY_MAX_PAGES = 20                    # 400 postings/tenant hard cap
WORKDAY_SEARCH_TERM = "Workday"

# One shared throttle table so multiple adapters targeting the same host
# still queue politely. Keyed by hostname.
_last_hit: dict[str, float] = {}


async def _polite_get(client: httpx.AsyncClient, url: str, **kw) -> httpx.Response:
    return await _polite_request(client, "GET", url, **kw)


async def _polite_post(client: httpx.AsyncClient, url: str, **kw) -> httpx.Response:
    return await _polite_request(client, "POST", url, **kw)


async def _polite_request(client: httpx.AsyncClient, method: str, url: str, **kw) -> httpx.Response:
    """Rate-limited + backoff request. Raises on final failure."""
    host = httpx.URL(url).host
    for attempt in range(1, MAX_RETRIES + 1):
        # Rate limit
        wait = PER_DOMAIN_DELAY_S - (asyncio.get_event_loop().time() - _last_hit.get(host, 0))
        if wait > 0:
            await asyncio.sleep(wait + random.uniform(0, 0.25))
        _last_hit[host] = asyncio.get_event_loop().time()
        try:
            resp = await client.request(method, url, **kw)
        except (httpx.TimeoutException, httpx.TransportError) as e:
            if attempt == MAX_RETRIES:
                raise
            log.warning("%s %s transport error attempt %d: %s", method, url, attempt, e)
            await asyncio.sleep(RETRY_BASE_S * attempt + random.uniform(0, 0.8))
            continue
        if resp.status_code == 429 or 500 <= resp.status_code < 600:
            if attempt == MAX_RETRIES:
                return resp
            retry_after = float(resp.headers.get("retry-after") or 0) or RETRY_BASE_S * attempt
            log.warning("%s %s -> %s, backing off %.1fs (attempt %d)",
                        method, url, resp.status_code, retry_after, attempt)
            await asyncio.sleep(retry_after + random.uniform(0, 0.5))
            continue
        return resp
    return resp  # unreachable — placates type-checkers


# ── Workday ────────────────────────────────────────────────────────────────
def _parse_workday_identifier(identifier: str) -> Optional[tuple[str, str, str]]:
    """`{tenant}.{wdN}/{site}` → (host, tenant, site). Returns None on malformed."""
    try:
        host_part, site = identifier.split("/", 1)
        tenant, wd = host_part.split(".", 1)
        host = f"{host_part}.myworkdayjobs.com"
        return host, tenant, site
    except ValueError:
        return None


async def fetch_workday(client: httpx.AsyncClient, employer: dict) -> AsyncIterator[dict]:
    parsed = _parse_workday_identifier(employer["identifier"])
    if not parsed:
        raise SourceListError(
            "workday",
            f"workday://{employer['identifier']}",
            None,
            f"malformed identifier {employer['identifier']!r}",
        )
    host, tenant, site = parsed
    list_url = f"https://{host}/wday/cxs/{tenant}/{site}/jobs"
    detail_base = f"https://{host}/wday/cxs/{tenant}/{site}/"  # trailing slash critical for urljoin

    offset = 0
    pages = 0
    while pages < WORKDAY_MAX_PAGES:
        payload = {
            "appliedFacets": {}, "limit": WORKDAY_PAGE_LIMIT,
            "offset": offset, "searchText": WORKDAY_SEARCH_TERM,
        }
        try:
            resp = await _polite_post(client, list_url, json=payload)
        except httpx.HTTPError as e:
            raise SourceListError("workday", list_url, None, f"transport error: {e}") from e
        if resp.status_code != 200:
            raise SourceListError(
                "workday", list_url, resp.status_code,
                (resp.text or "")[:200].strip() or resp.reason_phrase or "non-200",
            )
        try:
            data = resp.json()
        except ValueError as e:
            raise SourceListError("workday", list_url, resp.status_code, "non-JSON response") from e
        postings = data.get("jobPostings") or []
        if not postings:
            return
        for jp in postings:
            external_path = jp.get("externalPath") or ""
            if not external_path:
                continue
            # Detail fetch — this is where we get the description
            try:
                detail_resp = await _polite_get(client, urljoin(detail_base, external_path.lstrip("/")))
            except httpx.HTTPError as e:
                log.warning("workday detail failed %s%s: %s", host, external_path, e)
                continue
            if detail_resp.status_code != 200:
                continue
            try:
                dd = detail_resp.json()
            except ValueError:
                continue
            jpi = dd.get("jobPostingInfo") or {}
            title = jpi.get("title") or jp.get("title") or ""
            desc = strip_html(jpi.get("jobDescription") or "")
            location = jpi.get("location") or jp.get("locationsText") or ""
            posted = jpi.get("startDate") or jpi.get("postedOn") or jp.get("postedOn")
            ext_url = jpi.get("externalUrl") or urljoin(f"https://{host}/{site}/", external_path.lstrip("/"))
            yield {
                "source": "workday",
                "employer_slug": tenant,
                "title_raw": title,
                "location_raw": location,
                "posted_at_raw": posted,
                "description_raw": desc,
                "external_url": ext_url,
                "raw_payload": {"list": jp, "detail": jpi},
            }
        pages += 1
        offset += WORKDAY_PAGE_LIMIT
        total = int(data.get("total") or 0)
        if offset >= total:
            return


# ── Greenhouse ─────────────────────────────────────────────────────────────
async def fetch_greenhouse(client: httpx.AsyncClient, employer: dict) -> AsyncIterator[dict]:
    slug = employer["identifier"]
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    try:
        resp = await _polite_get(client, url)
    except httpx.HTTPError as e:
        raise SourceListError("greenhouse", url, None, f"transport error: {e}") from e
    if resp.status_code != 200:
        raise SourceListError(
            "greenhouse", url, resp.status_code,
            (resp.text or "")[:200].strip() or resp.reason_phrase or "non-200",
        )
    try:
        data = resp.json()
    except ValueError as e:
        raise SourceListError("greenhouse", url, resp.status_code, "non-JSON response") from e
    for j in data.get("jobs") or []:
        yield {
            "source": "greenhouse",
            "employer_slug": slug,
            "title_raw": j.get("title") or "",
            "location_raw": (j.get("location") or {}).get("name") or "",
            "posted_at_raw": j.get("updated_at") or j.get("first_published"),
            "description_raw": strip_html(j.get("content") or ""),
            "external_url": j.get("absolute_url") or "",
            "raw_payload": j,
        }


# ── Lever ──────────────────────────────────────────────────────────────────
async def fetch_lever(client: httpx.AsyncClient, employer: dict) -> AsyncIterator[dict]:
    slug = employer["identifier"]
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    try:
        resp = await _polite_get(client, url)
    except httpx.HTTPError as e:
        raise SourceListError("lever", url, None, f"transport error: {e}") from e
    if resp.status_code != 200:
        raise SourceListError(
            "lever", url, resp.status_code,
            (resp.text or "")[:200].strip() or resp.reason_phrase or "non-200",
        )
    try:
        data = resp.json()
    except ValueError as e:
        raise SourceListError("lever", url, resp.status_code, "non-JSON response") from e
    if not isinstance(data, list):
        raise SourceListError("lever", url, resp.status_code, f"expected JSON list, got {type(data).__name__}")
    for j in data:
        cats = j.get("categories") or {}
        yield {
            "source": "lever",
            "employer_slug": slug,
            "title_raw": j.get("text") or "",
            "location_raw": cats.get("location") or "",
            "posted_at_raw": j.get("createdAt"),  # epoch ms
            "description_raw": j.get("descriptionPlain") or strip_html(j.get("description") or ""),
            "external_url": j.get("hostedUrl") or "",
            "raw_payload": j,
        }


# ── Dispatch table ──────────────────────────────────────────────────────────
SOURCE_ADAPTERS = {
    "workday":    fetch_workday,
    "greenhouse": fetch_greenhouse,
    "lever":      fetch_lever,
}


def build_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain;q=0.5",
        },
        follow_redirects=True,
    )
