import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://tr.tradingview.com/markets/cryptocurrencies/news/"
SITE_BASE_URL = "https://tr.tradingview.com"
HEADLINES_API_URL = "https://news-headlines.tradingview.com/headlines/"
OUTPUT_FILE = Path(__file__).with_name("tradingview_news_debug.json")
REQUEST_TIMEOUT = 20

CONTENT_SELECTORS = [
    (
        "div.container-mgdidzRu article "
        "div.body-Xl9a4Ubk.body-nzzZVyQ3.content-nzzZVyQ3 div:nth-child(2) span"
    ),
    "article div.body-Xl9a4Ubk span",
    "article div.content-nzzZVyQ3 span",
    "article p",
]


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def get_soup(url: str, session: requests.Session) -> BeautifulSoup:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def epoch_to_iso8601(value: Optional[int]) -> Optional[str]:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def flatten_ast_description(ast_node: object) -> str:
    if isinstance(ast_node, str):
        text = clean_text(ast_node)
        return text
    if isinstance(ast_node, list):
        parts = [flatten_ast_description(item) for item in ast_node]
        return clean_text(" ".join(part for part in parts if part))
    if isinstance(ast_node, dict):
        children = ast_node.get("children")
        if children is None:
            return ""
        return flatten_ast_description(children)
    return ""


def parse_content_from_article(article_url: str, session: requests.Session) -> str:
    article_soup = get_soup(article_url, session)
    collected: List[str] = []

    for selector in CONTENT_SELECTORS:
        nodes = article_soup.select(selector)
        for node in nodes:
            if not isinstance(node, Tag):
                continue
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                collected.append(text)
        if collected:
            break

    deduped = list(dict.fromkeys(collected))
    return "\n".join(deduped)


def get_crypto_headlines(session: requests.Session) -> List[Dict[str, object]]:
    response = session.get(
        HEADLINES_API_URL,
        params={"category": "crypto", "lang": "tr"},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise RuntimeError("Unexpected headlines API response format.")
    return data


def scrape_tradingview_news(limit: Optional[int] = None) -> List[Dict[str, Optional[str]]]:
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

    headlines = get_crypto_headlines(session)
    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    selected_items = headlines if limit is None else headlines[:limit]
    for item in selected_items:
        story_path = str(item.get("storyPath", "")).strip()
        if not story_path:
            continue

        href = urljoin(SITE_BASE_URL, story_path)
        if not href:
            continue

        title = clean_text(str(item.get("title", ""))) or None
        published_at = epoch_to_iso8601(item.get("published"))

        try:
            content = parse_content_from_article(href, session)
        except Exception:
            content = ""
        if not content:
            content = flatten_ast_description(item.get("astDescription"))

        output.append(
            {
                "source": "TRADINGVIEW",
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
    news = scrape_tradingview_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
