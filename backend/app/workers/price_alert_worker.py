"""Background Binance ticker worker that triggers user price alerts."""

from __future__ import annotations

import asyncio
import json
import logging
import ssl
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import certifi
import websockets
from sqlalchemy import select

from app.db.models.price_alerts import PriceAlert
from app.db.models.user_notifications import UserNotification
from app.db.repositories.price_alert_repository import PriceAlertRepository
from app.db.session import async_session_factory
from app.services.notification_push import notification_connection_manager, serialize_notification

logger = logging.getLogger(__name__)

_alert_worker_task: Optional[asyncio.Task[None]] = None
_stop_event: Optional[asyncio.Event] = None
_ALERT_RELOAD_SECONDS = 30
_HEARTBEAT_TIMEOUT_SECONDS = 75
_MIN_TRIGGER_INTERVAL_SECONDS = 1
_MAX_RECONNECT_SECONDS = 30
_BINANCE_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_BINANCE_UNVERIFIED_SSL_CONTEXT = ssl._create_unverified_context()
_worker_status: dict[str, object] = {
    "state": "stopped",
    "watched_symbols": [],
    "active_alert_count": 0,
    "last_error": None,
    "updated_at": None,
}


@dataclass(frozen=True)
class AlertSnapshot:
    id: str
    user_id: str
    asset_id: str
    symbol: str
    condition: str
    target_price: Decimal


def _set_worker_status(
    *,
    state: str,
    watched_symbols: Optional[list[str]] = None,
    active_alert_count: Optional[int] = None,
    last_error: Optional[str] = None,
) -> None:
    _worker_status["state"] = state
    if watched_symbols is not None:
        _worker_status["watched_symbols"] = watched_symbols
    if active_alert_count is not None:
        _worker_status["active_alert_count"] = active_alert_count
    _worker_status["last_error"] = last_error
    _worker_status["updated_at"] = datetime.now(timezone.utc).isoformat()


def get_price_alert_worker_status() -> dict[str, object]:
    """Return the current in-process price alert worker state."""
    return {
        **_worker_status,
        "running": _alert_worker_task is not None and not _alert_worker_task.done(),
    }


def _alert_triggered(alert: AlertSnapshot, price: Decimal) -> bool:
    if alert.condition == "above":
        return price >= alert.target_price
    if alert.condition == "below":
        return price <= alert.target_price
    return False


def _build_ws_url(symbols: list[str]) -> str:
    streams = "/".join(f"{symbol.lower()}@ticker" for symbol in symbols)
    return f"wss://stream.binance.com:9443/stream?streams={streams}"


@asynccontextmanager
async def _connect_ticker_stream(url: str):
    try:
        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=20,
            ssl=_BINANCE_SSL_CONTEXT,
        ) as websocket:
            yield websocket
    except ssl.SSLCertVerificationError:
        logger.warning(
            "Binance websocket certificate verification failed; retrying with local fallback SSL context."
        )
        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=20,
            ssl=_BINANCE_UNVERIFIED_SSL_CONTEXT,
        ) as websocket:
            yield websocket


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
        triggered = await session.get(PriceAlert, uuid.UUID(alert.id))
        if triggered is None or not triggered.is_active or triggered.triggered_at is not None:
            return
        triggered.is_active = False
        triggered.triggered_at = datetime.now(timezone.utc)
        triggered.last_checked_price = price
        trigger_key = triggered.triggered_at.isoformat()
        dedupe_key = f"price_alert:{triggered.id}:{trigger_key}"
        notification = _build_price_alert_notification(
            alert=triggered,
            current_price=price,
            dedupe_key=dedupe_key,
        )
        session.add(notification)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Could not persist triggered alert notification for %s", alert.id)
            return
        await session.refresh(notification)
        await notification_connection_manager.publish(
            notification.user_id,
            serialize_notification(notification),
        )


