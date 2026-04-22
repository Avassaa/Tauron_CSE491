import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urldefrag, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup, NavigableString, Tag
from curl_cffi import requests as curl_requests

logger = logging.getLogger(__name__)

BASE_URL = "https://www.theblock.co"
HOME_URL = f"{BASE_URL}/"
# Often rate-limited (429) when hit cold; we fall back to HOME_URL for /post/ discovery.
LIST_URL = "https://www.theblock.co/latest-crypto-news"
# Index of premium / The Block Access articles (used to pre-filter; article HTML is also checked).
ACCESS_URL = f"{BASE_URL}/access"
OUTPUT_FILE = Path(__file__).with_name("theblock_news_debug.json")
REQUEST_TIMEOUT = 30


def now_iso8601() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def normalize_post_url(url: str) -> str:
    """Stable comparison key for theblock.co /post/ URLs (strip fragment, query, trailing slash)."""
    if not url:
        return ""
    base, _ = urldefrag(url.strip())
    parsed = urlparse(base)
    path = (parsed.path or "").rstrip("/") or "/"
    return urlunparse(
        (parsed.scheme or "https", (parsed.netloc or "").lower(), path, "", "", "")
    )


def to_iso8601_from_theblock(value: str) -> Optional[str]:
    text = clean_text(value)
    if not text:
        return None

    text = re.sub(r"^(Published|Updated|Edited)\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^UPDATED:\s*", "", text, flags=re.IGNORECASE).strip()
    text = text.replace("a.m.", "AM").replace("p.m.", "PM")
    text = text.replace("a.m", "AM").replace("p.m", "PM")
    text = re.sub(r"\s+(EDT|EST|CDT|CST|MDT|MST|PDT|PST|UTC|GMT)$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+[A-Z]{2,5}$", "", text)  # other timezone-style suffixes

    known_formats = [
        "%m/%d/%Y, %I:%M %p",
        "%m/%d/%Y, %H:%M",
        "%b %d, %Y, %I:%M %p",
        "%B %d, %Y, %I:%M %p",
        "%b %d, %Y, %I:%M%p",
        "%B %d, %Y, %I:%M%p",
    ]
    for fmt in known_formats:
        try:
            parsed = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            return parsed.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue

    iso_candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def parse_preferred_date_segment(raw_text: str) -> Optional[str]:
    cleaned = clean_text(raw_text)
    if not cleaned:
        return None

    def first_long_date_token(text: str) -> Optional[str]:
        any_long = re.finditer(
            r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM|a\.m\.|p\.m\.)|(?:AM|PM)))"
            r"(?:\s+(?:EDT|EST|UTC|GMT|CDT|CST|PDT|PST|MDT|MST))?",
            text,
        )
        for match in any_long:
            token = re.sub(
                r"\s+(EDT|EST|UTC|GMT|CDT|CST|PDT|PST|MDT|MST)$", "", match.group(1), flags=re.IGNORECASE
            )
            return token
        return None

    published = re.search(
        r"Published\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},.+?)(?=\s+Updated:|\s+UPDATED:|\s+Edited:|\Z)",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if published:
        token = first_long_date_token(published.group(1)) or clean_text(published.group(1))
        parsed = to_iso8601_from_theblock(token)
        if parsed:
            return parsed

    before_updated = re.split(r"\bUPDATED:\s*", cleaned, maxsplit=1, flags=re.IGNORECASE)[0]
    token_before = first_long_date_token(before_updated)
    if token_before:
        parsed = to_iso8601_from_theblock(token_before)
        if parsed:
            return parsed

    updated_label = re.search(
        r"UPDATED:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.))",
        cleaned,
        flags=re.IGNORECASE,
    )
    if updated_label:
        parsed = to_iso8601_from_theblock(updated_label.group(1))
        if parsed:
            return parsed

    pattern = (
        r"(Published|Updated|Edited)\s+"
        r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.)(?:\s+(?:EDT|EST|UTC|GMT|CDT|CST|PDT|PST|MDT|MST))?|"
        r"\d{2}/\d{2}/\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s+(?:EDT|EST|UTC|GMT|CDT|CST|PDT|PST|MDT|MST))?)"
    )
    matches = list(re.finditer(pattern, cleaned, flags=re.IGNORECASE))
    if matches:
        priority = {"published": 0, "updated": 1, "edited": 2}
        best = sorted(matches, key=lambda m: priority.get(m.group(1).lower(), 99))[0]
        parsed = to_iso8601_from_theblock(f"{best.group(1)} {best.group(2)}")
        if parsed:
            return parsed

    return to_iso8601_from_theblock(cleaned)


