"""Structured logging and request trace identifiers."""

import contextvars
import logging
import sys
import uuid
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

trace_id_context: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "trace_id",
    default=None,
)


def get_trace_id() -> Optional[str]:
    """Return the current request trace identifier, if any."""
    return trace_id_context.get()


def setup_logging(service_name: str, log_level: str) -> None:
    """Configure root logging with service name and trace id on each record."""
    resolved_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(
        logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s service=%(service_name)s "
            "trace=%(trace_id)s %(message)s"
        )
    )
    stream_handler.addFilter(_ServiceContextFilter(service_name))
    root_logger.addHandler(stream_handler)
    root_logger.setLevel(resolved_level)


class _ServiceContextFilter(logging.Filter):
    """Injects ``service_name`` and ``trace_id`` into log records."""

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self._service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        record.service_name = self._service_name
        trace_value = get_trace_id()
        record.trace_id = trace_value if trace_value is not None else "-"
        return True


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Binds a trace id per request and exposes ``request.state.request_id``."""

    async def dispatch(self, request: Request, call_next):
        header_value = request.headers.get("X-Request-ID")
        request_id = header_value if header_value else str(uuid.uuid4())
        token = trace_id_context.set(request_id)
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        finally:
            trace_id_context.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response
