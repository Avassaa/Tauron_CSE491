"""Backfill on-chain metrics into on_chain_metrics for the last N years.

Data source: CoinMetrics Community API (daily asset metrics).

Usage examples:
  python scripts/backfill_on_chain_metrics.py --symbols BTC ETH --years 5
  python scripts/backfill_on_chain_metrics.py --symbols BTC --metrics AdrActCnt TxCnt CapMrktCurUSD
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import psycopg
from psycopg import sql

from app.config import settings

COINMETRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
DEFAULT_METRICS = ["AdrActCnt", "TxCnt", "CapMrktCurUSD", "SplyCur"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill on-chain metrics into Postgres.")
    parser.add_argument(
        "--symbols",
        nargs="+",
        required=True,
        help="Asset symbols from assets table (e.g. BTC ETH).",
    )
    parser.add_argument(
        "--metrics",
        nargs="+",
        default=DEFAULT_METRICS,
        help=f"CoinMetrics metric names. Default: {' '.join(DEFAULT_METRICS)}",
    )
    parser.add_argument("--years", type=int, default=5, help="How many years to backfill.")
    parser.add_argument(
        "--frequency",
        default="1d",
        choices=["1d", "1h"],
        help="Metric sampling frequency.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and map rows but do not write to DB.",
    )
    return parser.parse_args()


def build_db_dsn() -> str:
    password = settings.POSTGRES_PASSWORD or ""
    return (
        f"host={settings.POSTGRES_HOST} "
        f"port={settings.POSTGRES_PORT} "
        f"dbname={settings.POSTGRES_DB} "
        f"user={settings.POSTGRES_USER} "
        f"password={password}"
    )


def fetch_coinmetrics_rows(
    asset_symbol: str,
    metrics: list[str],
    start_time: datetime,
    end_time: datetime,
    frequency: str,
) -> list[dict]:
    query = {
        "assets": asset_symbol.lower(),
        "metrics": ",".join(metrics),
        "frequency": frequency,
        "start_time": start_time.isoformat().replace("+00:00", "Z"),
        "end_time": end_time.isoformat().replace("+00:00", "Z"),
        "page_size": 10000,
    }
    url = f"{COINMETRICS_URL}?{urlencode(query)}"
    request = Request(url, headers={"User-Agent": "tauron-onchain-backfill/1.0"})

    try:
        with urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"CoinMetrics HTTP error for {asset_symbol}: {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"CoinMetrics network error for {asset_symbol}: {exc.reason}") from exc

    data = payload.get("data")
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected payload for {asset_symbol}: missing data[]")
    return data


def to_numeric(value: str | None) -> Decimal | None:
    if value is None:
        return None
    if value == "":
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def parse_time(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).astimezone(timezone.utc)


def load_asset_ids(conn: psycopg.Connection, symbols: list[str]) -> dict[str, str]:
    schema = settings.effective_database_schema
    symbol_set = {s.upper().strip() for s in symbols}
    if not symbol_set:
        return {}

    if schema:
        query = sql.SQL("SELECT id::text, symbol FROM {}.assets WHERE symbol = ANY(%s)").format(
            sql.Identifier(schema)
        )
    else:
        query = sql.SQL("SELECT id::text, symbol FROM assets WHERE symbol = ANY(%s)")

    with conn.cursor() as cursor:
        cursor.execute(query, (list(symbol_set),))
        rows = cursor.fetchall()

    return {symbol.upper(): asset_id for asset_id, symbol in rows}


def upsert_rows(conn: psycopg.Connection, rows: list[tuple[datetime, str, str, Decimal]]) -> None:
    if not rows:
        return

    schema = settings.effective_database_schema
    if schema:
        statement = sql.SQL(
            """
            INSERT INTO {}.on_chain_metrics (time, asset_id, metric_name, value)
            VALUES (%s, %s::uuid, %s, %s)
            ON CONFLICT (time, asset_id, metric_name)
            DO UPDATE SET value = EXCLUDED.value
            """
        ).format(sql.Identifier(schema))
    else:
        statement = sql.SQL(
            """
            INSERT INTO on_chain_metrics (time, asset_id, metric_name, value)
            VALUES (%s, %s::uuid, %s, %s)
            ON CONFLICT (time, asset_id, metric_name)
            DO UPDATE SET value = EXCLUDED.value
            """
        )

    with conn.cursor() as cursor:
        cursor.executemany(statement, rows)


def main() -> None:
    args = parse_args()
    symbols = [s.upper().strip() for s in args.symbols]
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=365 * args.years)

    with psycopg.connect(build_db_dsn(), autocommit=False) as conn:
        symbol_to_asset_id = load_asset_ids(conn, symbols)
        missing = [s for s in symbols if s not in symbol_to_asset_id]
        if missing:
            raise RuntimeError(
                f"Missing assets in assets table: {', '.join(missing)}. "
                "Insert these into assets first."
            )

        total_rows = 0
        for symbol in symbols:
            asset_id = symbol_to_asset_id[symbol]
            series = fetch_coinmetrics_rows(
                asset_symbol=symbol,
                metrics=args.metrics,
                start_time=start_time,
                end_time=end_time,
                frequency=args.frequency,
            )

            to_write: list[tuple[datetime, str, str, Decimal]] = []
            for point in series:
                time_raw = point.get("time")
                if not isinstance(time_raw, str):
                    continue
                point_time = parse_time(time_raw)

                for metric in args.metrics:
                    numeric = to_numeric(point.get(metric))
                    if numeric is None:
                        continue
                    to_write.append((point_time, asset_id, metric, numeric))

            if not args.dry_run:
                upsert_rows(conn, to_write)
                conn.commit()

            total_rows += len(to_write)
            print(f"{symbol}: prepared {len(to_write)} rows")

        mode = "dry-run" if args.dry_run else "written"
        print(f"Done. Total rows {mode}: {total_rows}")


if __name__ == "__main__":
    main()
