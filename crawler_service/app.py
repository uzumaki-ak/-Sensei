import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CRAWLER_DIR = PROJECT_ROOT / "scripts" / "crawler"
if str(CRAWLER_DIR) not in sys.path:
    sys.path.insert(0, str(CRAWLER_DIR))

from discovery import DiscoveryEngine  # noqa: E402
from engine import CrawlerEngine  # noqa: E402
from handlers import get_handler  # noqa: E402


API_TOKEN = (os.getenv("CRAWLER_API_TOKEN") or "").strip()

app = FastAPI(title="Career Coach Crawler Service", version="1.0.0")


class DiscoverRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2000)


def require_auth(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        return

    expected = f"Bearer {API_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/discover")
async def discover(payload: DiscoverRequest, authorization: Optional[str] = Header(default=None)):
    require_auth(authorization)
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    try:
        discovery = DiscoveryEngine()
        result = await discovery.run_discovery(query)
        urls = result.get("discovered_urls", []) if isinstance(result, dict) else []
        return {"discovered_urls": urls}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {error}") from error


@app.post("/scrape")
async def scrape(payload: ScrapeRequest, authorization: Optional[str] = Header(default=None)):
    require_auth(authorization)
    url = payload.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid URL")

    try:
        engine = CrawlerEngine(headless=True)
        handler = get_handler(url)
        result = await engine.scrape_url(url, handler)
        if not result:
            return {"error": "Failed to extract data"}
        return result
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {error}") from error
