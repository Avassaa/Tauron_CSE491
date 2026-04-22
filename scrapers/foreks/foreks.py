import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

TOKEN_URL = "https://www.foreks.com/token"
NEWS_API_URL = "https://web-api.forinvestcdn.com/cloud-proxy/api/v3/news"
OUTPUT_FILE = Path(__file__).with_name("foreks_news_debug.json")
REQUEST_TIMEOUT = 20


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def to_iso8601_from_foreks(date_text: str) -> Optional[str]:
    value = clean_text(date_text)
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%d/%m/%Y %H:%M:%S")
        return parsed.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return value


def build_headers(token: str) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Authorization": f"Bearer {token}",
        "Origin": "https://www.foreks.com",
        "Referer": "https://www.foreks.com/",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) "
            "Version/26.4 Safari/605.1.15"
        ),
        "Priority": "u=3, i",
    }


def get_token(session: requests.Session) -> str:
    response = session.get(
        TOKEN_URL,
        headers={
            "Accept": "*/*",
            "Origin": "https://www.foreks.com",
            "Referer": "https://www.foreks.com/",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                "Version/26.4 Safari/605.1.15"
            ),
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    data: object
    try:
        data = response.json()
    except ValueError:
        text = response.text.strip()
        if not text:
            raise RuntimeError("Token response was empty.")
        return text

    if isinstance(data, str) and data.strip():
        return data.strip()

    if isinstance(data, dict):
        possible_keys = ["token", "access_token", "jwt", "bearer"]
        for key in possible_keys:
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    raise RuntimeError("Could not parse token from Foreks token endpoint.")


def parse_news_detail(content_url: str, headers: Dict[str, str], session: requests.Session) -> Dict[str, Optional[str]]:
    response = session.get(content_url, headers=headers, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    html = response.content.decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    header_node = soup.select_one("div.Header")
    time_node = soup.select_one("div.Time #newsDate")
    detail_node = soup.select_one("div.Detay")

    title = clean_text(header_node.get_text(strip=True)) if header_node else None
    published_raw = clean_text(time_node.get_text(strip=True)) if time_node else ""
    published_at = to_iso8601_from_foreks(published_raw) if published_raw else None
    content = clean_text(detail_node.get_text("\n", strip=True)) if detail_node else ""

    return {
        "title": title,
        "publishedAt": published_at,
        "content": content,
    }


def scrape_foreks_news(last: int = 20) -> List[Dict[str, Optional[str]]]:
    session = requests.Session()
    token = get_token(session)
    headers = build_headers(token)

    response = session.get(
        NEWS_API_URL,
        params={"source": "PICNEWS", "locale": "tr", "last": last, "tag": "CRYPTO"},
        headers=headers,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    news_items = response.json()

    if not isinstance(news_items, list):
        raise RuntimeError("Unexpected Foreks news API response format.")

    scraped_at = now_iso8601()
    output: List[Dict[str, Optional[str]]] = []

    for item in news_items:
        if not isinstance(item, dict):
            continue

        content_url = str(item.get("content", "")).strip()
        if not content_url:
            continue

        fallback_title = clean_text(str(item.get("header", ""))) or None

        try:
            parsed_detail = parse_news_detail(content_url, headers, session)
        except Exception:
            parsed_detail = {"title": None, "publishedAt": None, "content": ""}

        output.append(
            {
                "source": "FOREKS",
                "scrapedAt": scraped_at,
                "publishedAt": parsed_detail.get("publishedAt"),
                "title": parsed_detail.get("title") or fallback_title,
                "content": parsed_detail.get("content") or "",
            }
        )

    return output


def save_debug_json(data: List[Dict[str, Optional[str]]]) -> None:
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    news = scrape_foreks_news()
    save_debug_json(news)
    print(f"Scraped {len(news)} articles.")
    print(f"Saved debug JSON to: {OUTPUT_FILE}")
