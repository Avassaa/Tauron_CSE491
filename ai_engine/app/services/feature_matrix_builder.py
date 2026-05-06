"""Build supervised learning frames: on-chain daily features, ``market_data`` close as label."""

from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.db.postgres_accessor import load_market_daily_close_frame, load_on_chain_long_frame


def _sanitize_metric_column_name(raw_metric_name: str) -> str:
    """Map an arbitrary metric label to a stable column name for sklearn."""
    cleaned = re.sub(r"[^0-9A-Za-z]+", "_", raw_metric_name.strip())
    cleaned = cleaned.strip("_") or "metric"
    return f"ocm_{cleaned[:120]}"


@dataclass(frozen=True)
class TrainingFrameBuildResult:
    """Outcome of assembling a single-asset matrix: chain features plus close-aligned targets."""

    feature_frame: pd.DataFrame
    target_series: pd.Series
    forecast_anchor_day: pd.Timestamp
    anchor_close_price: float


def select_top_variance_metrics(
    wide_frame: pd.DataFrame,
    metric_columns: list[str],
    *,
    maximum_columns: int,
) -> list[str]:
    """
    Prefer metrics with the highest variance (non-null) then non-null density.

    This limits column explosion when CoinMetrics emits many correlated series.
    """
    if len(metric_columns) <= maximum_columns:
        return metric_columns

    variance_scores = []
    for column_name in metric_columns:
        series = wide_frame[column_name]
        non_null_ratio = float(series.notna().mean())
        variance_value = float(np.nanvar(series.to_numpy(dtype=float), ddof=0))
        variance_scores.append((variance_value + 1e-12, non_null_ratio, column_name))

    variance_scores.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return [item[2] for item in variance_scores[:maximum_columns]]


def pivot_on_chain_daily(long_frame: pd.DataFrame) -> pd.DataFrame:
    """
    Pivot all metrics to UTC-day columns ordered chronologically.

    Applies a bounded forward-fill to smooth sparse exchange-style releases.
    """
    if long_frame.empty:
        return pd.DataFrame()

    long_copy = long_frame.copy()
    long_copy["feature_col"] = long_copy["metric_name"].astype(str).map(_sanitize_metric_column_name)
    wide_matrix = (
        long_copy.pivot(index="day", columns="feature_col", values="metric_value")
        .sort_index()
    )
    wide_matrix.columns = [str(chunk) for chunk in wide_matrix.columns]
    filled = wide_matrix.sort_index().ffill(limit=14)
    return filled


def capped_metric_columns_from_wide(wide_matrix: pd.DataFrame, *, column_cap: int) -> list[str]:
    """Rank wide columns by variance density and truncate to ``column_cap``."""
    available_columns = list(wide_matrix.columns)
    if not available_columns:
        return []
    return select_top_variance_metrics(wide_matrix, available_columns, maximum_columns=column_cap)


def wide_on_chain_from_long(long_frame: pd.DataFrame, *, column_cap: int) -> tuple[pd.DataFrame, list[str]]:
    """
    Return a capped wide dataframe for training alongside the chosen metric column names.
    """

    wide_matrix = pivot_on_chain_daily(long_frame)
    if wide_matrix.empty:
        return wide_matrix, []
    ranked = capped_metric_columns_from_wide(wide_matrix, column_cap=column_cap)
    if not ranked:
        return pd.DataFrame(), []
    trimmed = wide_matrix[ranked].sort_index()
    return trimmed, ranked


def build_training_frame_for_asset(
    *,
    connection,
    schema_name: str,
    asset_id,
    column_cap: int,
) -> TrainingFrameBuildResult | None:
    """
    Align capped on-chain pivots with daily ``market_data`` close labels.

    The regression target for every asset is ``log(close[t+1]) - log(close[t])`` aligned on
    dates where chain features overlap tradable candles. Rows without the next day's close drop out.

    Returns ``None`` when history is insufficient.
    """

    on_chain_long = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if on_chain_long.empty:
        return None

    trimmed_daily_wide, selected_columns = wide_on_chain_from_long(on_chain_long, column_cap=column_cap)
    if trimmed_daily_wide.empty or not selected_columns:
        return None

    close_series = load_market_daily_close_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if close_series.empty:
        return None

    price_frame = close_series.rename("close").to_frame().sort_index()
    price_frame["log_close"] = np.log(price_frame["close"].astype(float).clip(lower=1e-12))
    price_frame["_target_next_close_log_forward_return"] = (
        price_frame["log_close"].shift(-1) - price_frame["log_close"]
    )

    merged_daily_panel = trimmed_daily_wide.join(
        price_frame[["close", "_target_next_close_log_forward_return"]],
        how="inner",
    )
    merged_daily_panel = merged_daily_panel.replace([np.inf, -np.inf], np.nan)
    merged_daily_panel = merged_daily_panel.dropna(subset=["_target_next_close_log_forward_return"])

    feature_candidate_block = merged_daily_panel[selected_columns]
    row_has_any_feature_observation = ~feature_candidate_block.isna().all(axis=1)

    usable_frame = merged_daily_panel.loc[row_has_any_feature_observation]
    feature_only = usable_frame[selected_columns]
    targets_aligned = usable_frame["_target_next_close_log_forward_return"].astype(float)
    close_aligned = usable_frame["close"].astype(float)

    if feature_only.empty or targets_aligned.empty:
        return None

    anchor_forecast_day_index = feature_only.index.max()
    trimmed_close_through_forecast_anchor = close_aligned.loc[:anchor_forecast_day_index].dropna()
    if trimmed_close_through_forecast_anchor.empty:
        return None

    anchor_close_scalar = float(trimmed_close_through_forecast_anchor.iloc[-1])

    return TrainingFrameBuildResult(
        feature_frame=feature_only.astype(float),
        target_series=targets_aligned.astype(float),
        forecast_anchor_day=anchor_forecast_day_index,
        anchor_close_price=anchor_close_scalar,
    )


def build_latest_feature_row_for_inference(
    *,
    connection,
    schema_name: str,
    asset_id,
    ordered_feature_columns: list[str],
) -> pd.Series:
    """Align the freshest daily feature vector to columns stored with the persisted artifact."""

    long_frame = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if long_frame.empty:
        raise ValueError("No on-chain observations available for this asset")

    wide_on_chain = pivot_on_chain_daily(long_frame)
    if wide_on_chain.empty:
        raise ValueError("Could not pivot on-chain metrics for this asset")

    latest_row = wide_on_chain.sort_index().iloc[-1].reindex(ordered_feature_columns)
    latest_row.name = wide_on_chain.index.max()
    return latest_row.astype(float)


def resolve_reference_close_on_anchor_day_for_inference(
    *,
    connection,
    schema_name: str,
    asset_id,
    feature_anchor_day_marker,
    epsilon_floor: float = 1e-12,
) -> float:
    """
    Return ``market_data`` close observed on ``feature_anchor_day_marker`` UTC day boundary.

    When that exact stamp is missing among daily closes, reuse the nearest prior day's close.

    Raises ``ValueError`` when closes are unavailable entirely.
    """

    daily_close_series = load_market_daily_close_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    ).sort_index()
    if daily_close_series.empty:
        raise ValueError("No market OHLC closes available for this asset")

    normalized_anchor = pd.Timestamp(feature_anchor_day_marker).floor("D")
    trimmed_right = daily_close_series.loc[:normalized_anchor].dropna()
    if trimmed_right.empty:
        raise ValueError("Close price is unavailable on or before the latest on-chain calendar day")

    close_scalar_float = float(max(trimmed_right.iloc[-1], epsilon_floor))

    return close_scalar_float
