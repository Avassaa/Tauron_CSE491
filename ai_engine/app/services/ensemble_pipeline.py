"""Dedicated multi-step ensemble pipeline using transformed stationary features."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import VotingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from app.db.postgres_accessor import (
    load_market_data_daily_frame,
    load_on_chain_long_frame,
)
from app.services.feature_matrix_builder import (
    ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN,
    pivot_on_chain_daily,
)

try:
    from xgboost import XGBRegressor as _XGBRegressor

    _XGBOOST_AVAILABLE = True
except ImportError:
    _XGBOOST_AVAILABLE = False
    _XGBRegressor = None

_FLOW_IN_ALIASES = ("ocm_FlowInExNtv", "ocm_FlowInExUSD")
_FLOW_OUT_ALIASES = ("ocm_FlowOutExNtv", "ocm_FlowOutExUSD")
_MARKET_CAP_ALIASES = ("ocm_CapMrktCurUSD", "ocm_CapMrktEstUSD")
_REALIZED_CAP_ALIASES = ("ocm_CapRealUSD",)
_ACTIVE_ADDRESS_ALIASES = ("ocm_AdrActCnt", "ocm_AdrActCntNtv")
_FEE_ALIASES = ("ocm_FeeMeanUSD", "ocm_FeeMeanNtv")
_SPOT_VOLUME_ALIASES = ("ocm_TxTfrValAdjUSD", "ocm_TxTfrValUSD", "ocm_VolumeUSD")


def xgboost_package_import_succeeded_exclusive() -> bool:
    """Return whether xgboost is importable for ensemble_ocm training."""

    return _XGBOOST_AVAILABLE


def _pick_first_available_series_exclusive(
    frame_exclusive: pd.DataFrame,
    candidate_columns_exclusive: tuple[str, ...],
) -> pd.Series | None:
    """Return the first available numeric column from a candidate alias tuple."""

    for candidate_column_exclusive in candidate_columns_exclusive:
        if candidate_column_exclusive in frame_exclusive.columns:
            return frame_exclusive[candidate_column_exclusive].astype(float)
    return None


def _resolve_close_series_exclusive(
    wide_on_chain_exclusive: pd.DataFrame,
    market_daily_exclusive: pd.DataFrame,
) -> pd.Series:
    """Resolve raw close price from market_data, falling back to on-chain PriceUSD."""

    if not market_daily_exclusive.empty and "close" in market_daily_exclusive.columns:
        close_series_exclusive = market_daily_exclusive["close"].astype(float).sort_index()
        if close_series_exclusive.notna().any():
            return close_series_exclusive

    if ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN in wide_on_chain_exclusive.columns:
        return wide_on_chain_exclusive[ON_CHAIN_REFERENCE_USD_PRICE_WIDE_COLUMN].astype(float).sort_index()

    raise ValueError("Could not resolve close price series for ensemble feature construction.")


def _build_feature_matrix_exclusive(
    wide_on_chain_exclusive: pd.DataFrame,
    market_daily_exclusive: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """Create stationary transformed features required by the ensemble strategy."""

    close_series_exclusive = _resolve_close_series_exclusive(wide_on_chain_exclusive, market_daily_exclusive)
    features_exclusive = pd.DataFrame(index=close_series_exclusive.index)

    flow_in_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _FLOW_IN_ALIASES,
    )
    flow_out_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _FLOW_OUT_ALIASES,
    )
    if flow_in_series_exclusive is not None and flow_out_series_exclusive is not None:
        net_exchange_flow_exclusive = flow_in_series_exclusive - flow_out_series_exclusive
        features_exclusive["net_exchange_flow"] = net_exchange_flow_exclusive
        features_exclusive["net_exchange_flow_ma7"] = net_exchange_flow_exclusive.rolling(7, min_periods=3).mean()

    market_cap_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _MARKET_CAP_ALIASES,
    )
    realized_cap_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _REALIZED_CAP_ALIASES,
    )
    if market_cap_series_exclusive is not None and realized_cap_series_exclusive is not None:
        safe_realized_cap_exclusive = realized_cap_series_exclusive.clip(lower=1e-12)
        features_exclusive["mvrv_ratio"] = market_cap_series_exclusive / safe_realized_cap_exclusive

    spot_volume_series_exclusive: pd.Series | None = None
    if not market_daily_exclusive.empty and "volume" in market_daily_exclusive.columns:
        spot_volume_series_exclusive = market_daily_exclusive["volume"].astype(float).sort_index()
    if spot_volume_series_exclusive is None:
        spot_volume_series_exclusive = _pick_first_available_series_exclusive(
            wide_on_chain_exclusive,
            _SPOT_VOLUME_ALIASES,
        )
    if market_cap_series_exclusive is not None and spot_volume_series_exclusive is not None:
        safe_spot_volume_exclusive = spot_volume_series_exclusive.clip(lower=1e-12)
        features_exclusive["nvt_ratio"] = market_cap_series_exclusive / safe_spot_volume_exclusive

    active_address_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _ACTIVE_ADDRESS_ALIASES,
    )
    if active_address_series_exclusive is not None:
        safe_active_address_series_exclusive = active_address_series_exclusive.clip(lower=1e-12)
        features_exclusive["active_addresses_growth_14d"] = safe_active_address_series_exclusive.pct_change(periods=14)

    fee_series_exclusive = _pick_first_available_series_exclusive(
        wide_on_chain_exclusive,
        _FEE_ALIASES,
    )
    if fee_series_exclusive is not None:
        features_exclusive["average_transaction_fee"] = fee_series_exclusive

    close_return_exclusive = close_series_exclusive.pct_change()
    close_ma30_exclusive = close_series_exclusive.rolling(30, min_periods=15).mean().clip(lower=1e-12)
    features_exclusive["daily_volatility_14d"] = close_return_exclusive.rolling(14, min_periods=7).std()
    features_exclusive["distance_from_30d_ma"] = (close_series_exclusive / close_ma30_exclusive) - 1.0
    features_exclusive["momentum_7d"] = close_series_exclusive.pct_change(periods=7)
    features_exclusive["momentum_30d"] = close_series_exclusive.pct_change(periods=30)

    features_exclusive = features_exclusive.sort_index().replace([np.inf, -np.inf], np.nan)
    close_series_exclusive = close_series_exclusive.reindex(features_exclusive.index).clip(lower=1e-12)
    return features_exclusive, close_series_exclusive


def build_ensemble_feature_matrix_for_asset_exclusive(
    *,
    connection: Any,
    schema_name: str,
    asset_id: UUID,
) -> tuple[pd.DataFrame, pd.Series]:
    """Load on-chain and market history and produce transformed features plus close levels."""

    long_on_chain_exclusive = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )
    if long_on_chain_exclusive.empty:
        raise ValueError("No on-chain observations available for ensemble model training.")

    wide_on_chain_exclusive = pivot_on_chain_daily(long_on_chain_exclusive)
    if wide_on_chain_exclusive.empty:
        raise ValueError("Could not pivot on-chain metrics for ensemble model training.")

    market_daily_exclusive = load_market_data_daily_frame(
        connection=connection,
        schema_name=schema_name,
        asset_id=asset_id,
    )

    return _build_feature_matrix_exclusive(wide_on_chain_exclusive, market_daily_exclusive)


def _build_ensemble_regressor_pipeline_exclusive(feature_columns_exclusive: list[str]) -> Pipeline:
    """Assemble RobustScaler + Voting(Ridge, XGBoost) regression stack."""

    if not _XGBOOST_AVAILABLE:
        raise ValueError(
            "ensemble_ocm requires xgboost to be installed in the AI engine environment."
        )

    feature_transformer_exclusive = ColumnTransformer(
        transformers=[
            (
                "numeric_block",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median", add_indicator=False)),
                        ("scaler", RobustScaler(with_centering=True, with_scaling=True)),
                    ],
                ),
                feature_columns_exclusive,
            )
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    feature_transformer_exclusive.set_output(transform="pandas")

    ridge_regressor_exclusive = Ridge(alpha=8.0, fit_intercept=True)
    xgb_regressor_exclusive = _XGBRegressor(
        objective="reg:squarederror",
        n_estimators=320,
        learning_rate=0.05,
        max_depth=3,
        min_child_weight=4,
        subsample=0.9,
        colsample_bytree=0.8,
        reg_lambda=3.0,
        random_state=42,
        n_jobs=1,
    )
    ensemble_regressor_exclusive = VotingRegressor(
        estimators=[
            ("ridge_anchor", ridge_regressor_exclusive),
            ("xgb_engine", xgb_regressor_exclusive),
        ],
        weights=[0.45, 0.55],
    )

    return Pipeline(
        steps=[
            ("feature_preprocessor", feature_transformer_exclusive),
            ("estimator", ensemble_regressor_exclusive),
        ],
    )


@dataclass(frozen=True)
class EnsembleTrainingOutcome:
    """Persistable multi-horizon ensemble artifact and mapped prediction rows."""

    artifact_payload: dict[str, Any]
    prediction_rows: list[dict[str, Any]]
    training_rows_by_horizon: dict[str, int]
    residual_sigma_by_horizon: dict[str, float]
    mae_by_horizon: dict[str, float]
    forecast_anchor_day: pd.Timestamp
    forecast_anchor_close: float


def train_multi_step_ensemble_for_cutoff_exclusive(
    *,
    transformed_feature_frame_exclusive: pd.DataFrame,
    close_series_exclusive: pd.Series,
    asset_id: UUID,
    model_id: UUID,
    inclusive_cutoff_day_utc_exclusive: pd.Timestamp,
    horizon_days_exclusive: int,
    confidence_interval_z_score_exclusive: float,
    residual_sigma_floor_return_exclusive: float,
) -> EnsembleTrainingOutcome:
    """Fit one ensemble model per horizon on rows <= cutoff and emit mapped forecast rows."""

    feature_frame_sorted_exclusive = transformed_feature_frame_exclusive.sort_index().astype(float)
    close_sorted_exclusive = close_series_exclusive.reindex(feature_frame_sorted_exclusive.index).astype(float)

    if inclusive_cutoff_day_utc_exclusive.tzinfo is None:
        cutoff_day_exclusive = inclusive_cutoff_day_utc_exclusive.tz_localize("UTC").normalize()
    else:
        cutoff_day_exclusive = inclusive_cutoff_day_utc_exclusive.tz_convert("UTC").normalize()

    normalized_feature_days_exclusive = pd.DatetimeIndex(feature_frame_sorted_exclusive.index)
    if normalized_feature_days_exclusive.tz is None:
        normalized_feature_days_exclusive = normalized_feature_days_exclusive.tz_localize("UTC")
    else:
        normalized_feature_days_exclusive = normalized_feature_days_exclusive.tz_convert("UTC")
    normalized_feature_days_exclusive = normalized_feature_days_exclusive.normalize()

    eligible_mask_exclusive = normalized_feature_days_exclusive <= cutoff_day_exclusive
    if not bool(np.any(eligible_mask_exclusive)):
        raise ValueError("No transformed feature rows are available on or before the requested cutoff date.")

    eligible_feature_frame_exclusive = feature_frame_sorted_exclusive.loc[eligible_mask_exclusive]
    eligible_close_series_exclusive = close_sorted_exclusive.loc[eligible_feature_frame_exclusive.index].clip(lower=1e-12)
    usable_feature_mask_exclusive = ~eligible_feature_frame_exclusive.isna().all(axis=1)
    eligible_feature_frame_exclusive = eligible_feature_frame_exclusive.loc[usable_feature_mask_exclusive]
    eligible_close_series_exclusive = eligible_close_series_exclusive.loc[eligible_feature_frame_exclusive.index]

    if len(eligible_feature_frame_exclusive) < 60:
        raise ValueError("ensemble_ocm needs at least 60 cutoff-bounded rows after feature transformations.")

    anchor_day_exclusive = pd.Timestamp(eligible_feature_frame_exclusive.index.max())
    anchor_close_exclusive = float(eligible_close_series_exclusive.loc[anchor_day_exclusive])
    anchor_feature_row_exclusive = eligible_feature_frame_exclusive.loc[[anchor_day_exclusive]]

    feature_columns_exclusive = list(eligible_feature_frame_exclusive.columns)
    fitted_horizon_model_map_exclusive: dict[str, Any] = {}
    residual_sigma_by_horizon_exclusive: dict[str, float] = {}
    training_rows_by_horizon_exclusive: dict[str, int] = {}
    mae_by_horizon_exclusive: dict[str, float] = {}
    prediction_rows_exclusive: list[dict[str, Any]] = []

    for horizon_step_exclusive in range(1, horizon_days_exclusive + 1):
        cumulative_return_target_series_exclusive = (
            close_sorted_exclusive.shift(-horizon_step_exclusive) / close_sorted_exclusive
        ) - 1.0
        train_target_series_exclusive = cumulative_return_target_series_exclusive.reindex(
            eligible_feature_frame_exclusive.index
        )
        train_row_mask_exclusive = train_target_series_exclusive.notna()
        horizon_train_features_exclusive = eligible_feature_frame_exclusive.loc[train_row_mask_exclusive]
        horizon_train_targets_exclusive = train_target_series_exclusive.loc[train_row_mask_exclusive].astype(float)

        if len(horizon_train_features_exclusive) < 40:
            raise ValueError(
                f"ensemble_ocm horizon {horizon_step_exclusive} has only {len(horizon_train_features_exclusive)} rows."
            )

        horizon_pipeline_exclusive = _build_ensemble_regressor_pipeline_exclusive(feature_columns_exclusive)
        horizon_pipeline_exclusive.fit(horizon_train_features_exclusive, horizon_train_targets_exclusive.to_numpy(dtype=float))

        in_sample_predictions_exclusive = horizon_pipeline_exclusive.predict(horizon_train_features_exclusive).astype(float)
        in_sample_residuals_exclusive = horizon_train_targets_exclusive.to_numpy(dtype=float) - in_sample_predictions_exclusive
        residual_sigma_exclusive = float(np.sqrt(np.maximum(np.mean(np.square(in_sample_residuals_exclusive)), 1e-12)))
        residual_sigma_exclusive = max(residual_sigma_exclusive, residual_sigma_floor_return_exclusive)

        forecasted_return_exclusive = float(horizon_pipeline_exclusive.predict(anchor_feature_row_exclusive)[0])
        widening_half_width_exclusive = float(
            residual_sigma_exclusive
            * confidence_interval_z_score_exclusive
            * np.sqrt(float(horizon_step_exclusive))
        )
        forecast_return_high_exclusive = forecasted_return_exclusive + widening_half_width_exclusive
        forecast_return_low_exclusive = forecasted_return_exclusive - widening_half_width_exclusive

        predicted_level_mid_exclusive = float(max(anchor_close_exclusive * (1.0 + forecasted_return_exclusive), 1e-9))
        predicted_level_high_exclusive = float(max(anchor_close_exclusive * (1.0 + forecast_return_high_exclusive), 1e-9))
        predicted_level_low_exclusive = float(max(anchor_close_exclusive * (1.0 + forecast_return_low_exclusive), 1e-9))

        anchor_day_aware_exclusive = anchor_day_exclusive
        if anchor_day_aware_exclusive.tzinfo is None:
            anchor_day_aware_exclusive = anchor_day_aware_exclusive.tz_localize("UTC")
        else:
            anchor_day_aware_exclusive = anchor_day_aware_exclusive.tz_convert("UTC")

        forecast_time_exclusive = datetime(
            anchor_day_aware_exclusive.year,
            anchor_day_aware_exclusive.month,
            anchor_day_aware_exclusive.day,
            tzinfo=timezone.utc,
        ) + timedelta(days=horizon_step_exclusive)

        prediction_rows_exclusive.append(
            {
                "time": forecast_time_exclusive,
                "asset_id": asset_id,
                "model_id": model_id,
                "predicted_value": predicted_level_mid_exclusive,
                "confidence_interval_high": predicted_level_high_exclusive,
                "confidence_interval_low": predicted_level_low_exclusive,
                "horizon_step": horizon_step_exclusive,
            }
        )

        horizon_key_exclusive = str(horizon_step_exclusive)
        fitted_horizon_model_map_exclusive[horizon_key_exclusive] = horizon_pipeline_exclusive
        residual_sigma_by_horizon_exclusive[horizon_key_exclusive] = residual_sigma_exclusive
        training_rows_by_horizon_exclusive[horizon_key_exclusive] = int(len(horizon_train_features_exclusive))
        mae_by_horizon_exclusive[horizon_key_exclusive] = float(
            np.mean(np.abs(in_sample_residuals_exclusive))
        )

    artifact_payload_exclusive: dict[str, Any] = {
        "artifact_kind": "ensemble_multi_step",
        "model_type_slug": "ensemble_ocm",
        "feature_column_order": feature_columns_exclusive,
        "horizon_models": fitted_horizon_model_map_exclusive,
        "residual_sigma_by_horizon": residual_sigma_by_horizon_exclusive,
        "training_rows_by_horizon": training_rows_by_horizon_exclusive,
        "mae_by_horizon": mae_by_horizon_exclusive,
        "forecast_anchor_day_iso8601_utc": anchor_day_exclusive.isoformat(),
        "forecast_anchor_close_usd": anchor_close_exclusive,
        "forecast_horizon_days": int(horizon_days_exclusive),
        "confidence_interval_z_score": float(confidence_interval_z_score_exclusive),
        "residual_sigma_floor_return": float(residual_sigma_floor_return_exclusive),
    }

    return EnsembleTrainingOutcome(
        artifact_payload=artifact_payload_exclusive,
        prediction_rows=prediction_rows_exclusive,
        training_rows_by_horizon=training_rows_by_horizon_exclusive,
        residual_sigma_by_horizon=residual_sigma_by_horizon_exclusive,
        mae_by_horizon=mae_by_horizon_exclusive,
        forecast_anchor_day=anchor_day_exclusive,
        forecast_anchor_close=anchor_close_exclusive,
    )


def predict_one_step_from_ensemble_artifact_exclusive(
    *,
    artifact_payload_exclusive: dict[str, Any],
    latest_feature_row_exclusive: pd.Series,
    reference_close_usd_exclusive: float,
) -> dict[str, float]:
    """Infer one-step return and confidence bounds from a persisted ensemble artifact."""

    horizon_model_map_exclusive = artifact_payload_exclusive.get("horizon_models")
    if not isinstance(horizon_model_map_exclusive, dict) or "1" not in horizon_model_map_exclusive:
        raise ValueError("ensemble_ocm artifact does not contain a horizon-1 regressor.")

    feature_column_order_exclusive = list(artifact_payload_exclusive.get("feature_column_order") or [])
    if not feature_column_order_exclusive:
        raise ValueError("ensemble_ocm artifact is missing feature_column_order.")

    model_one_step_exclusive = horizon_model_map_exclusive["1"]
    one_row_frame_exclusive = (
        latest_feature_row_exclusive.reindex(feature_column_order_exclusive).astype(float).to_frame().T
    )
    predicted_return_exclusive = float(model_one_step_exclusive.predict(one_row_frame_exclusive)[0])

    residual_sigma_map_exclusive = artifact_payload_exclusive.get("residual_sigma_by_horizon") or {}
    sigma_one_step_exclusive = float(residual_sigma_map_exclusive.get("1", 0.02))
    z_score_exclusive = float(artifact_payload_exclusive.get("confidence_interval_z_score", 1.96))
    half_width_exclusive = sigma_one_step_exclusive * z_score_exclusive

    high_return_exclusive = predicted_return_exclusive + half_width_exclusive
    low_return_exclusive = predicted_return_exclusive - half_width_exclusive
    reference_close_positive_exclusive = max(float(reference_close_usd_exclusive), 1e-12)

    mid_price_exclusive = float(max(reference_close_positive_exclusive * (1.0 + predicted_return_exclusive), 1e-9))
    high_price_exclusive = float(max(reference_close_positive_exclusive * (1.0 + high_return_exclusive), 1e-9))
    low_price_exclusive = float(max(reference_close_positive_exclusive * (1.0 + low_return_exclusive), 1e-9))
    confidence_proxy_exclusive = float(np.clip(1.0 / (1.0 + abs(half_width_exclusive) * 8.0), 0.05, 0.995))

    return {
        "predicted_log_forward_return_one_day": float(np.log(max(mid_price_exclusive, 1e-12) / reference_close_positive_exclusive)),
        "predicted_next_close_mid": mid_price_exclusive,
        "predicted_next_close_high_ci": high_price_exclusive,
        "predicted_next_close_low_ci": low_price_exclusive,
        "prediction_confidence_proxy": confidence_proxy_exclusive,
        "reference_interval_log_forward_return_band": float(half_width_exclusive),
    }
