"""Build supervised learning frames from ``on_chain_metrics`` only.

The regression label is derived from Coin Metrics ``PriceUSD`` (daily) as forward log-return,
while Phase 0 still shifts native price-derived OCM columns one day inside the **feature**
matrix so settlement-day spot levels do not leak when ranking candidate columns prior to masking.

Temporal augmentation applies lag and rolling z-score windows that only consume past days.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd

from app.db.postgres_accessor import load_on_chain_long_frame

_PRICE_DERIVED_PATTERN = re.compile(
    r"^ocm_(PriceUSD|PriceBTC|ReferenceRate|ReferenceRateUSD|ReferenceRateBTC|"
    r"ReferenceRateETH|ReferenceRateEUR|ROI1yr|ROI30d)$",
    re.IGNORECASE,
)


def _is_price_derived(column_name: str) -> bool:
    """Return True for OCM columns whose values are calculated from market price."""
    return bool(_PRICE_DERIVED_PATTERN.match(column_name))


def _sanitize_metric_column_name(raw_metric_name: str) -> str:
    """Map an arbitrary metric label to a stable column name for sklearn."""
    cleaned = re.sub(r"[^0-9A-Za-z]+", "_", raw_metric_name.strip())
    cleaned = cleaned.strip("_") or "metric"
    return f"ocm_{cleaned[:120]}"


ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN = _sanitize_metric_column_name("PriceUSD")


@dataclass(frozen=True)
class TrainingFrameBuildResult:
    """Outcome of assembling a single-asset matrix: chain features plus PriceUSD-aligned targets."""

    feature_frame: pd.DataFrame
    target_series: pd.Series
    forecast_anchor_day: pd.Timestamp
    anchor_close_price: float
    closes_aligned: pd.Series


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


def _shift_price_derived_columns_one_day(wide_frame: pd.DataFrame) -> pd.DataFrame:
    """
    Shift all price-derived OCM columns by one day so they appear as t-1 values.

    The original same-day columns are replaced with their lagged counterparts to
    prevent data leakage: the model would otherwise see today's PriceUSD (which
    embeds today's close) while predicting tomorrow's return.
    """
    price_cols = [col for col in wide_frame.columns if _is_price_derived(col)]
    if not price_cols:
        return wide_frame

    result = wide_frame.copy()
    for col in price_cols:
        result[col] = result[col].shift(1)
    return result


def _build_lag_columns(
    wide_frame: pd.DataFrame,
    base_columns: Sequence[str],
    lag_steps: Sequence[int],
) -> pd.DataFrame:
    """
    Append lag-k copies of ``base_columns`` to ``wide_frame``.

    Columns are named ``{original_col}_lag{k}``.
    """
    lag_parts: list[pd.DataFrame] = []
    for lag_k in lag_steps:
        shifted = wide_frame[list(base_columns)].shift(lag_k)
        shifted.columns = [f"{col}_lag{lag_k}" for col in shifted.columns]
        lag_parts.append(shifted)
    if not lag_parts:
        return wide_frame
    return pd.concat([wide_frame, *lag_parts], axis=1)


def _build_rolling_zscore_columns(
    wide_frame: pd.DataFrame,
    base_columns: Sequence[str],
    window: int = 14,
) -> pd.DataFrame:
    """
    Append 14-day rolling z-score columns for ``base_columns``.

    Rolling statistics use only past data (min_periods=window//2) so there is no look-ahead.
    """
    zscore_parts: list[pd.DataFrame] = []
    for col in base_columns:
        series = wide_frame[col].astype(float)
        rolling_mean = series.rolling(window=window, min_periods=window // 2).mean()
        rolling_std = series.rolling(window=window, min_periods=window // 2).std().clip(lower=1e-12)
        zscore = (series - rolling_mean) / rolling_std
        zscore.name = f"{col}_zs{window}d"
        zscore_parts.append(zscore)
    if not zscore_parts:
        return wide_frame
    return pd.concat([wide_frame, *zscore_parts], axis=1)


def _append_derived_ratio_columns(wide_frame: pd.DataFrame) -> pd.DataFrame:
    """
    Append well-known on-chain ratio signals when the source columns are present.

    NVT proxy: CapMrktCurUSD / TxTfrCnt   — high when price outpaces activity.
    Net exchange flow: FlowInExNtv - FlowOutExNtv  — negative = coins leaving exchanges (bullish).
    Supply velocity: TxTfrCnt / SplyCur    — how actively the supply is turning over.
    """
    result = wide_frame.copy()

    cap_col = "ocm_CapMrktCurUSD"
    tx_col = "ocm_TxTfrCnt"
    flow_in_col = "ocm_FlowInExNtv"
    flow_out_col = "ocm_FlowOutExNtv"
    sply_col = "ocm_SplyCur"

    if cap_col in result.columns and tx_col in result.columns:
        safe_tx = result[tx_col].clip(lower=1.0)
        result["ocm_derived_nvt_proxy"] = result[cap_col] / safe_tx

    if flow_in_col in result.columns and flow_out_col in result.columns:
        result["ocm_derived_net_exchange_flow"] = result[flow_in_col] - result[flow_out_col]

    if tx_col in result.columns and sply_col in result.columns:
        safe_sply = result[sply_col].clip(lower=1.0)
        result["ocm_derived_supply_velocity"] = result[tx_col] / safe_sply

    return result


def augment_with_temporal_features(
    wide_frame: pd.DataFrame,
    base_columns: Sequence[str],
) -> pd.DataFrame:
    """
    Enrich a wide daily on-chain matrix with temporal and ratio features.

    Steps applied in order:
    1. Derived on-chain ratios (NVT, net exchange flow, supply velocity).
    2. Lag-1, lag-7, lag-30 copies of all base columns.
    3. 14-day rolling z-score for all base columns.

    The column cap is applied by the caller *after* this function so temporal columns compete
    fairly in the variance-ranking.
    """
    enriched = _append_derived_ratio_columns(wide_frame)

    all_base = list(base_columns)
    enriched = _build_lag_columns(enriched, all_base, lag_steps=[1, 7, 30])
    enriched = _build_rolling_zscore_columns(enriched, all_base, window=14)

    return enriched


def capped_metric_columns_from_wide(wide_matrix: pd.DataFrame, *, column_cap: int) -> list[str]:
    """Rank wide columns by variance density and truncate to ``column_cap``."""
    available_columns = list(wide_matrix.columns)
    if not available_columns:
        return []
    return select_top_variance_metrics(wide_matrix, available_columns, maximum_columns=column_cap)


def _finalize_shifted_augmented_capped_wide_matrix(
    wide_raw_exclusive: pd.DataFrame,
    column_cap_exclusive: int,
) -> tuple[pd.DataFrame, list[str]]:
    """Apply leakage-conscious shifts, augmentation, variance cap, returning training features."""
    if wide_raw_exclusive.empty:
        return pd.DataFrame(), []

    shifted_exclusive = _shift_price_derived_columns_one_day(wide_raw_exclusive.copy())
    base_columns_exclusive = list(shifted_exclusive.columns)
    augmented_exclusive = augment_with_temporal_features(shifted_exclusive, base_columns_exclusive)
    ranked_exclusive = capped_metric_columns_from_wide(
        augmented_exclusive,
        column_cap=column_cap_exclusive,
    )
    if not ranked_exclusive:
        return pd.DataFrame(), []
    trimmed_exclusive = augmented_exclusive[ranked_exclusive].sort_index()
    return trimmed_exclusive, ranked_exclusive


def wide_on_chain_from_long(long_frame: pd.DataFrame, *, column_cap: int) -> tuple[pd.DataFrame, list[str]]:
    """
    Return capped wide dataframe for training plus chosen column names after pivot augmentation.

    The leakage fix (price-derived columns shifted by 1 day) and temporal augmentation are applied
    so every caller automatically gets the corrected feature matrix.
    """
    wide_raw_exclusive = pivot_on_chain_daily(long_frame)
    return _finalize_shifted_augmented_capped_wide_matrix(wide_raw_exclusive, column_cap)


def build_training_frame_for_asset(
    *,
    connection,
    schema_name: str,
    asset_id,
    column_cap: int,
) -> TrainingFrameBuildResult | None:
    """
    Align capped on-chain pivots with daily ``PriceUSD`` reference levels from the same table.

    The regression target is ``log(price[t+1]) - log(price[t])`` where ``price`` is the raw
    (unshifted) ``PriceUSD`` series from the pivot prior to feature leakage handling.
    """

    on_chain_long = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if on_chain_long.empty:
        return None

    wide_raw_exclusive = pivot_on_chain_daily(on_chain_long)
    if wide_raw_exclusive.empty:
        return None

    if ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN not in wide_raw_exclusive.columns:
        return None

    reference_price_series_exclusive = (
        wide_raw_exclusive[ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN].astype(float).sort_index().clip(lower=1e-12)
    )

    trimmed_daily_wide_exclusive, selected_columns_exclusive = _finalize_shifted_augmented_capped_wide_matrix(
        wide_raw_exclusive,
        column_cap,
    )
    if trimmed_daily_wide_exclusive.empty or not selected_columns_exclusive:
        return None

    price_frame_exclusive = reference_price_series_exclusive.rename("close").to_frame()
    price_frame_exclusive["log_close"] = np.log(price_frame_exclusive["close"].astype(float).clip(lower=1e-12))
    price_frame_exclusive["_target_next_close_log_forward_return"] = (
        price_frame_exclusive["log_close"].shift(-1) - price_frame_exclusive["log_close"]
    )

    merged_daily_panel_exclusive = trimmed_daily_wide_exclusive.join(
        price_frame_exclusive[["close", "_target_next_close_log_forward_return"]],
        how="inner",
    )
    merged_daily_panel_exclusive = merged_daily_panel_exclusive.replace([np.inf, -np.inf], np.nan)
    merged_daily_panel_exclusive = merged_daily_panel_exclusive.dropna(
        subset=["_target_next_close_log_forward_return"],
    )

    feature_candidate_block_exclusive = merged_daily_panel_exclusive[selected_columns_exclusive]
    row_has_any_feature_observation_exclusive = ~feature_candidate_block_exclusive.isna().all(axis=1)

    usable_frame_exclusive = merged_daily_panel_exclusive.loc[row_has_any_feature_observation_exclusive]
    feature_only_exclusive = usable_frame_exclusive[selected_columns_exclusive]
    targets_aligned_exclusive = usable_frame_exclusive["_target_next_close_log_forward_return"].astype(float)
    close_aligned_exclusive = usable_frame_exclusive["close"].astype(float)

    if feature_only_exclusive.empty or targets_aligned_exclusive.empty:
        return None

    anchor_forecast_day_index_exclusive = feature_only_exclusive.index.max()
    trimmed_close_through_forecast_anchor_exclusive = close_aligned_exclusive.loc[
        :anchor_forecast_day_index_exclusive
    ].dropna()
    if trimmed_close_through_forecast_anchor_exclusive.empty:
        return None

    anchor_close_scalar_exclusive = float(trimmed_close_through_forecast_anchor_exclusive.iloc[-1])

    return TrainingFrameBuildResult(
        feature_frame=feature_only_exclusive.astype(float),
        target_series=targets_aligned_exclusive.astype(float),
        forecast_anchor_day=anchor_forecast_day_index_exclusive,
        anchor_close_price=anchor_close_scalar_exclusive,
        closes_aligned=close_aligned_exclusive.astype(float),
    )


def build_latest_feature_row_for_inference(
    *,
    connection,
    schema_name: str,
    asset_id,
    ordered_feature_columns: list[str],
) -> pd.Series:
    """Align the freshest daily feature vector to columns stored with the persisted artifact.

    Applies the same leakage fix and augmentation as training so inference features are consistent.
    """

    long_frame = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if long_frame.empty:
        raise ValueError("No on-chain observations available for this asset")

    wide_on_chain_exclusive = pivot_on_chain_daily(long_frame)
    if wide_on_chain_exclusive.empty:
        raise ValueError("Could not pivot on-chain metrics for this asset")

    wide_on_chain_exclusive = _shift_price_derived_columns_one_day(wide_on_chain_exclusive)
    base_cols_exclusive = list(wide_on_chain_exclusive.columns)
    wide_on_chain_exclusive = augment_with_temporal_features(wide_on_chain_exclusive, base_cols_exclusive)

    latest_row_exclusive = wide_on_chain_exclusive.sort_index().iloc[-1].reindex(ordered_feature_columns)
    latest_row_exclusive.name = wide_on_chain_exclusive.index.max()
    return latest_row_exclusive.astype(float)


def resolve_reference_close_on_anchor_day_for_inference(
    *,
    connection,
    schema_name: str,
    asset_id,
    feature_anchor_day_marker,
    epsilon_floor: float = 1e-12,
) -> float:
    """
    Return raw ``PriceUSD`` on the UTC calendar anchor (or nearest prior day available).

    Raises ``ValueError`` when the reference series cannot be reconstructed from on-chain snapshots.
    """

    long_frame_exclusive = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if long_frame_exclusive.empty:
        raise ValueError("No on-chain observations available for this asset")

    wide_raw_exclusive = pivot_on_chain_daily(long_frame_exclusive)
    if wide_raw_exclusive.empty or ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN not in wide_raw_exclusive.columns:
        raise ValueError("PriceUSD metric is unavailable for this asset inside on-chain history")

    reference_series_exclusive = (
        wide_raw_exclusive[ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN].astype(float).sort_index()
    )

    normalized_anchor_exclusive = pd.Timestamp(feature_anchor_day_marker).floor("D")
    trimmed_right_exclusive = reference_series_exclusive.loc[:normalized_anchor_exclusive].dropna()
    if trimmed_right_exclusive.empty:
        raise ValueError("PriceUSD observation is unavailable on or before the latest on-chain anchor day")

    close_scalar_float_exclusive = float(max(trimmed_right_exclusive.iloc[-1], epsilon_floor))

    return close_scalar_float_exclusive
