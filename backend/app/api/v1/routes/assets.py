"""Tradable assets (read for users, write for admin)."""

import logging
import asyncio
import uuid
import json
import time
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.bootstrap import backfill_onchain_for_asset_detached
from app.db.repositories.asset_repository import AssetRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateAssetRequest, EnsureAssetRequest, UpdateAssetRequest
from app.models.response.table_responses import AssetResponse, PaginatedResponse

router = APIRouter(prefix="/assets")
logger = logging.getLogger(__name__)
_BINANCE_TICKER_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
_BINANCE_TICKER_CACHE_TTL_SECONDS = 20.0
_binance_ticker_cache: tuple[float, list[dict]] | None = None
_binance_ticker_inflight: asyncio.Task[list[dict]] | None = None
_binance_ticker_lock = asyncio.Lock()


def _fetch_binance_ticker_24h_sync() -> list[dict]:
    req = Request(
        _BINANCE_TICKER_24H_URL,
        headers={"User-Agent": "tauron-assets-binance/1.0"},
    )
    with urlopen(req, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload if isinstance(payload, list) else []


async def _fetch_binance_ticker_24h_cached() -> list[dict]:
    global _binance_ticker_cache, _binance_ticker_inflight
    now = time.monotonic()
    task: asyncio.Task[list[dict]] | None = None
    async with _binance_ticker_lock:
        if _binance_ticker_cache and (now - _binance_ticker_cache[0]) <= _BINANCE_TICKER_CACHE_TTL_SECONDS:
            return _binance_ticker_cache[1]
        if _binance_ticker_inflight is None:
            _binance_ticker_inflight = asyncio.create_task(asyncio.to_thread(_fetch_binance_ticker_24h_sync))
        task = _binance_ticker_inflight

    try:
        rows = await task
    finally:
        async with _binance_ticker_lock:
            if _binance_ticker_inflight is task:
                _binance_ticker_inflight = None

    async with _binance_ticker_lock:
        _binance_ticker_cache = (time.monotonic(), rows)
    return rows


@router.get("", response_model=PaginatedResponse[AssetResponse])
async def list_assets(
    pagination: PaginationParams = Depends(get_pagination),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
    sort: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List assets with pagination and optional search."""
    repository = AssetRepository(session)
    total = await repository.count(is_active=is_active, search=search)

    if sort in {"popular", "gainers_24h", "losers_24h"}:
        all_rows = await repository.list_page(
            offset=0,
            limit=max(total, pagination.page_size),
            is_active=is_active,
            search=search,
        )
        rank_by_symbol: dict[str, int] = {}
        change24h_by_symbol: dict[str, float] = {}
        quote_volume_by_symbol: dict[str, float] = {}
        try:
            markets = await _fetch_binance_ticker_24h_cached()
        except Exception as exc:
            logger.warning("assets sort Binance fetch failed: %s", exc)
            markets = []
        for item in markets:
            if not isinstance(item, dict):
                continue
            pair = item.get("symbol")
            if not isinstance(pair, str):
                continue
            quote = "USDT" if pair.endswith("USDT") else ("USD" if pair.endswith("USD") else None)
            if quote is None:
                continue
            base = pair[: -len(quote)].upper()
            if not base:
                continue
            change_raw = item.get("priceChangePercent")
            volume_raw = item.get("quoteVolume")
            if isinstance(change_raw, str):
                try:
                    change_by = float(change_raw)
                    change24h_by_symbol[base] = change_by
                except ValueError:
                    pass
            if isinstance(volume_raw, str):
                try:
                    volume = float(volume_raw)
                    if volume > quote_volume_by_symbol.get(base, -1.0):
                        quote_volume_by_symbol[base] = volume
                except ValueError:
                    pass
        sorted_bases = sorted(quote_volume_by_symbol.items(), key=lambda kv: kv[1], reverse=True)
        for idx, (base, _vol) in enumerate(sorted_bases, start=1):
            rank_by_symbol[base] = idx

        if sort == "popular":
            rows_sorted = sorted(
                all_rows,
                key=lambda row: (
                    rank_by_symbol.get((row.symbol or "").upper(), 10**9),
                    -quote_volume_by_symbol.get((row.symbol or "").upper(), -1.0),
                    row.symbol.upper(),
                ),
            )
        elif sort == "gainers_24h":
            rows_sorted = sorted(
                all_rows,
                key=lambda row: (
                    -(
                        change24h_by_symbol.get(
                            (row.symbol or "").upper(),
                            change24h_by_symbol.get((row.symbol or "").upper(), -10**9),
                        )
                    ),
                    rank_by_symbol.get((row.symbol or "").upper(), 10**9),
                    row.symbol.upper(),
                ),
            )
        else:
            rows_sorted = sorted(
                all_rows,
                key=lambda row: (
                    change24h_by_symbol.get(
                        (row.symbol or "").upper(),
                        change24h_by_symbol.get((row.symbol or "").upper(), 10**9),
                    ),
                    rank_by_symbol.get((row.symbol or "").upper(), 10**9),
                    row.symbol.upper(),
                ),
            )
        rows = rows_sorted[pagination.offset : pagination.offset + pagination.page_size]
    else:
        rows = await repository.list_page(
            offset=pagination.offset,
            limit=pagination.page_size,
            is_active=is_active,
            search=search,
        )
    return PaginatedResponse(
        items=[AssetResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/live-market")
async def get_live_market(
    symbols: str = Query(default="", description="Comma-separated asset symbols."),
    limit: int = Query(default=200, ge=1, le=500, description="Maximum number of rows to return."),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    parsed_symbols = {s.strip().upper() for s in symbols.split(",") if s.strip()}
    try:
        rows = await _fetch_binance_ticker_24h_cached()
    except Exception as exc:
        logger.warning("live market endpoint Binance fetch failed: %s", exc)
        return []

    best_by_base: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        pair = row.get("symbol")
        if not isinstance(pair, str):
            continue
        quote = "USDT" if pair.endswith("USDT") else ("USD" if pair.endswith("USD") else None)
        if quote is None:
            continue
        symbol = pair[: -len(quote)].upper()
        if not symbol:
            continue
        if parsed_symbols and symbol not in parsed_symbols:
            continue
        quote_volume = None
        try:
            quote_volume = float(row.get("quoteVolume"))
        except (TypeError, ValueError):
            quote_volume = None
        current_best = best_by_base.get(symbol)
        current_best_volume = None
        if current_best is not None:
            try:
                current_best_volume = float(current_best.get("quoteVolume"))
            except (TypeError, ValueError):
                current_best_volume = None
        if current_best is None or (quote_volume is not None and (current_best_volume is None or quote_volume > current_best_volume)):
            best_by_base[symbol] = row

    sorted_rows = sorted(
        best_by_base.items(),
        key=lambda kv: float(kv[1].get("quoteVolume") or 0.0),
        reverse=True,
    )
    out: list[dict] = []
    for idx, (symbol, row) in enumerate(sorted_rows, start=1):
        if not parsed_symbols and idx > limit:
            break
        try:
            price = float(row.get("lastPrice"))
        except (TypeError, ValueError):
            price = None
        try:
            change24h = float(row.get("priceChangePercent"))
        except (TypeError, ValueError):
            change24h = None
        try:
            volume = float(row.get("quoteVolume"))
        except (TypeError, ValueError):
            volume = None
        out.append(
            {
                "symbol": symbol,
                "price": price,
                "volume": volume,
                "market_cap": None,
                "rank": idx,
                "name": symbol,
                "price_change_1h": None,
                "price_change_24h": change24h,
                "price_change_7d": None,
                "price_change_30d": None,
                "price_change_1y": None,
            }
        )
    return out


def _best_ticker_row_by_base(markets: list) -> dict[str, dict]:
    """Pick highest quoteVolume row per base asset (USDT/USD pairs)."""
    best_by_base: dict[str, dict] = {}
    for row in markets:
        if not isinstance(row, dict):
            continue
        pair = row.get("symbol")
        if not isinstance(pair, str):
            continue
        quote = "USDT" if pair.endswith("USDT") else ("USD" if pair.endswith("USD") else None)
        if quote is None:
            continue
        symbol = pair[: -len(quote)].upper()
        if not symbol:
            continue
        quote_volume = None
        try:
            quote_volume = float(row.get("quoteVolume"))
        except (TypeError, ValueError):
            quote_volume = None
        current_best = best_by_base.get(symbol)
        current_best_volume = None
        if current_best is not None:
            try:
                current_best_volume = float(current_best.get("quoteVolume"))
            except (TypeError, ValueError):
                current_best_volume = None
        if current_best is None or (
            quote_volume is not None and (current_best_volume is None or quote_volume > current_best_volume)
        ):
            best_by_base[symbol] = row
    return best_by_base


def _ticker_float(row: dict, key: str) -> float | None:
    try:
        raw = row.get(key)
        if raw is None:
            return None
        return float(raw)
    except (TypeError, ValueError):
        return None


def _fetch_binance_klines_sync(symbol_pair: str, interval: str, limit: int) -> list:
    safe_limit = max(2, min(1000, limit))
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol_pair}&interval={interval}&limit={safe_limit}"
    req = Request(url, headers={"User-Agent": "tauron-market-movers/1.0"})
    with urlopen(req, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload if isinstance(payload, list) else []


def _close_to_close_abs_pct(klines: list) -> float | None:
    if not klines or len(klines) < 2:
        return None
    try:
        c0 = float(klines[0][4])
        c1 = float(klines[-1][4])
        if c0 <= 0:
            return None
        return abs((c1 - c0) / c0 * 100.0)
    except (TypeError, ValueError, IndexError):
        return None


@router.get("/market-movers")
async def get_market_movers(
    metric: str = Query(
        ...,
        description="volume | gainer | loser | volatile (absolute move over window).",
    ),
    window: str = Query(
        default="24h",
        description="For volatile: 1h | 6h | 24h | 1d | 7d. Ignored for volume/gainer/loser.",
    ),
    limit: int = Query(default=10, ge=1, le=25),
    scan_limit: int = Query(
        default=60,
        ge=20,
        le=100,
        description="Liquid USDT pairs to scan with klines for short-window volatile ranking.",
    ),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Binance spot snapshot: top gainers/losers/volume or most volatile by window.
    Short windows rank among top ``scan_limit`` pairs by 24h quote volume.
    """
    metric_norm = metric.strip().lower()
    if metric_norm not in {"volume", "gainer", "loser", "volatile"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="metric must be volume, gainer, loser, or volatile",
        )
    window_norm = window.strip().lower()
    if window_norm not in {"1h", "6h", "24h", "1d", "7d"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="window must be 1h, 6h, 24h, 1d, or 7d",
        )

    try:
        markets = await _fetch_binance_ticker_24h_cached()
    except Exception as exc:
        logger.warning("market-movers Binance ticker fetch failed: %s", exc)
        return {
            "metric": metric_norm,
            "window": window_norm,
            "methodology": "Binance USDT/USD 24h ticker unavailable.",
            "items": [],
        }

    best = _best_ticker_row_by_base(markets)
    if not best:
        return {"metric": metric_norm, "window": window_norm, "methodology": "No ticker rows.", "items": []}

    def enrich_item(rank: int, base: str, sort_value: float, extra_note: str | None = None) -> dict:
        row = best.get(base, {})
        price = _ticker_float(row, "lastPrice")
        vol = _ticker_float(row, "quoteVolume")
        chg24 = _ticker_float(row, "priceChangePercent")
        item = {
            "rank": rank,
            "symbol": base,
            "last_price_usdt": price,
            "quote_volume_24h_usdt": vol,
            "price_change_24h_pct": chg24,
            "sort_value": round(sort_value, 6) if sort_value == sort_value else sort_value,
        }
        if extra_note:
            item["note"] = extra_note
        return item

    methodology_parts = ["Binance spot USDT (and USD where present)."]

    if metric_norm == "volume":
        ordered = sorted(
            best.items(),
            key=lambda kv: (_ticker_float(kv[1], "quoteVolume") or 0.0),
            reverse=True,
        )[:limit]
        methodology_parts.append("Sorted by 24h quote volume.")
        items = [
            enrich_item(i + 1, base, _ticker_float(row, "quoteVolume") or 0.0)
            for i, (base, row) in enumerate(ordered)
        ]
        return {
            "metric": metric_norm,
            "window": "24h",
            "methodology": " ".join(methodology_parts),
            "items": items,
        }

    if metric_norm == "gainer":
        ordered = sorted(
            best.items(),
            key=lambda kv: (_ticker_float(kv[1], "priceChangePercent") or -1e9),
            reverse=True,
        )[:limit]
        methodology_parts.append("Sorted by 24h priceChangePercent descending.")
        items = [
            enrich_item(i + 1, base, _ticker_float(row, "priceChangePercent") or 0.0)
            for i, (base, row) in enumerate(ordered)
        ]
        return {
            "metric": metric_norm,
            "window": "24h",
            "methodology": " ".join(methodology_parts),
            "items": items,
        }

    if metric_norm == "loser":
        ordered = sorted(
            best.items(),
            key=lambda kv: (_ticker_float(kv[1], "priceChangePercent") or 1e9),
        )[:limit]
        methodology_parts.append("Sorted by 24h priceChangePercent ascending (worst first).")
        items = [
            enrich_item(i + 1, base, _ticker_float(row, "priceChangePercent") or 0.0)
            for i, (base, row) in enumerate(ordered)
        ]
        return {
            "metric": metric_norm,
            "window": "24h",
            "methodology": " ".join(methodology_parts),
            "items": items,
        }

    # volatile
    if window_norm in {"24h", "1d"}:
        scored: list[tuple[str, float]] = []
        for base, row in best.items():
            chg = _ticker_float(row, "priceChangePercent")
            if chg is None:
                continue
            scored.append((base, abs(chg)))
        scored.sort(key=lambda x: x[1], reverse=True)
        methodology_parts.append("Volatility proxy: absolute 24h priceChangePercent from ticker.")
        items = [enrich_item(i + 1, base, val) for i, (base, val) in enumerate(scored[:limit])]
        return {
            "metric": metric_norm,
            "window": window_norm,
            "methodology": " ".join(methodology_parts),
            "items": items,
        }

    interval_limit: tuple[str, int]
    if window_norm == "1h":
        interval_limit = ("5m", 13)
        methodology_parts.append("Klines 5m×13: absolute close-to-close % (~1h).")
    elif window_norm == "6h":
        interval_limit = ("15m", 25)
        methodology_parts.append("Klines 15m×25: absolute close-to-close % (~6h).")
    else:  # 7d
        interval_limit = ("4h", 42)
        methodology_parts.append("Klines 4h×42: absolute close-to-close % (~7d).")

    interval, klim = interval_limit

    liquid = sorted(
        best.items(),
        key=lambda kv: (_ticker_float(kv[1], "quoteVolume") or 0.0),
        reverse=True,
    )[:scan_limit]
    bases = [b for b, _ in liquid]

    sem = asyncio.Semaphore(8)

    async def score_base(base: str) -> tuple[str, float]:
        async with sem:
            pair = f"{base}USDT" if base != "USDT" else "USDTUSD"
            raw = await asyncio.to_thread(_fetch_binance_klines_sync, pair, interval, klim)
            pct = _close_to_close_abs_pct(raw)
            return (base, pct if pct is not None else -1.0)

    scored_k = await asyncio.gather(*[score_base(b) for b in bases])
    scored_k = [(b, v) for b, v in scored_k if v >= 0]
    scored_k.sort(key=lambda x: x[1], reverse=True)
    methodology_parts.append(f"Among top {len(bases)} pairs by 24h quote volume.")

    items = [enrich_item(i + 1, base, val) for i, (base, val) in enumerate(scored_k[:limit])]
    return {
        "metric": metric_norm,
        "window": window_norm,
        "methodology": " ".join(methodology_parts),
        "items": items,
    }


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one asset by id."""
    repository = AssetRepository(session)
    row = await repository.get_by_id(asset_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return AssetResponse.model_validate(row)


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    body: CreateAssetRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Create an asset (admin) and auto-backfill on-chain metrics."""
    logger.info("create_asset request: symbol=%s name=%s", body.symbol, body.name)
    repository = AssetRepository(session)
    try:
        row = await repository.create(
            symbol=body.symbol,
            name=body.name,
            category=body.category,
            coingecko_id=body.coingecko_id,
            is_active=body.is_active,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Symbol already exists",
        ) from exc
    logger.info("create_asset created: symbol=%s asset_id=%s", row.symbol, row.id)
    asyncio.create_task(
        backfill_onchain_for_asset_detached(
            asset_id=str(row.id),
            symbol=row.symbol,
        )
    )
    logger.info("create_asset backfill queued: symbol=%s asset_id=%s", row.symbol, row.id)
    return AssetResponse.model_validate(row)


@router.post("/ensure", response_model=AssetResponse)
async def ensure_asset(
    body: EnsureAssetRequest,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Ensure an asset exists by symbol and auto-backfill on-chain metrics."""
    logger.info("ensure_asset request: symbol=%s name=%s", body.symbol, body.name)
    repository = AssetRepository(session)
    existing = await repository.get_by_symbol(body.symbol)
    if existing is not None:
        logger.info(
            "ensure_asset hit existing: symbol=%s asset_id=%s",
            existing.symbol,
            existing.id,
        )
        return AssetResponse.model_validate(existing)

    try:
        row = await repository.create(
            symbol=body.symbol,
            name=body.name,
            category=body.category,
            coingecko_id=body.coingecko_id,
            is_active=body.is_active,
        )
    except IntegrityError:
        logger.warning("ensure_asset race/conflict while creating symbol=%s", body.symbol)
        fallback = await repository.get_by_symbol(body.symbol)
        if fallback is None:
            logger.error("ensure_asset conflict but asset lookup failed: symbol=%s", body.symbol)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Symbol already exists",
            )
        logger.info(
            "ensure_asset recovered existing after conflict: symbol=%s asset_id=%s",
            fallback.symbol,
            fallback.id,
        )
        return AssetResponse.model_validate(fallback)

    logger.info("ensure_asset created: symbol=%s asset_id=%s", row.symbol, row.id)
    asyncio.create_task(
        backfill_onchain_for_asset_detached(
            asset_id=str(row.id),
            symbol=row.symbol,
        )
    )
    logger.info("ensure_asset backfill queued: symbol=%s asset_id=%s", row.symbol, row.id)
    return AssetResponse.model_validate(row)


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    body: UpdateAssetRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch an asset (admin)."""
    repository = AssetRepository(session)
    data = body.model_dump(exclude_unset=True)
    try:
        row = await repository.update(asset_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflicts with existing data",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return AssetResponse.model_validate(row)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete an asset (admin)."""
    repository = AssetRepository(session)
    deleted = await repository.delete(asset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
