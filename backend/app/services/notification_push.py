"""In-process websocket fanout for user notifications."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

from fastapi import WebSocket


class NotificationConnectionManager:
    """Track active websocket connections per user for best-effort push."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(user_id, None)

    async def publish(self, user_id: uuid.UUID, notification: dict[str, Any]) -> None:
        connections = list(self._connections.get(user_id, ()))
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(
                    {
                        "type": "notification.created",
                        "notification": notification,
                    }
                )
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(user_id, websocket)


def serialize_notification(notification: Any) -> dict[str, Any]:
    """Convert a SQLAlchemy notification row into websocket-safe JSON."""
    return {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "payload": notification.payload,
        "is_read": notification.is_read,
        "read_at": notification.read_at.isoformat() if isinstance(notification.read_at, datetime) else None,
        "created_at": notification.created_at.isoformat()
        if isinstance(notification.created_at, datetime)
        else None,
    }


notification_connection_manager = NotificationConnectionManager()
