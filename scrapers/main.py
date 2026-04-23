"""
Run every scraper under this directory and emit one combined JSON document.

By default JSON goes to stdout; pass ``-o PATH`` to write a file instead.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple


SCRAPERS_DIR = Path(__file__).resolve().parent

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScraperSpec:
    folder: str
    scrape_fn: str
    limit_param: str 


SCRAPERS: tuple[ScraperSpec, ...] = (
    ScraperSpec("bloomberg", "scrape_bloomberg_news", "limit"),
    ScraperSpec("coindesk", "scrape_coindesk_news", "limit"),
    ScraperSpec("foreks", "scrape_foreks_news", "last"),
    ScraperSpec("forbes", "scrape_forbes_news", "limit"),
    ScraperSpec("investing", "scrape_investing_news", "limit"),
    ScraperSpec("midas", "scrape_midas_news", "limit"),
    ScraperSpec("theblock", "scrape_theblock_news", "limit"),
    ScraperSpec("tradingview", "scrape_tradingview_news", "limit"),
)


def now_iso8601() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def configure_logging(level: int, log_file: Optional[Path] = None) -> None:
    fmt = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    handlers: List[logging.Handler] = [logging.StreamHandler(sys.stderr)]
    if log_file is not None:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=level, format=fmt, datefmt=datefmt, handlers=handlers, force=True)
    logging.getLogger(__name__).debug("Logging configured at level %s", logging.getLevelName(level))
    if log_file is not None:
        logging.getLogger(__name__).info("Also logging to file: %s", log_file.resolve())


def load_scraper_module(folder: str) -> Any:
    path = SCRAPERS_DIR / folder / f"{folder}.py"
    if not path.is_file():
        raise FileNotFoundError(f"Missing scraper file: {path}")
    name = f"_scraper_{folder}"
    logger.debug("Loading scraper module %s from %s", name, path)
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module spec for {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    logger.debug("Loaded scraper module %s", name)
    return mod


def invoke_scrape(spec: ScraperSpec, limit: Optional[int]) -> List[Dict[str, Any]]:
    mod = load_scraper_module(spec.folder)
    fn: Callable[..., List[Dict[str, Any]]] = getattr(mod, spec.scrape_fn)
    if limit is None:
        logger.info("Calling %s.%s() with defaults", spec.folder, spec.scrape_fn)
        return fn()
    logger.info(
        "Calling %s.%s(%s=%s)",
        spec.folder,
        spec.scrape_fn,
        spec.limit_param,
        limit,
    )
    return fn(**{spec.limit_param: limit})


def _run_one_scraper(spec: ScraperSpec, limit: Optional[int]) -> Tuple[str, Dict[str, Any]]:
    logger.info("Scraper starting: %s", spec.folder)
    try:
        articles = invoke_scrape(spec, limit)
        block = {
            "ok": True,
            "error": None,
            "count": len(articles),
            "articles": articles,
        }
        logger.info("Scraper finished: %s (%d articles)", spec.folder, len(articles))
        return spec.folder, block
    except Exception as exc:  # noqa: BLE001 — isolate scraper failures
        logger.exception("Scraper failed: %s", spec.folder)
        return spec.folder, {
            "ok": False,
            "error": str(exc),
            "count": 0,
            "articles": [],
        }


def run_all(limit: Optional[int], max_workers: int) -> Dict[str, Any]:
    workers = max(1, max_workers)
    logger.info(
        "Starting scrape run (%d sources, %d worker threads)%s",
        len(SCRAPERS),
        workers,
        f", per-source limit={limit}" if limit is not None else "",
    )
    pending: Dict[str, Dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(_run_one_scraper, spec, limit) for spec in SCRAPERS
        ]
        for future in concurrent.futures.as_completed(futures):
            folder, block = future.result()
            pending[folder] = block

    sources = {spec.folder: pending[spec.folder] for spec in SCRAPERS}
    ok = sum(1 for s in sources.values() if s["ok"])
    logger.info("Scrape run complete: %d/%d sources succeeded", ok, len(sources))
    return {
        "generatedAt": now_iso8601(),
        "limit": limit,
        "maxWorkers": workers,
        "sources": sources,
    }


def _parse_log_level(name: str) -> int:
    level = getattr(logging, name.upper(), None)
    if not isinstance(level, int):
        raise argparse.ArgumentTypeError(f"Unknown log level: {name}")
    return level


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run all news scrapers and merge JSON output.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        metavar="PATH",
        help="Write merged JSON to this file. If omitted, JSON is printed to stdout only.",
    )
    parser.add_argument(
        "-n",
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Max items per scraper (Foreks: maps to API `last` parameter). Omit for each scraper's default.",
    )
    parser.add_argument(
        "--log-level",
        type=_parse_log_level,
        default=logging.INFO,
        metavar="LEVEL",
        help="Console log level: DEBUG, INFO, WARNING, ERROR (default: INFO).",
    )
    parser.add_argument(
        "--log-file",
        type=Path,
        default=None,
        metavar="PATH",
        help="If set, duplicate logs to this file (UTF-8).",
    )
    parser.add_argument(
        "-j",
        "--workers",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Max concurrent scraper threads (default: one per scraper, "
            f"currently {len(SCRAPERS)})."
        ),
    )
    args = parser.parse_args(argv)

    configure_logging(args.log_level, args.log_file)
    if args.output is not None:
        logger.info("Output JSON path: %s", args.output.resolve())
    else:
        logger.info("Output JSON: stdout (no file; pass -o PATH to write a file)")

    workers = args.workers if args.workers is not None else len(SCRAPERS)
    payload = run_all(args.limit, workers)
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    encoded = text.encode("utf-8")
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        logger.info("Wrote JSON (%d bytes) to %s", len(encoded), args.output.resolve())
    else:
        sys.stdout.buffer.write(encoded)
        if not text.endswith("\n"):
            sys.stdout.buffer.write(b"\n")
        sys.stdout.buffer.flush()
        logger.info("Wrote JSON (%d bytes) to stdout", len(encoded))

    ok_sources = sum(1 for s in payload["sources"].values() if s["ok"])
    total = len(payload["sources"])
    logger.info("Summary: %d/%d scrapers succeeded.", ok_sources, total)
    for name, block in payload["sources"].items():
        if block["ok"]:
            logger.info("  %s: %d articles", name, block["count"])
        else:
            logger.warning("  %s: failed (%s)", name, block["error"])

    return 0 if ok_sources == total else 1


if __name__ == "__main__":
    sys.exit(main())