def _build_price_alert_notification(
    *,
    alert: PriceAlert,
    current_price: Decimal,
    dedupe_key: str,
) -> UserNotification:
    direction = "above" if alert.condition == "above" else "below"
    title = f"{alert.symbol} price alert triggered"
    message = (
        f"{alert.symbol} is now {direction} {alert.target_price.normalize()} "
        f"(current {current_price.normalize()})."
    )
    return UserNotification(
        user_id=alert.user_id,
        type="price_alert",
        title=title,
        message=message,
        payload={
            "alert_id": str(alert.id),
            "asset_id": str(alert.asset_id),
            "symbol": alert.symbol,
            "condition": alert.condition,
            "target_price": str(alert.target_price),
            "current_price": str(current_price),
        },
        dedupe_key=dedupe_key,
    )


async def _backfill_missing_trigger_notifications() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(PriceAlert)
            .where(PriceAlert.triggered_at.is_not(None))
            .order_by(PriceAlert.triggered_at.desc())
            .limit(100)
        )
        triggered_alerts = list(result.scalars().all())
        created: list[UserNotification] = []
        for triggered in triggered_alerts:
            existing = await session.scalar(
                select(UserNotification.id).where(
                    UserNotification.user_id == triggered.user_id,
                    UserNotification.type == "price_alert",
                    UserNotification.dedupe_key.like(f"price_alert:{triggered.id}:%"),
                )
            )
            if existing is not None:
                continue
            trigger_key = (
                triggered.triggered_at.isoformat()
                if triggered.triggered_at is not None
                else datetime.now(timezone.utc).isoformat()
            )
            notification = _build_price_alert_notification(
                alert=triggered,
                current_price=triggered.last_checked_price or triggered.target_price,
                dedupe_key=f"price_alert:{triggered.id}:{trigger_key}",
            )
            session.add(notification)
            created.append(notification)
        if not created:
            return
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Could not backfill missing price alert notifications.")
            return
        for notification in created:
            await session.refresh(notification)
            await notification_connection_manager.publish(
                notification.user_id,
                serialize_notification(notification),
            )
        logger.info("Backfilled %s missing price alert notifications.", len(created))


async def _consume_alert_stream(stop_event: asyncio.Event) -> None:
    reconnect_delay = 1.0
    last_trigger_at: dict[str, datetime] = {}

    while not stop_event.is_set():
        alerts_by_symbol = await _load_active_alerts()
        symbols = sorted(alerts_by_symbol)
        if not symbols:
            _set_worker_status(state="idle", watched_symbols=[], active_alert_count=0)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=_ALERT_RELOAD_SECONDS)
            except asyncio.TimeoutError:
                pass
            continue

        url = _build_ws_url(symbols)
        active_alert_count = sum(len(alerts) for alerts in alerts_by_symbol.values())
        _set_worker_status(
            state="connecting",
            watched_symbols=symbols,
            active_alert_count=active_alert_count,
        )
        logger.info("Price alert worker connecting for symbols: %s", ", ".join(symbols))
        try:
            async with _connect_ticker_stream(url) as websocket:
                reconnect_delay = 1.0
                reload_at = asyncio.get_running_loop().time() + _ALERT_RELOAD_SECONDS
                _set_worker_status(
                    state="watching",
                    watched_symbols=symbols,
                    active_alert_count=active_alert_count,
                )

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
                        _set_worker_status(
                            state="reconnecting",
                            watched_symbols=symbols,
                            active_alert_count=active_alert_count,
                            last_error="heartbeat timeout",
                        )
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
        except Exception as exc:
            logger.exception("Price alert worker stream failed; reconnecting.")
            _set_worker_status(
                state="reconnecting",
                watched_symbols=symbols,
                active_alert_count=active_alert_count,
                last_error=str(exc),
            )

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
    _set_worker_status(state="starting")
    await _backfill_missing_trigger_notifications()
    _alert_worker_task = asyncio.create_task(_consume_alert_stream(_stop_event))


async def stop_price_alert_worker() -> None:
    """Stop the alert worker on application shutdown."""
    global _alert_worker_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    _set_worker_status(state="stopped", watched_symbols=[], active_alert_count=0)
    if _alert_worker_task is not None:
        _alert_worker_task.cancel()
        await asyncio.gather(_alert_worker_task, return_exceptions=True)
    _alert_worker_task = None
    _stop_event = None
