"""Estimator construction, TimeSeriesSplit cross-validation, and model factory helpers.

Phase 2: Single 85/15 split replaced with ``sklearn.model_selection.TimeSeriesSplit`` (5 folds).
         Mean and std MAE across folds are stored in the training metrics document.

Phase 3: ``build_supervised_pipeline`` now accepts a ``model_type_slug`` and dispatches to the
         appropriate estimator via ``_build_estimator``. Available slugs:

         hgb_ocm   — HistGradientBoostingRegressor  (default, native NaN, fast)
         ridge_ocm — Ridge + StandardScaler          (linear baseline, fastest)
         rf_ocm    — RandomForestRegressor           (bagged, good feature importance)
         et_ocm    — ExtraTreesRegressor             (more random than RF, wide cols)
         lgbm_ocm  — LGBMRegressor                  (guarded import, GPU-capable)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesRegressor,
    HistGradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from lightgbm import LGBMRegressor as _LGBMRegressor

    _LGBM_AVAILABLE = True
except (ImportError, OSError):
    _LGBM_AVAILABLE = False
    _LGBMRegressor = None


def lightgbm_package_import_succeeded_exclusive() -> bool:
    """Whether optional LightGBM wheels are importable (required for lgbm_ocm)."""

    return _LGBM_AVAILABLE

_SUPPORTED_SKLEARN_SLUGS = frozenset({"hgb_ocm", "ridge_ocm", "rf_ocm", "et_ocm", "lgbm_ocm"})
_TIME_SERIES_CV_FOLDS = 5


def _trainer_reserved_sklearn_bundle_keys_exclusive() -> frozenset[str]:
    """Keys consumed by the training orchestration instead of ``estimator.set_params``."""
    return frozenset({"time_series_cv_folds"})


def partition_trainer_hyperparameters_for_sklearn_exclusive(
    raw_mapping_exclusive: Mapping[str, Any] | None,
) -> tuple[dict[str, Any], int]:
    """Split user payload into estimator kwargs and TimeSeriesSplit fold count."""

    fold_default_exclusive = _TIME_SERIES_CV_FOLDS
    if not raw_mapping_exclusive:
        return {}, fold_default_exclusive

    mutable_copy_exclusive = dict(raw_mapping_exclusive)
    extracted_fold_exclusive = mutable_copy_exclusive.pop("time_series_cv_folds", None)
    fold_count_exclusive = fold_default_exclusive
    if extracted_fold_exclusive is not None:
        try:
            parsed_fold_exclusive = int(extracted_fold_exclusive)
            fold_count_exclusive = max(2, min(12, parsed_fold_exclusive))
        except (TypeError, ValueError):
            fold_count_exclusive = fold_default_exclusive

    estimator_payload_exclusive: dict[str, Any] = {}
    for key_piece_exclusive, value_piece_exclusive in mutable_copy_exclusive.items():
        if key_piece_exclusive in _trainer_reserved_sklearn_bundle_keys_exclusive():
            continue
        estimator_payload_exclusive[str(key_piece_exclusive)] = value_piece_exclusive

    return estimator_payload_exclusive, fold_count_exclusive


def partition_trainer_hyperparameters_for_lstm_exclusive(
    raw_mapping_exclusive: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Return kwargs accepted by ``train_lstm_for_asset`` from a trainer payload."""

    allowed_literal_keys_exclusive = frozenset({
        "lookback_window",
        "hidden_size",
        "num_layers",
        "dropout",
        "learning_rate",
        "max_epochs",
        "patience",
    })
    if not raw_mapping_exclusive:
        return {}

    resolved_kwargs_exclusive: dict[str, Any] = {}
    for literal_key_exclusive, literal_value_exclusive in raw_mapping_exclusive.items():
        if literal_key_exclusive not in allowed_literal_keys_exclusive:
            continue
        if literal_key_exclusive in {"lookback_window", "hidden_size", "num_layers", "max_epochs", "patience"}:
            try:
                resolved_kwargs_exclusive[literal_key_exclusive] = int(literal_value_exclusive)
            except (TypeError, ValueError):
                continue
        elif literal_key_exclusive in {"learning_rate", "dropout"}:
            try:
                resolved_kwargs_exclusive[literal_key_exclusive] = float(literal_value_exclusive)
            except (TypeError, ValueError):
                continue

    return resolved_kwargs_exclusive


