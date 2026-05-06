"""Estimator construction and supervised evaluation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline


def _numeric_column_indexes(feature_labels: list[str]) -> tuple[str, SimpleImputer]:
    """Build a transformer pair for scikit-learn column binding."""
    transformer = SimpleImputer(strategy="median", add_indicator=False)
    return ("numeric_block", transformer, feature_labels)


def build_supervised_pipeline(feature_column_labels: list[str]) -> Pipeline:
    """
    Produce a HistGradientBoostingRegressor fitted on median-imputed numeric columns.

    Column order is fixed by ``feature_column_labels`` so inference can rehydrate rows.
    """
    column_transformer = ColumnTransformer(
        transformers=[_numeric_column_indexes(feature_column_labels)],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    column_transformer.set_output(transform="pandas")

    gradient_booster = HistGradientBoostingRegressor(
        learning_rate=0.06,
        max_depth=8,
        max_iter=300,
        min_samples_leaf=20,
        l2_regularization=1e-3,
        random_state=42,
    )

    return Pipeline(
        steps=[
            ("feature_preprocessor", column_transformer),
            ("gradient_booster", gradient_booster),
        ],
    )


@dataclass(frozen=True)
class TimeOrderedSplitResult:
    """Train and validation slices for chronological evaluation."""

    training_frame: pd.DataFrame
    training_targets: pd.Series
    validation_frame: pd.DataFrame
    validation_targets: pd.Series


def chronological_fractional_split(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    *,
    validation_fraction: float,
) -> TimeOrderedSplitResult:
    """Split on sorted time index reserving the trailing fraction for validation."""
    merged_index = feature_frame.index.intersection(target_series.index)
    feature_sorted = feature_frame.loc[merged_index].sort_index()
    target_sorted = target_series.loc[merged_index].sort_index()
    row_count = len(feature_sorted)
    if row_count < 3:
        raise ValueError("Insufficient rows for chronological split")

    validation_rows = max(1, int(row_count * validation_fraction))
    split_candidate = row_count - validation_rows
    split_point = max(8, split_candidate)
    split_point = min(split_point, row_count - max(validation_rows, 1))
    if split_point >= row_count - 2:
        split_point = max(1, int(row_count * 0.82))

    training_frame = feature_sorted.iloc[:split_point]
    training_targets = target_sorted.iloc[:split_point]
    validation_frame = feature_sorted.iloc[split_point:]
    validation_targets = target_sorted.iloc[split_point:]

    return TimeOrderedSplitResult(
        training_frame=training_frame,
        training_targets=training_targets,
        validation_frame=validation_frame,
        validation_targets=validation_targets,
    )


@dataclass(frozen=True)
class FittedEstimatorBundle:
    """Everything required to replay predictions outside the trainer process."""

    pipeline: Pipeline
    feature_column_order: list[str]
    training_observation_rows: int
    validation_absolute_error_mean: float
    residual_standard_error: float
    anchor_metric_column_key: str = ""
    target_signal_slug: str = ""


def train_estimator_bundle(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    *,
    validation_fraction: float = 0.15,
) -> FittedEstimatorBundle:
    """Fit pipeline, summarize validation residuals, return a persistable wrapper."""
    splits = chronological_fractional_split(
        feature_frame,
        target_series,
        validation_fraction=validation_fraction,
    )
    column_order = list(feature_frame.columns)
    pipeline_instance = build_supervised_pipeline(column_order)
    pipeline_instance.fit(splits.training_frame, splits.training_targets.to_numpy(dtype=float))

    validation_predictions = pipeline_instance.predict(splits.validation_frame).astype(float)
    validation_targets_numpy = splits.validation_targets.to_numpy(dtype=float)
    residual_vector = validation_targets_numpy - validation_predictions

    residual_standard_error = float(np.sqrt(np.maximum(np.mean(np.square(residual_vector)), 1e-12)))
    validation_mae = float(np.mean(np.abs(residual_vector)))

    return FittedEstimatorBundle(
        pipeline=pipeline_instance,
        feature_column_order=column_order,
        training_observation_rows=int(len(splits.training_frame)),
        validation_absolute_error_mean=validation_mae,
        residual_standard_error=residual_standard_error,
    )


def bundle_to_joblib_dict(bundle: FittedEstimatorBundle) -> dict[str, Any]:
    """Serialize as a plain dict for joblib without custom pickler dependency."""
    return {
        "pipeline": bundle.pipeline,
        "feature_column_order": bundle.feature_column_order,
        "training_observation_rows": bundle.training_observation_rows,
        "validation_absolute_error_mean": bundle.validation_absolute_error_mean,
        "residual_standard_error": bundle.residual_standard_error,
        "anchor_metric_column_key": bundle.anchor_metric_column_key,
        "target_signal_slug": bundle.target_signal_slug,
    }


def revive_bundle_from_disk(payload: dict[str, Any]) -> FittedEstimatorBundle:
    """Reconstruct estimator bundle emitted by ``bundle_to_joblib_dict``."""
    return FittedEstimatorBundle(
        pipeline=payload["pipeline"],
        feature_column_order=list(payload["feature_column_order"]),
        training_observation_rows=int(payload["training_observation_rows"]),
        validation_absolute_error_mean=float(payload["validation_absolute_error_mean"]),
        residual_standard_error=float(payload["residual_standard_error"]),
        anchor_metric_column_key=str(payload.get("anchor_metric_column_key", "")),
        target_signal_slug=str(payload.get("target_signal_slug", "")),
    )
