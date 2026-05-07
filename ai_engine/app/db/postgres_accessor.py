"""Synchronous Postgres readers used by training workers and inference."""

from __future__ import annotations

import re
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator
from uuid import UUID

import pandas as pd
import psycopg


def _quote_identifier(raw_name: str) -> str:
    """Escape a PostgreSQL identifier by doubling quotes inside the literal."""
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", raw_name):
        raise ValueError("Identifier must be alphanumeric with underscores only")
    return raw_name.replace('"', '""')


def _qualified_table(schema_name: str, table_name: str) -> str:
    """Return ``"schema"."table"`` for use inside SQL text strings."""
    safe_schema = _quote_identifier(schema_name)
    safe_table = _quote_identifier(table_name)
    return f'"{safe_schema}"."{safe_table}"'


@dataclass(frozen=True)
class PostgresAccessConfig:
    """Connection parameters for feature and metadata reads."""

    sync_database_url: str
    schema_name: str
    ssl_enabled: bool


@contextmanager
def open_connection(config: PostgresAccessConfig) -> Iterator[psycopg.Connection]:
    """Open a short-lived psycopg connection with optional TLS."""
    connect_kwargs: dict = {}
    if config.ssl_enabled:
        connect_kwargs["sslmode"] = "require"
    with psycopg.connect(config.sync_database_url, **connect_kwargs) as connection:
        yield connection


def fetch_active_asset_ids(config: PostgresAccessConfig) -> list[UUID]:
    """Return identifiers for rows in ``assets`` where ``is_active`` is true."""
    table_qual = _qualified_table(config.schema_name, "assets")
    query_template = """
        SELECT id::text
        FROM {table_qual}
        WHERE is_active IS TRUE
        ORDER BY symbol
        """
    query_sql = query_template.format(table_qual=table_qual)
    identifiers: list[UUID] = []
    with open_connection(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query_sql)
            for row in cursor.fetchall():
                identifiers.append(UUID(str(row[0])))
    return identifiers


def fetch_ml_model_registration(
    *,
    config: PostgresAccessConfig,
    model_id: UUID,
) -> dict[str, object] | None:
    """Return one ML model registry row keyed by lowercase-style column strings."""
    table_qual = _qualified_table(config.schema_name, "ml_models")
    query_sql = """
        SELECT id, asset_id, version_tag, model_type,
               hyperparameters, training_metrics, file_path,
               is_active, created_at
        FROM {table_qual}
        WHERE id = %(model_id)s
        LIMIT 1
        """.format(
        table_qual=table_qual,
    )
    with open_connection(config) as connection:
        with connection.cursor(row_factory=None) as cursor:
            cursor.execute(query_sql, {"model_id": str(model_id)})
            column_names = [desc.name for desc in cursor.description] if cursor.description else []
            row = cursor.fetchone()
            if row is None:
                return None
            return dict(zip(column_names, row))


def load_market_data_daily_frame(
    *,
    connection: psycopg.Connection,
    schema_name: str,
    asset_id: UUID,
    resolution: str = "1d",
) -> pd.DataFrame:
    """Return OHLCV bars from ``market_data`` as a wide daily frame indexed by UTC calendar day.

    One row per calendar day; if multiple bars share a day the latest timestamp wins.
    Returns an empty ``DataFrame`` when no data exists for the asset/resolution pair or if
    the table is unavailable.  Resolution filtering is applied in Python after loading so the
    query uses a single bind parameter and avoids any cursor-state issues on shared connections.
    """
    table_qual = _qualified_table(schema_name, "market_data")
    query_sql = """
        SELECT time AT TIME ZONE 'UTC' AS time_utc,
               resolution,
               open::double precision,
               high::double precision,
               low::double precision,
               close::double precision,
               volume::double precision
        FROM {table_qual}
        WHERE asset_id = %(asset_id)s
        ORDER BY time ASC
        """.format(
        table_qual=table_qual,
    )
    frame = pd.read_sql_query(
        query_sql,
        connection,
        params={"asset_id": str(asset_id)},
    )
    if frame.empty:
        return pd.DataFrame()
    frame = frame[frame["resolution"] == resolution].copy()
    if frame.empty:
        return pd.DataFrame()
    frame["time_utc"] = pd.to_datetime(frame["time_utc"], utc=True)
    frame["day"] = frame["time_utc"].dt.floor("D")
    daily = (
        frame.sort_values("time_utc")
        .groupby("day", as_index=False)
        .last()[["day", "open", "high", "low", "close", "volume"]]
    )
    return daily.set_index("day").sort_index()


def load_on_chain_long_frame(
    *,
    connection: psycopg.Connection,
    schema_name: str,
    asset_id: UUID,
) -> pd.DataFrame:
    """Return daily on-chain observations in long form for one asset."""
    table_qual = _qualified_table(schema_name, "on_chain_metrics")
    query_sql = """
        SELECT time AT TIME ZONE 'UTC' AS time_utc,
               metric_name,
               value::double precision AS metric_value
        FROM {table_qual}
        WHERE asset_id = %(asset_id)s
        ORDER BY time ASC
        """.format(
        table_qual=table_qual,
    )
    frame = pd.read_sql_query(
        query_sql,
        connection,
        params={"asset_id": str(asset_id)},
    )
    if frame.empty:
        return frame
    frame["time_utc"] = pd.to_datetime(frame["time_utc"], utc=True)
    frame["day"] = frame["time_utc"].dt.floor("D")
    daily = (
        frame.sort_values("time_utc")
        .groupby(["day", "metric_name"], as_index=False)
        .last()[["day", "metric_name", "metric_value"]]
    )
    return daily
