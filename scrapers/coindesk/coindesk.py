import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup, NavigableString, Tag
from curl_cffi import requests as curl_requests

BASE_URL = "https://www.coindesk.com"
LIST_URL = "https://www.coindesk.com/markets/"
OUTPUT_FILE = Path(__file__).with_name("coindesk_news_debug.json")
REQUEST_TIMEOUT = 30


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def to_iso8601_from_coindesk(value: str) -> Optional[str]:
    text = clean_text(value)
    if not text:
        return None

    text = re.sub(r"^(Published|Updated|Edited)\s*", "", text, flags=re.IGNORECASE).strip()
    text = text.replace("a.m.", "AM").replace("p.m.", "PM")
    text = text.replace("a.m", "AM").replace("p.m", "PM")

    known_formats = [
        "%m/%d/%Y, %I:%M %p",
        "%m/%d/%Y, %H:%M",
        "%b %d, %Y, %I:%M %p",
        "%B %d, %Y, %I:%M %p",
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


class CoinDeskScraper:
    def __init__(self) -> None:
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": BASE_URL,
        }

    def fetch_page(self, url: str) -> Optional[str]:
        try:
            response = curl_requests.get(
                url,
                headers=self.headers,
                impersonate="chrome124",
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            if response.status_code == 200:
                return response.text
            return None
        except Exception:
            return None

    def parse_news_list(self, html: str) -> List[Dict[str, Optional[str]]]:
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        seen_urls: set[str] = set()
        items: List[Dict[str, Optional[str]]] = []

        anchors = soup.select("a[href]")
        for anchor in anchors:
            if not isinstance(anchor, Tag):
                continue
            href = (anchor.get("href") or "").strip()
            if not href:
                continue

            full_url = urljoin(BASE_URL, href)
            if not full_url.startswith(BASE_URL):
                continue
            if "/202" not in full_url:
                continue
            if full_url in seen_urls:
                continue

            title = clean_text(anchor.get_text(" ", strip=True)) or None
            if not title:
                continue

            seen_urls.add(full_url)
            items.append({"url": full_url, "title": title})

        return items

    def parse_article_details(self, html: str) -> Dict[str, Optional[str]]:
        if not html:
            return {"title": None, "content": "", "publishedAt": None}

        soup = BeautifulSoup(html, "html.parser")

        title_node = soup.select_one(
            "#content > section > div > div > div > "
            "div.article-content-wrapper.flex.flex-col.gap-4.row-start-2 > div > h1"
        ) or soup.select_one("h1")
        title = clean_text(title_node.get_text(" ", strip=True)) if isinstance(title_node, Tag) else None

        content_node = soup.select_one("#content > section > div > div > div > div:nth-child(4) > div")
        if not isinstance(content_node, Tag):
            content_node = soup.select_one("div.document-body")
        content = self._extract_recursive_content(content_node) if isinstance(content_node, Tag) else ""

        published_at = self._extract_published_at(soup)
        return {"title": title, "content": content, "publishedAt": published_at}

    def _extract_published_at(self, soup: BeautifulSoup) -> Optional[str]:
        def parse_preferred_date_segment(raw_text: str) -> Optional[str]:
            cleaned = clean_text(raw_text)
            if not cleaned:
                return None

            pattern = (
                r"(Published|Updated|Edited)\s+"
                r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.)|"
                r"\d{2}/\d{2}/\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM))"
            )
            matches = list(re.finditer(pattern, cleaned, flags=re.IGNORECASE))
            if matches:
                # Prefer Published, then Updated, then Edited.
                priority = {"published": 0, "updated": 1, "edited": 2}
                best = sorted(
                    matches,
                    key=lambda m: priority.get(m.group(1).lower(), 99),
                )[0]
                parsed = to_iso8601_from_coindesk(f"{best.group(1)} {best.group(2)}")
                if parsed:
                    return parsed

            return to_iso8601_from_coindesk(cleaned)

        metadata_node = soup.select_one(
            "#content > section > div > div > div > "
            "div.article-content-wrapper.flex.flex-col.gap-4.row-start-2 > div > "
            "div.font-sans.text-sm.leading-\\[22px\\].tracking-normal.flex.gap-4.text-subtle.flex-col.md\\:block"
        )
        if isinstance(metadata_node, Tag):
            metadata_text = clean_text(metadata_node.get_text(" ", strip=True))
            if metadata_text:
                parsed_metadata = parse_preferred_date_segment(metadata_text)
                if parsed_metadata:
                    return parsed_metadata

        time_node = soup.select_one("time")
        if isinstance(time_node, Tag):
            datetime_attr = (time_node.get("datetime") or "").strip()
            if datetime_attr:
                parsed_attr = to_iso8601_from_coindesk(datetime_attr)
                if parsed_attr:
                    return parsed_attr
                return clean_text(datetime_attr)

            text_value = clean_text(time_node.get_text(" ", strip=True))
            if text_value:
                parsed_text = to_iso8601_from_coindesk(text_value)
                if parsed_text:
                    return parsed_text

        full_text = clean_text(soup.get_text(" ", strip=True))
        parsed_from_page = parse_preferred_date_segment(full_text)
        if parsed_from_page:
            return parsed_from_page

        modified_meta = soup.select_one("meta[property='article:modified_time']")
        if isinstance(modified_meta, Tag):
            content = (modified_meta.get("content") or "").strip()
            parsed_modified = to_iso8601_from_coindesk(content)
            if parsed_modified:
                return parsed_modified

        modified_meta = soup.select_one("meta[name='lastmod']")
        if isinstance(modified_meta, Tag):
            content = (modified_meta.get("content") or "").strip()
            parsed_modified = to_iso8601_from_coindesk(content)
            if parsed_modified:
                return parsed_modified

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

        # Preserve order, avoid duplicates caused by fragmented text nodes.
        merged: List[str] = []
        for chunk in chunks:
            if merged and merged[-1] == chunk:
                continue
            merged.append(chunk)

        return "\n".join(merged)


def scrape_coindesk_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
    scraper = CoinDeskScraper()
    listing_html = scraper.fetch_page(LIST_URL)
    listed_items = scraper.parse_news_list(listing_html or "")
    selected_items = listed_items if limit is None else listed_items[:limit]

    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    for item in selected_items:
        article_url = item.get("url")
        fallback_title = item.get("title")
        if not article_url:
            continue

        article_html = scraper.fetch_page(article_url)
        details = scraper.parse_article_details(article_html or "")

        output.append(
            {
                "source": "COINDESK",
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
    news = scrape_coindesk_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
