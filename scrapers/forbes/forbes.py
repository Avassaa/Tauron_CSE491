import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag
from curl_cffi import requests as curl_requests

BASE_URL = "https://www.forbes.com"
LIST_URL = f"{BASE_URL}/digital-assets/"
OUTPUT_FILE = Path(__file__).with_name("forbes_news_debug.json")
REQUEST_TIMEOUT = 30

DESKTOP_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
LISTING_MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 5.1.1; SM-J320M Build/LMY47V; wv) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36"
    "[FBAN/EMA;FBLC/es_LA;FBAV/428.0.0.9.105;]"
)

ARTICLE_PATH_RE = re.compile(
    r"/(?:sites/)?digital-assets/\d{4}/\d{1,2}/\d{1,2}/",
    re.IGNORECASE,
)

TITLE_SELECTOR = "#article-num-0 > main > div.ITdpl.KpLaT > h1"
TIME_SELECTOR = "#article-num-0 > main > div.ITdpl.KpLaT > time"
CONTENT_SELECTOR = (
    "#article-num-0 > main > div.YHOim.KpLaT.jOjL0 > div.WkaGZ > div > div.p5_3X > div > "
    "div.fs-article.fs-responsive-text.current-article.article-body"
)


def now_iso8601() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def is_forbes_article_url(url: str) -> bool:
    if not url:
        return False
    base, _ = urldefrag(url.strip())
    if "forbes.com" not in base:
        return False
    path = urlparse(base).path
    return bool(ARTICLE_PATH_RE.search(path))


def extract_listing_from_next_data(html: str) -> List[Dict[str, Optional[str]]]:
    """Forbes listing is often hydrated in __NEXT_DATA__ (especially on mobile Safari responses)."""
    if not html or "__NEXT_DATA__" not in html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        return []

    try:
        data = json.loads(script.string)
    except json.JSONDecodeError:
        return []

    seen: set[str] = set()
    items: List[Dict[str, Optional[str]]] = []

    def maybe_add(raw: str) -> None:
        text = raw.strip()
        if text.startswith("//"):
            text = "https:" + text
        text = text.split("?")[0].strip().replace("http://", "https://")
        if not is_forbes_article_url(text):
            return
        if text in seen:
            return
        seen.add(text)
        slug = text.rstrip("/").split("/")[-1].replace("-", " ")
        title = clean_text(slug) if slug else None
        items.append({"url": text, "title": title})

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for entry in node:
                walk(entry)
        elif isinstance(node, str):
            if "forbes.com" in node and "digital-assets" in node and re.search(r"/20\d{2}/", node):
                maybe_add(node)

    walk(data)
    return items


def parse_iso_to_utc_z(value: str) -> Optional[str]:
    text = clean_text(value)
    if not text:
        return None
    candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        parsed = parsed.astimezone(timezone.utc).replace(microsecond=0)
        return parsed.isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def meta_datetime(soup: BeautifulSoup, prop: str) -> Optional[str]:
    node = soup.select_one(f'meta[property="{prop}"]')
    if not isinstance(node, Tag):
        return None
    content = (node.get("content") or "").strip()
    return content or None


def choose_published_at_from_meta_and_time(soup: BeautifulSoup, time_node: Optional[Tag]) -> Optional[str]:
    """
    publishedAt: ISO 8601 UTC. If article:modified_time is newer than article:published_time, use modified.
    Otherwise prefer explicit <time datetime>, then published meta.
    """
    pub_raw = meta_datetime(soup, "article:published_time") or meta_datetime(soup, "og:published_time")
    mod_raw = meta_datetime(soup, "article:modified_time") or meta_datetime(soup, "og:updated_time")
    pub_iso = parse_iso_to_utc_z(pub_raw) if pub_raw else None
    mod_iso = parse_iso_to_utc_z(mod_raw) if mod_raw else None

    if pub_iso and mod_iso:
        try:
            pub_dt = datetime.fromisoformat(pub_iso.replace("Z", "+00:00"))
            mod_dt = datetime.fromisoformat(mod_iso.replace("Z", "+00:00"))
            if mod_dt > pub_dt:
                return mod_iso
        except ValueError:
            pass
        return pub_iso

    if mod_iso:
        return mod_iso
    if pub_iso:
        return pub_iso

    if isinstance(time_node, Tag):
        dt_attr = (time_node.get("datetime") or "").strip()
        if dt_attr:
            parsed = parse_iso_to_utc_z(dt_attr)
            if parsed:
                return parsed
        text_val = clean_text(time_node.get_text(" ", strip=True))
        if text_val:
            parsed = parse_iso_to_utc_z(text_val)
            if parsed:
                return parsed

    return None


def extract_recursive_text(root: Tag) -> str:
    excluded_tags = {"script", "style", "noscript", "iframe"}
    chunks: List[str] = []

    for node in root.descendants:
        if isinstance(node, Tag):
            if node.name in excluded_tags:
                continue
            continue

        if not isinstance(node, NavigableString):
            continue

        parent = node.parent
        if isinstance(parent, Tag) and parent.name in excluded_tags:
            continue

        text = clean_text(str(node))
        if not text:
            continue
        chunks.append(text)

    merged: List[str] = []
    for chunk in chunks:
        if merged and merged[-1] == chunk:
            continue
        merged.append(chunk)

    return "\n".join(merged)


