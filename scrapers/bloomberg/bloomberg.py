import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.bloomberght.com/kripto"
SITE_BASE_URL = "https://www.bloomberght.com"
OUTPUT_FILE = Path(__file__).with_name("bloomberg_news_debug.json")
REQUEST_TIMEOUT = 20

LIST_LINK_SELECTOR = "div.swiper-slide a[href]"
LIST_TITLE_SELECTOR = "span.line-clamp-2"

ARTICLE_CONTENT_SELECTOR = (
    "article div.article-wrapper.mb-4.mt-5"
)
ARTICLE_PUBLISHED_SELECTOR = (
    "article div.text-xs.flex.flex-col.gap-1 time"
)


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def get_soup(url: str, session: requests.Session) -> BeautifulSoup:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def parse_published_at(article_soup: BeautifulSoup) -> Optional[str]:
    node = article_soup.select_one(ARTICLE_PUBLISHED_SELECTOR)
    if not node:
        return None

    datetime_attr = node.get("datetime")
    if datetime_attr:
        return clean_text(datetime_attr)

    text = clean_text(node.get_text(strip=True))
    return text or None


def parse_article_content(article_soup: BeautifulSoup) -> str:
    node = article_soup.select_one(ARTICLE_CONTENT_SELECTOR)
    if not node:
        return ""
    return clean_text(node.get_text("\n", strip=True))


def parse_article_title(article_soup: BeautifulSoup) -> Optional[str]:
    og_title = article_soup.select_one("meta[property='og:title']")
    if og_title and og_title.get("content"):
        title = clean_text(str(og_title.get("content")))
        if title:
            return title

    h1 = article_soup.select_one("h1")
    if h1:
        title = clean_text(h1.get_text(strip=True))
        if title:
            return title

    return None


def scrape_bloomberg_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
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
    links = listing_soup.select(LIST_LINK_SELECTOR)

    seen_urls = set()
    items: List[Dict[str, str]] = []
    for link in links:
        href = (link.get("href") or "").strip()
        if not href:
            continue
        if not href.startswith("/"):
            continue
        # Keep only article links shaped like /slug-1234567
        if not href.rsplit("-", 1)[-1].isdigit():
            continue

        full_url = urljoin(SITE_BASE_URL, href)
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        title_node = link.select_one(LIST_TITLE_SELECTOR)
        fallback_title = clean_text(title_node.get_text(strip=True)) if title_node else ""
        items.append({"url": full_url, "fallback_title": fallback_title})

    selected_items = items if limit is None else items[:limit]
    scraped_at = now_iso8601()

    output: List[Dict[str, Optional[str]]] = []
    for item in selected_items:
        article_url = item["url"]
        fallback_title = item["fallback_title"] or None

        try:
            article_soup = get_soup(article_url, session)
            published_at = parse_published_at(article_soup)
            content = parse_article_content(article_soup)
            title = parse_article_title(article_soup) or fallback_title
        except Exception:
            published_at = None
            content = ""
            title = fallback_title

        output.append(
            {
                "source": "BLOOMBERG",
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
    news = scrape_bloomberg_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")