class TheBlockScraper:
    def __init__(self) -> None:
        # theblock.co often returns 403 to chrome120/chrome124 + cold GET; a Session with
        # a homepage visit and edge99 impersonation is more likely to return 200.
        self._session = curl_requests.Session()
        self._warmed = False
        self.headers = {
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,image/apng,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
        # curl_cffi: rotate clients; chrome124 often 403 on theblock.co; edge99 usually better.
        self._impersonate_cycle = ("edge99", "chrome", "safari17_0")
        self._impersonate_index = 0
        self._session.headers.update(self.headers)

    def _current_impersonate(self) -> str:
        return self._impersonate_cycle[self._impersonate_index % len(self._impersonate_cycle)]

    def _rotate_session(self) -> None:
        self._impersonate_index += 1
        self._warmed = False
        self._session = curl_requests.Session()
        self._session.headers.update(self.headers)

    def _warm_session(self) -> None:
        if self._warmed:
            return
        imp = self._current_impersonate()
        try:
            response = self._session.get(
                f"{BASE_URL}/",
                headers={**self.headers, "Sec-Fetch-Site": "none"},
                impersonate=imp,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            if response.status_code == 200:
                time.sleep(random.uniform(0.4, 1.0))
                self._warmed = True
            else:
                logger.info("Session warmup got status %s (impersonate=%s)", response.status_code, imp)
        except Exception as exc:
            logger.warning("Session warmup failed: %s", exc)

    def fetch_page(self, url: str, retries: int = 6) -> Optional[str]:
        for attempt in range(retries):
            if attempt:
                base_wait = random.uniform(2.0, 4.5)
                time.sleep(base_wait)
            self._warm_session()
            try:
                is_home = url.rstrip("/") in (BASE_URL.rstrip("/"), "")
                req_headers = dict(self.headers)
                if not is_home:
                    req_headers["Referer"] = f"{BASE_URL}/"
                    req_headers["Sec-Fetch-Site"] = "same-origin"
                else:
                    req_headers["Sec-Fetch-Site"] = "none"
                imp = self._current_impersonate()
                response = self._session.get(
                    url,
                    headers=req_headers,
                    impersonate=imp,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )
                if response.status_code == 200:
                    return response.text
                logger.info(
                    "GET %s failed: status %s impersonate=%s (attempt %s)",
                    url,
                    response.status_code,
                    imp,
                    attempt + 1,
                )
                if response.status_code == 429:
                    time.sleep(random.uniform(8.0, 15.0))
                if response.status_code in (401, 403, 429):
                    self._warmed = False
                    self._rotate_session()
            except Exception as exc:
                logger.warning("GET %s error: %s (attempt %s)", url, exc, attempt + 1)
                self._rotate_session()
        return None

    def parse_news_list(self, html: str) -> List[Dict[str, Optional[str]]]:
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        items: List[Dict[str, Optional[str]]] = []
        seen_urls: set[str] = set()

        for article in soup.select("article"):
            if not isinstance(article, Tag):
                continue

            link_node = article.select_one("h1 a[href]") or article.select_one("a[href]")
            if not isinstance(link_node, Tag):
                continue
            href = (link_node.get("href") or "").strip()
            if not href:
                continue
            full_url = urljoin(BASE_URL, href)
            if not full_url.startswith(BASE_URL) or full_url in seen_urls:
                continue

            title_node = article.select_one("h1") or article.select_one("h2")
            title = clean_text(title_node.get_text(" ", strip=True)) if isinstance(title_node, Tag) else None
            if not title:
                title = clean_text(link_node.get_text(" ", strip=True)) or None

            published_node = article.select_one(
                "div.flex.items-center.justify-between.pb-3 "
                "div.flex.flex-col.items-start.gap-1.md\\:flex-row.md\\:items-center > div > span:nth-child(3)"
            )
            published_text = (
                clean_text(published_node.get_text(" ", strip=True))
                if isinstance(published_node, Tag)
                else None
            )

            seen_urls.add(full_url)
            items.append(
                {
                    "url": full_url,
                    "title": title,
                    "published_text": published_text,
                }
            )

        return items

    def parse_homepage_post_links(self, html: str) -> List[Dict[str, Optional[str]]]:
        """Collect article URLs from the homepage when the listing URL is blocked (429) or empty."""
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        items: List[Dict[str, Optional[str]]] = []
        seen_urls: set[str] = set()

        for anchor in soup.select('a[href*="/post/"]'):
            if not isinstance(anchor, Tag):
                continue
            href = (anchor.get("href") or "").strip()
            if not href.startswith("/post/"):
                continue
            full_url = urljoin(BASE_URL, href)
            if not full_url.startswith(BASE_URL) or full_url in seen_urls:
                continue

            text = clean_text(anchor.get_text(" ", strip=True)) or None
            if text and any(
                text.lower() == bad
                for bad in ("read more", "latest crypto news", "subscribe", "sign in", "log in")
            ):
                continue

            seen_urls.add(full_url)
            items.append(
                {
                    "url": full_url,
                    "title": text,
                    "published_text": None,
                }
            )

        return items

    def collect_premium_post_urls(self, html: str) -> set[str]:
        """Post URLs shown on the Access / premium index page."""
        if not html:
            return set()

        soup = BeautifulSoup(html, "html.parser")
        urls: set[str] = set()
        for anchor in soup.select('a[href*="/post/"]'):
            if not isinstance(anchor, Tag):
                continue
            href = (anchor.get("href") or "").strip()
            if not href.startswith("/post/"):
                continue
            urls.add(normalize_post_url(urljoin(BASE_URL, href)))
        return urls

    def article_html_is_premium(self, html: str) -> bool:
        """
        Detect subscriber-only articles: the live page uses a paywall container even when
        a short excerpt is visible. /access may not list every URL, so this is the source of truth.
        """
        if not html:
            return False

        soup = BeautifulSoup(html, "html.parser")
        if soup.select_one('[qa-test-id="article-paywall"]') or soup.select_one(
            "div.paywall-container"
        ) or soup.select_one(".article-paywall"):
            return True

        return False

    def parse_article_details(self, html: str) -> Dict[str, Optional[str]]:
        if not html:
            return {"title": None, "content": "", "publishedAt": None}

        soup = BeautifulSoup(html, "html.parser")
        title_node = soup.select_one("h1")
        title = clean_text(title_node.get_text(" ", strip=True)) if isinstance(title_node, Tag) else None

        content_node = soup.select_one("#articleContent > div")
        content = self._extract_recursive_content(content_node) if isinstance(content_node, Tag) else ""
        published_at = self._extract_published_at(soup)
        return {"title": title, "content": content, "publishedAt": published_at}

    def _extract_published_at(self, soup: BeautifulSoup) -> Optional[str]:
        metadata_node = soup.select_one(
            "#__nuxt article div.flex.items-center.justify-between.pb-3 "
            "div.flex.flex-col.items-start.gap-1.md\\:flex-row.md\\:items-center"
        )
        if isinstance(metadata_node, Tag):
            parsed = parse_preferred_date_segment(metadata_node.get_text(" ", strip=True))
            if parsed:
                return parsed

        time_node = soup.select_one("time")
        if isinstance(time_node, Tag):
            datetime_attr = (time_node.get("datetime") or "").strip()
            if datetime_attr:
                parsed = to_iso8601_from_theblock(datetime_attr)
                if parsed:
                    return parsed

            parsed = parse_preferred_date_segment(time_node.get_text(" ", strip=True))
            if parsed:
                return parsed

        full_text = clean_text(soup.get_text(" ", strip=True))
        parsed = parse_preferred_date_segment(full_text)
        if parsed:
            return parsed

        modified_meta = soup.select_one("meta[property='article:modified_time']")
        if isinstance(modified_meta, Tag):
            meta_content = (modified_meta.get("content") or "").strip()
            parsed = to_iso8601_from_theblock(meta_content)
            if parsed:
                return parsed

        modified_meta = soup.select_one("meta[name='lastmod']")
        if isinstance(modified_meta, Tag):
            meta_content = (modified_meta.get("content") or "").strip()
            parsed = to_iso8601_from_theblock(meta_content)
            if parsed:
                return parsed

        return None

    def _extract_recursive_content(self, root: Tag) -> str:
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


def scrape_theblock_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
    scraper = TheBlockScraper()
    # Latest feed is often 429; try a couple of times then fall back to homepage discovery.
    listing_html = scraper.fetch_page(LIST_URL, retries=2)
    listed_items = scraper.parse_news_list(listing_html or "")
    if not listed_items:
        logger.info("Listing page empty or unavailable; using homepage /post/ links as fallback")
        home_html = scraper.fetch_page(HOME_URL, retries=4)
        listed_items = scraper.parse_homepage_post_links(home_html or "")

    access_html = scraper.fetch_page(ACCESS_URL, retries=2)
    premium_index_urls = scraper.collect_premium_post_urls(access_html or "")
    if premium_index_urls:
        logger.info("Loaded %s premium / Access index URLs to exclude from discovery", len(premium_index_urls))

    listed_items = [
        item
        for item in listed_items
        if item.get("url") and normalize_post_url(str(item.get("url"))) not in premium_index_urls
    ]

    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    for item in listed_items:
        if limit is not None and len(output) >= limit:
            break
        article_url = item.get("url")
        fallback_title = item.get("title")
        fallback_published = item.get("published_text")
        if not article_url:
            continue

        article_html = scraper.fetch_page(article_url)
        if scraper.article_html_is_premium(article_html or ""):
            logger.info("Skipping premium / paywalled article: %s", article_url)
            continue

        details = scraper.parse_article_details(article_html or "")

        published_at = details.get("publishedAt")
        if not published_at and isinstance(fallback_published, str):
            published_at = parse_preferred_date_segment(fallback_published)

        output.append(
            {
                "source": "THEBLOCK",
                "scrapedAt": scraped_at,
                "publishedAt": published_at,
                "title": details.get("title") or fallback_title,
                "content": details.get("content") or "",
            }
        )

    return output


def save_debug_json(data: List[Dict[str, Optional[str]]]) -> None:
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    news = scrape_theblock_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
