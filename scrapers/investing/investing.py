import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag
from curl_cffi import requests as curl_requests

BASE_URL = "https://www.investing.com"
TR_BASE_URL = "https://tr.investing.com"
CATEGORY_URLS = [
    "https://www.investing.com/news/cryptocurrency-news",
    "https://tr.investing.com/news/cryptocurrency-news",
]
OUTPUT_FILE = Path(__file__).with_name("investing_news_debug.json")
REQUEST_TIMEOUT = 30


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def to_iso8601_from_investing(value: str) -> Optional[str]:
    text = clean_text(value)
    if not text:
        return None

    # Common strings:
    # - Published 04/17/2026, 10:56 AM
    # - Yayınlanma 17.04.2026 10:56
    text = re.sub(
        r"^(Published|Yayınlanma|Yayın\s*Tarihi)\s*",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()

    # Already ISO-like
    iso_candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        pass

    known_formats = [
        "%m/%d/%Y, %I:%M %p",
        "%m/%d/%Y, %H:%M",
        "%d.%m.%Y %H:%M",
        "%d/%m/%Y %H:%M",
    ]
    for fmt in known_formats:
        try:
            parsed = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            return parsed.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue

    return None


class InvestingScraper:
    def __init__(self) -> None:
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://www.investing.com/news",
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

    def parse_news_list(self, html: str, category_url: str) -> List[Dict[str, Optional[str]]]:
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        items = soup.find_all("article", attrs={"data-test": "article-item"})
        if not items:
            items = soup.select("li article") or soup.select(".articleItem")

        seen_urls: set[str] = set()
        articles: List[Dict[str, Optional[str]]] = []

        for item in items:
            if not isinstance(item, Tag):
                continue
            parsed = self._extract_list_item_data(item, category_url)
            url = parsed.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                articles.append(parsed)

        if not articles:
            for anchor in soup.select("ul li article a[href]"):
                if not isinstance(anchor, Tag):
                    continue
                parsed = self._extract_list_item_data(anchor, category_url)
                url = parsed.get("url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    articles.append(parsed)

        return articles

    def _extract_list_item_data(self, element: Tag, category_url: str) -> Dict[str, Optional[str]]:
        data: Dict[str, Optional[str]] = {
            "title": None,
            "url": None,
            "published_at": None,
        }

        if element.name == "a":
            anchor = element
        else:
            anchor = element.find("a", attrs={"data-test": "article-title-link"}) or element.find("a")

        if not isinstance(anchor, Tag):
            return data

        title = clean_text(anchor.get_text(strip=True))
        href = (anchor.get("href") or "").strip()

        if href.startswith("/"):
            base_url = TR_BASE_URL if "tr.investing.com" in category_url else BASE_URL
            href = urljoin(base_url, href)

        data["title"] = title or None
        data["url"] = href or None
        return data

    def parse_article_details(self, html: str) -> Dict[str, Optional[str]]:
        if not html:
            return {"title": None, "content": "", "publishedAt": None}

        soup = BeautifulSoup(html, "html.parser")

        title_node = soup.select_one("#articleTitle") or soup.find("h1")
        title = clean_text(title_node.get_text(" ", strip=True)) if isinstance(title_node, Tag) else None

        body_node = soup.select_one("#article > div > div")
        content = clean_text(body_node.get_text("\n", strip=True)) if isinstance(body_node, Tag) else ""

        published_at = self._extract_published_at(soup)
        if not title or not published_at:
            json_ld = self._extract_json_ld_article(soup)
            if json_ld:
                title = title or clean_text(str(json_ld.get("headline", ""))) or None
                published_at = published_at or clean_text(str(json_ld.get("datePublished", ""))) or None

        return {"title": title, "content": content, "publishedAt": published_at}

    def _extract_published_at(self, soup: BeautifulSoup) -> Optional[str]:
        selectors = [
            "#__next div.flex.flex-col.gap-2.text-xs.md\\:gap-2\\.5.mt-2.md\\:mt-3 span",
            "time",
            "span[data-test='article-publish-date']",
            "div[data-test='article-publish-info'] span",
        ]

        for selector in selectors:
            node = soup.select_one(selector)
            if not isinstance(node, Tag):
                continue
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                datetime_attr = node.get("datetime")
                if datetime_attr:
                    return to_iso8601_from_investing(str(datetime_attr)) or clean_text(str(datetime_attr))
                return to_iso8601_from_investing(text) or text

        for span in soup.find_all("span"):
            if not isinstance(span, Tag):
                continue
            text = clean_text(span.get_text(" ", strip=True))
            if text and (
                "Published" in text or "Yayınlanma" in text or "Yayın Tarihi" in text
            ):
                return to_iso8601_from_investing(text) or text

        return None

    def _extract_json_ld_article(self, soup: BeautifulSoup) -> Optional[Dict[str, object]]:
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            if not isinstance(script, Tag):
                continue
            script_text = script.get_text(strip=True)
            if not script_text:
                continue
            try:
                parsed = json.loads(script_text)
            except Exception:
                continue

            candidates = parsed if isinstance(parsed, list) else [parsed]
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                if candidate.get("@type") in {"NewsArticle", "Article"}:
                    return candidate

        return None


def scrape_investing_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
    scraper = InvestingScraper()
    scraped_at = now_iso8601()

    listed_items: List[Dict[str, Optional[str]]] = []
    seen_urls: set[str] = set()

    for category_url in CATEGORY_URLS:
        html = scraper.fetch_page(category_url)
        parsed_items = scraper.parse_news_list(html or "", category_url)
        for item in parsed_items:
            article_url = item.get("url")
            if not article_url or article_url in seen_urls:
                continue
            seen_urls.add(article_url)
            listed_items.append(item)

    selected_items = listed_items if limit is None else listed_items[:limit]
    output: List[Dict[str, Optional[str]]] = []

    for item in selected_items:
        article_url = item.get("url")
        fallback_title = item.get("title")
        if not article_url:
            continue

        html = scraper.fetch_page(article_url)
        details = scraper.parse_article_details(html or "")

        output.append(
            {
                "source": "INVESTING",
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
    news = scrape_investing_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