class ForbesScraper:
    """
    Primary: same pattern as investing.com (stateless curl_cffi.get, chrome124).
    Fallback: Session + homepage cookie + mobile WebView UA on /digital-assets/ when Akamai
    returns 403 on the simple path (listing URLs then appear in __NEXT_DATA__).
    """

    def __init__(self) -> None:
        self.headers = {
            "User-Agent": DESKTOP_UA,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{BASE_URL}/",
        }
        self._session: Optional[curl_requests.Session] = None

    def fetch_page(self, url: str, referer: Optional[str] = None) -> Optional[str]:
        headers = dict(self.headers)
        if referer:
            headers["Referer"] = referer
        try:
            response = curl_requests.get(
                url,
                headers=headers,
                impersonate="chrome124",
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            if response.status_code == 200:
                return response.text
            return None
        except Exception:
            return None

    def fetch_listing_html(self) -> Optional[str]:
        listing_html = self.fetch_page(LIST_URL)
        if listing_html and self.parse_news_list(listing_html):
            self._session = None
            return listing_html

        self._session = curl_requests.Session()
        try:
            home = self._session.get(
                f"{BASE_URL}/",
                headers={
                    "User-Agent": DESKTOP_UA,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "sec-fetch-site": "none",
                },
                impersonate="chrome124",
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            if home.status_code == 200:
                time.sleep(0.45)
        except Exception:
            pass

        mobile_headers = {
            "User-Agent": LISTING_MOBILE_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-LA,es;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{BASE_URL}/",
            "sec-fetch-site": "same-origin",
        }
        for imp in ("chrome99", "chrome110", "chrome124", "safari17_0"):
            try:
                response = self._session.get(
                    LIST_URL,
                    headers=mobile_headers,
                    impersonate=imp,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )
                if response.status_code == 200:
                    return response.text
            except Exception:
                pass
        self._session = None
        return None

    def fetch_article_html(self, url: str) -> Optional[str]:
        if self._session is not None:
            try:
                response = self._session.get(
                    url,
                    headers={
                        "User-Agent": DESKTOP_UA,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": LIST_URL,
                        "sec-fetch-site": "same-origin",
                    },
                    impersonate="chrome124",
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )
                if response.status_code == 200:
                    return response.text
            except Exception:
                pass
        return self.fetch_page(url, referer=LIST_URL)

    def parse_news_list(self, html: str) -> List[Dict[str, Optional[str]]]:
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        seen_urls: set[str] = set()
        items: List[Dict[str, Optional[str]]] = []

        for anchor in soup.select("a[href]"):
            if not isinstance(anchor, Tag):
                continue
            href = (anchor.get("href") or "").strip()
            if not href:
                continue
            full_url = urljoin(BASE_URL, href)
            base, _ = urldefrag(full_url)
            if not is_forbes_article_url(base):
                continue
            if base in seen_urls:
                continue

            title = clean_text(anchor.get_text(" ", strip=True)) or None
            if not title or len(title) < 12:
                continue

            seen_urls.add(base)
            items.append({"url": base, "title": title})

        for row in extract_listing_from_next_data(html):
            url = row.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            items.append(row)

        return items

    def parse_article_details(self, html: str) -> Dict[str, Optional[str]]:
        if not html:
            return {"title": None, "content": "", "publishedAt": None}

        soup = BeautifulSoup(html, "html.parser")

        title_node = soup.select_one(TITLE_SELECTOR) or soup.select_one("#article-num-0 main h1") or soup.select_one(
            "article h1"
        )
        title = clean_text(title_node.get_text(" ", strip=True)) if isinstance(title_node, Tag) else None

        time_node = (
            soup.select_one(TIME_SELECTOR)
            or soup.select_one("#article-num-0 main time[datetime]")
            or soup.select_one("article time[datetime]")
            or soup.select_one("time[datetime]")
        )
        published_at = choose_published_at_from_meta_and_time(soup, time_node if isinstance(time_node, Tag) else None)

        content_node = soup.select_one(CONTENT_SELECTOR) or soup.select_one(
            "#article-num-0 main div.fs-article.fs-responsive-text.current-article.article-body"
        ) or soup.select_one("div.fs-article.fs-responsive-text.current-article.article-body")
        content = extract_recursive_text(content_node) if isinstance(content_node, Tag) else ""

        return {"title": title, "content": content, "publishedAt": published_at}


def scrape_forbes_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
    scraper = ForbesScraper()
    listing_html = scraper.fetch_listing_html()
    listed_items = scraper.parse_news_list(listing_html or "")
    selected_items = listed_items if limit is None else listed_items[:limit]

    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    for item in selected_items:
        article_url = item.get("url")
        fallback_title = item.get("title")
        if not article_url:
            continue

        article_html = scraper.fetch_article_html(article_url)
        details = scraper.parse_article_details(article_html or "")

        output.append(
            {
                "source": "FORBES",
                "scrapedAt": scraped_at,
                "publishedAt": details.get("publishedAt"),
                "title": details.get("title") or fallback_title,
                "content": details.get("content") or "",
            }
        )

    return output


def save_debug_json(data: List[Dict[str, Optional[str]]]) -> None:
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    news = scrape_forbes_news()
    save_debug_json(news)