def _apply_optional_estimator_hyperparameters_exclusive(
    pipeline_piece_exclusive: Pipeline,
    candidate_payload_exclusive: dict[str, Any],
) -> dict[str, Any]:
    """Apply sklearn ``set_params`` for recognised estimator keys; return the accepted subset."""

    if not candidate_payload_exclusive:
        return {}
    estimator_step_exclusive = pipeline_piece_exclusive.named_steps.get("estimator")
    if estimator_step_exclusive is None:
        return {}

    permissible_keys_exclusive = estimator_step_exclusive.get_params(deep=False)
    forwarded_literal_dictionary_exclusive: dict[str, Any] = {}
    accepted_mirror_exclusive: dict[str, Any] = {}
    for candidate_key_exclusive, candidate_value_exclusive in candidate_payload_exclusive.items():
        if candidate_key_exclusive in permissible_keys_exclusive:
            forwarded_literal_dictionary_exclusive[candidate_key_exclusive] = candidate_value_exclusive
            accepted_mirror_exclusive[candidate_key_exclusive] = candidate_value_exclusive

    if forwarded_literal_dictionary_exclusive:
        estimator_step_exclusive.set_params(**forwarded_literal_dictionary_exclusive)

    return accepted_mirror_exclusive


def _build_estimator(model_type_slug: str) -> Any:
    """
    Return an unfitted sklearn-compatible estimator for the given slug.

    Raises ``ValueError`` for unknown slugs or slugs whose optional dependency
    is not installed.
    """
    if model_type_slug == "hgb_ocm":
        return HistGradientBoostingRegressor(
            learning_rate=0.06,
            max_depth=8,
            max_iter=300,
            min_samples_leaf=20,
            l2_regularization=1e-3,
            random_state=42,
        )

    if model_type_slug == "ridge_ocm":
        return Ridge(alpha=10.0, fit_intercept=True)

    if model_type_slug == "rf_ocm":
        return RandomForestRegressor(
            n_estimators=300,
            max_features=0.4,
            min_samples_leaf=10,
            n_jobs=-1,
            random_state=42,
        )

    if model_type_slug == "et_ocm":
        return ExtraTreesRegressor(
            n_estimators=300,
            max_features=0.4,
            min_samples_leaf=10,
            n_jobs=-1,
            random_state=42,
        )

    if model_type_slug == "lgbm_ocm":
        if not _LGBM_AVAILABLE:
            raise ValueError(
                "lgbm_ocm requires lightgbm>=4.0 and a working OpenMP runtime (e.g. libgomp1 on Debian). "
                "Install dependencies or choose a different model_type_slug."
            )
        return _LGBMRegressor(
            n_estimators=500,
            learning_rate=0.05,
            num_leaves=63,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.6,
            random_state=42,
            verbose=-1,
        )

    raise ValueError(
        f"Unknown model_type_slug '{model_type_slug}'. "
        f"Supported slugs: {sorted(_SUPPORTED_SKLEARN_SLUGS)}"
    )


