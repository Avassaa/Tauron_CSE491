import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.getmidas.com/midas-kulaklari/kripto-para-haber/"
OUTPUT_FILE = Path(__file__).with_name("midas_news_debug.json")
REQUEST_TIMEOUT = 20

LIST_ITEM_SELECTOR = "div.daily-newsletters-block-body-item"
LINK_SELECTOR = "a[href]"
TITLE_SELECTOR = "div.daily-newsletters-block-body-item-subtitle h2, div.daily-newsletters-block-body-item-subtitle h3"

ARTICLE_CONTENT_SELECTOR = (
    "body > main > section.blog-detail.midas-ears-detail > div > div > "
    "div.col-xl-6.offset-xl-3.col-lg-8.offset-lg-2.visible > article"
)
ARTICLE_PUBLISHED_SELECTOR = (
    "body > main > section.blog-detail.midas-ears-detail > div > div > "
    "div.col-xl-6.offset-xl-3.col-lg-8.offset-lg-2.visible > "
    "div.blog-detail-head > span > span.created-container > b"
)


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def published_display_to_iso8601(raw: str) -> Optional[str]:
    """
    Parse Midas article date lines (e.g. ``Yayın Tarihi 23.04.2026 21:25``) to UTC ISO-8601.
    """
    text = clean_text(raw)
    if not text:
        return None
    text = re.sub(
        r"^(Yayın\s*Tarihi|Yayınlanma|Published)\s*",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    iso_candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        pass
    for fmt in ("%d.%m.%Y %H:%M", "%d.%m.%Y %H.%M"):
        try:
            parsed = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            return parsed.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    return None


def get_soup(url: str, session: requests.Session) -> BeautifulSoup:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def parse_article_content(article_soup: BeautifulSoup) -> str:
    container = article_soup.select_one(ARTICLE_CONTENT_SELECTOR)
    if not container:
        return ""
    return clean_text(container.get_text("\n", strip=True))


def parse_article_published_at(article_soup: BeautifulSoup) -> Optional[str]:
    published_node = article_soup.select_one(ARTICLE_PUBLISHED_SELECTOR)
    if not published_node:
        return None
    published_text = clean_text(published_node.get_text(strip=True))
    if not published_text:
        return None
    return published_display_to_iso8601(published_text)


def parse_article_title(article_soup: BeautifulSoup) -> Optional[str]:
    og_title = article_soup.select_one("meta[property='og:title']")
    if og_title and og_title.get("content"):
        text = clean_text(str(og_title.get("content")))
        if text:
            return text

    h1 = article_soup.select_one("h1")
    if h1:
        text = clean_text(h1.get_text(strip=True))
        if text:
            return text

    return None


def scrape_midas_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        }
    )

    listing_soup = get_soup(BASE_URL, session)
    items = listing_soup.select(LIST_ITEM_SELECTOR)
    selected_items = items if limit is None else items[:limit]

    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    for item in selected_items:
        link_node = item.select_one(LINK_SELECTOR)
        title_node = item.select_one(TITLE_SELECTOR)
        if not link_node:
            continue

        href = (link_node.get("href") or "").strip()
        if not href:
            continue

        article_url = urljoin(BASE_URL, href)
        title = clean_text(title_node.get_text(strip=True)) if title_node else None

        try:
            article_soup = get_soup(article_url, session)
            published_at = parse_article_published_at(article_soup)
            if not title:
                title = parse_article_title(article_soup)
            content = parse_article_content(article_soup)
        except Exception:
            published_at = None
            content = ""

        output.append(
            {
                "source": "MIDAS",
                "scrapedAt": scraped_at,
                "publishedAt": published_at,
                "title": title,
                "content": content,
            }
        )

    return output


def save_debug_json(data: List[Dict[str, Optional[str]]]) -> None:
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    news = scrape_midas_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
