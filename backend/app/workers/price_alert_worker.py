"""Background Binance ticker worker that triggers user price alerts."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import websockets

from app.db.repositories.notification_repository import NotificationRepository
from app.db.repositories.price_alert_repository import PriceAlertRepository
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)

_alert_worker_task: Optional[asyncio.Task[None]] = None
_stop_event: Optional[asyncio.Event] = None
_ALERT_RELOAD_SECONDS = 30
_HEARTBEAT_TIMEOUT_SECONDS = 75
_MIN_TRIGGER_INTERVAL_SECONDS = 1
_MAX_RECONNECT_SECONDS = 30


@dataclass(frozen=True)
class AlertSnapshot:
    id: str
    user_id: str
    asset_id: str
    symbol: str
    condition: str
    target_price: Decimal


def _alert_triggered(alert: AlertSnapshot, price: Decimal) -> bool:
    if alert.condition == "above":
        return price >= alert.target_price
    if alert.condition == "below":
        return price <= alert.target_price
    return False


def _build_ws_url(symbols: list[str]) -> str:
    streams = "/".join(f"{symbol.lower()}@ticker" for symbol in symbols)
    return f"wss://stream.binance.com:9443/stream?streams={streams}"


async def _load_active_alerts() -> dict[str, list[AlertSnapshot]]:
    async with async_session_factory() as session:
        repository = PriceAlertRepository(session)
        rows = await repository.list_active()
    alerts_by_symbol: dict[str, list[AlertSnapshot]] = {}
    for alert, _asset in rows:
        snapshot = AlertSnapshot(
            id=str(alert.id),
            user_id=str(alert.user_id),
            asset_id=str(alert.asset_id),
            symbol=alert.symbol.upper(),
            condition=alert.condition,
            target_price=alert.target_price,
        )
        alerts_by_symbol.setdefault(snapshot.symbol, []).append(snapshot)
    return alerts_by_symbol


async def _trigger_alert(alert: AlertSnapshot, price: Decimal) -> None:
    async with async_session_factory() as session:
        alert_repo = PriceAlertRepository(session)
        triggered = await alert_repo.trigger_if_active(
            alert_id=uuid.UUID(alert.id),
            current_price=price,
        )
        if triggered is None:
            return
        notification_repo = NotificationRepository(session)
        direction = "above" if alert.condition == "above" else "below"
        title = f"{alert.symbol} price alert triggered"
        message = (
            f"{alert.symbol} is now {direction} {alert.target_price.normalize()} "
            f"(current {price.normalize()})."
        )
        try:
            await notification_repo.create(
                user_id=triggered.user_id,
                type="price_alert",
                title=title,
                message=message,
                payload={
                    "alert_id": str(triggered.id),
                    "asset_id": str(triggered.asset_id),
                    "symbol": triggered.symbol,
                    "condition": triggered.condition,
                    "target_price": str(triggered.target_price),
                    "current_price": str(price),
                },
                dedupe_key=f"price_alert:{triggered.id}",
            )
        except Exception:
            logger.exception("Could not create price alert notification for %s", triggered.id)


async def _consume_alert_stream(stop_event: asyncio.Event) -> None:
    reconnect_delay = 1.0
    last_trigger_at: dict[str, datetime] = {}

    while not stop_event.is_set():
        alerts_by_symbol = await _load_active_alerts()
        symbols = sorted(alerts_by_symbol)
        if not symbols:
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=_ALERT_RELOAD_SECONDS)
            except asyncio.TimeoutError:
                pass
            continue

        url = _build_ws_url(symbols)
        logger.info("Price alert worker connecting for symbols: %s", ", ".join(symbols))
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=20) as websocket:
                reconnect_delay = 1.0
                reload_at = asyncio.get_running_loop().time() + _ALERT_RELOAD_SECONDS

                while not stop_event.is_set():
                    if asyncio.get_running_loop().time() >= reload_at:
                        break
                    try:
                        raw = await asyncio.wait_for(
                            websocket.recv(),
                            timeout=_HEARTBEAT_TIMEOUT_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        logger.warning("Price alert worker heartbeat timeout; reconnecting.")
                        break
                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    data = payload.get("data") if isinstance(payload, dict) else None
                    if not isinstance(data, dict):
                        continue
                    symbol = str(data.get("s") or "").upper()
                    raw_price = data.get("c")
                    if symbol not in alerts_by_symbol or raw_price is None:
                        continue
                    try:
                        price = Decimal(str(raw_price))
                    except Exception:
                        continue
                    for alert in list(alerts_by_symbol.get(symbol, [])):
                        if not _alert_triggered(alert, price):
                            continue
                        now = datetime.now(timezone.utc)
                        previous = last_trigger_at.get(alert.id)
                        if previous and (now - previous).total_seconds() < _MIN_TRIGGER_INTERVAL_SECONDS:
                            continue
                        last_trigger_at[alert.id] = now
                        await _trigger_alert(alert, price)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Price alert worker stream failed; reconnecting.")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=reconnect_delay)
        except asyncio.TimeoutError:
            pass
        reconnect_delay = min(reconnect_delay * 2, _MAX_RECONNECT_SECONDS)


async def start_price_alert_worker() -> None:
    """Start the alert worker once per process."""
    global _alert_worker_task, _stop_event
    if _alert_worker_task is not None and not _alert_worker_task.done():
        return
    _stop_event = asyncio.Event()
    _alert_worker_task = asyncio.create_task(_consume_alert_stream(_stop_event))


async def stop_price_alert_worker() -> None:
    """Stop the alert worker on application shutdown."""
    global _alert_worker_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _alert_worker_task is not None:
        _alert_worker_task.cancel()
        await asyncio.gather(_alert_worker_task, return_exceptions=True)
    _alert_worker_task = None
    _stop_event = None