def _build_column_transformer(feature_column_labels: list[str], *, add_scaler: bool) -> ColumnTransformer:
    """
    Build a ColumnTransformer that median-imputes and optionally standard-scales features.

    Tree-based models do not need scaling; Ridge needs it for comparable L2 penalty.
    """
    if add_scaler:
        transformer = Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="median", add_indicator=False)),
            ("scaler", StandardScaler()),
        ])
    else:
        transformer = SimpleImputer(strategy="median", add_indicator=False)

    column_transformer = ColumnTransformer(
        transformers=[("numeric_block", transformer, feature_column_labels)],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    column_transformer.set_output(transform="pandas")
    return column_transformer


def build_supervised_pipeline(
    feature_column_labels: list[str],
    model_type_slug: str = "hgb_ocm",
    *,
    estimator_param_overrides_exclusive: Mapping[str, Any] | None = None,
) -> Pipeline:
    """
    Produce a fitted-ready Pipeline for the given model slug.

    Column order is fixed by ``feature_column_labels`` so inference can rehydrate rows.
    Ridge regression uses StandardScaler; tree-based models use median imputation only.

    Estimator overrides must use parameter names recognised by sklearn ``set_params`` on that slug.
    """
    needs_scaling = model_type_slug == "ridge_ocm"
    column_transformer = _build_column_transformer(feature_column_labels, add_scaler=needs_scaling)
    estimator = _build_estimator(model_type_slug)

    assembled_pipeline_exclusive = Pipeline(
        steps=[
            ("feature_preprocessor", column_transformer),
            ("estimator", estimator),
        ],
    )
    if estimator_param_overrides_exclusive:
        _apply_optional_estimator_hyperparameters_exclusive(
            assembled_pipeline_exclusive,
            dict(estimator_param_overrides_exclusive),
        )
    return assembled_pipeline_exclusive


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
    """Split on sorted time index reserving the trailing fraction for validation.

    Retained for backwards-compatible callers that do not need full CV.
    """
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
class CrossValidationSummary:
    """Aggregated TimeSeriesSplit results across all folds."""

    fold_mae_values: list[float]
    mean_mae: float
    std_mae: float
    final_fold_mae: float
    final_fold_residual_sigma: float


def time_series_cross_validate(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    *,
    model_type_slug: str,
    n_splits: int = _TIME_SERIES_CV_FOLDS,
    estimator_param_overrides_exclusive: Mapping[str, Any] | None = None,
) -> CrossValidationSummary:
    """
    Evaluate model quality using ``TimeSeriesSplit`` cross-validation.

    Each fold trains on all past data and validates on the next forward window.
    The final fold's residual sigma is returned for downstream confidence-interval
    calibration. Mean and std MAE across folds provide a robust generalisation signal.

    Minimum fold validation size is enforced to avoid degenerate single-row folds.
    """
    merged_index = feature_frame.index.intersection(target_series.index)
    feature_sorted = feature_frame.loc[merged_index].sort_index()
    target_sorted = target_series.loc[merged_index].sort_index()

    total_rows = len(feature_sorted)
    if total_rows < n_splits * 2 + 10:
        raise ValueError(
            f"Insufficient rows ({total_rows}) for {n_splits}-fold TimeSeriesSplit. "
            f"Need at least {n_splits * 2 + 10}."
        )

    feature_numpy = feature_sorted.values
    target_numpy = target_sorted.values

    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_mae_values: list[float] = []
    last_fold_residuals: np.ndarray = np.array([0.0])

    for train_idx, val_idx in tscv.split(feature_numpy):
        if len(train_idx) < 10 or len(val_idx) < 3:
            continue

        train_features_fold = feature_sorted.iloc[train_idx]
        val_features_fold = feature_sorted.iloc[val_idx]
        train_targets_fold = target_sorted.iloc[train_idx]
        val_targets_fold = target_sorted.iloc[val_idx]

        pipeline_fold = build_supervised_pipeline(
            list(feature_sorted.columns),
            model_type_slug=model_type_slug,
            estimator_param_overrides_exclusive=estimator_param_overrides_exclusive,
        )
        pipeline_fold.fit(train_features_fold, train_targets_fold.to_numpy(dtype=float))

        fold_predictions = pipeline_fold.predict(val_features_fold).astype(float)
        fold_residuals = val_targets_fold.to_numpy(dtype=float) - fold_predictions

        fold_mae = float(np.mean(np.abs(fold_residuals)))
        fold_mae_values.append(fold_mae)
        last_fold_residuals = fold_residuals

    if not fold_mae_values:
        raise ValueError("No valid CV folds produced; check data volume and n_splits setting.")

    final_fold_residual_sigma = float(
        np.sqrt(np.maximum(np.mean(np.square(last_fold_residuals)), 1e-12))
    )

    return CrossValidationSummary(
        fold_mae_values=fold_mae_values,
        mean_mae=float(np.mean(fold_mae_values)),
        std_mae=float(np.std(fold_mae_values, ddof=0)),
        final_fold_mae=fold_mae_values[-1],
        final_fold_residual_sigma=final_fold_residual_sigma,
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
    model_type_slug: str = "hgb_ocm"
    cv_fold_mae_values: list[float] | None = None
    cv_mean_mae: float | None = None
    cv_std_mae: float | None = None


def train_estimator_bundle(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    *,
    model_type_slug: str = "hgb_ocm",
    n_cv_splits: int = _TIME_SERIES_CV_FOLDS,
    estimator_param_overrides_exclusive: Mapping[str, Any] | None = None,
) -> FittedEstimatorBundle:
    """
    Run TimeSeriesSplit CV, fit final model on all data, return a persistable wrapper.

    Cross-validation runs first to compute generalisation metrics (mean/std MAE across folds,
    final-fold residual sigma for confidence-interval calibration). The final pipeline is then
    fitted on the *full* dataset so inference uses maximum available history.
    """
    column_order = list(feature_frame.columns)

    effective_cv_fold_count_exclusive = max(2, min(12, int(n_cv_splits)))

    cv_summary = time_series_cross_validate(
        feature_frame,
        target_series,
        model_type_slug=model_type_slug,
        n_splits=effective_cv_fold_count_exclusive,
        estimator_param_overrides_exclusive=estimator_param_overrides_exclusive,
    )

    final_pipeline = build_supervised_pipeline(
        column_order,
        model_type_slug=model_type_slug,
        estimator_param_overrides_exclusive=estimator_param_overrides_exclusive,
    )
    final_pipeline.fit(feature_frame, target_series.to_numpy(dtype=float))

    return FittedEstimatorBundle(
        pipeline=final_pipeline,
        feature_column_order=column_order,
        training_observation_rows=int(len(feature_frame)),
        validation_absolute_error_mean=cv_summary.final_fold_mae,
        residual_standard_error=cv_summary.final_fold_residual_sigma,
        model_type_slug=model_type_slug,
        cv_fold_mae_values=cv_summary.fold_mae_values,
        cv_mean_mae=cv_summary.mean_mae,
        cv_std_mae=cv_summary.std_mae,
    )


def snapshot_matching_estimator_params_exclusive(
    pipeline_exclusive: Pipeline,
    candidate_dictionary_exclusive: Mapping[str, Any],
) -> dict[str, Any]:
    """Return the estimator parameter values for keys the user attempted to tune."""

    if not candidate_dictionary_exclusive:
        return {}
    estimator_step_exclusive = pipeline_exclusive.named_steps.get("estimator")
    if estimator_step_exclusive is None:
        return {}
    authoritative_dictionary_exclusive = estimator_step_exclusive.get_params(deep=False)
    mirrored_snapshot_exclusive: dict[str, Any] = {}
    for key_literal_exclusive in candidate_dictionary_exclusive:
        if key_literal_exclusive in authoritative_dictionary_exclusive:
            mirrored_snapshot_exclusive[key_literal_exclusive] = authoritative_dictionary_exclusive[key_literal_exclusive]
    return mirrored_snapshot_exclusive


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
        "model_type_slug": bundle.model_type_slug,
        "cv_fold_mae_values": bundle.cv_fold_mae_values,
        "cv_mean_mae": bundle.cv_mean_mae,
        "cv_std_mae": bundle.cv_std_mae,
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
        model_type_slug=str(payload.get("model_type_slug", "hgb_ocm")),
        cv_fold_mae_values=payload.get("cv_fold_mae_values"),
        cv_mean_mae=payload.get("cv_mean_mae"),
        cv_std_mae=payload.get("cv_std_mae"),
    )
