"""Serializable metadata for discoverable training hyperparameter forms.

The AI engine is the source of truth: labels, bounds, and defaults stay aligned with
``_build_estimator`` and ``train_lstm_for_asset`` without hard-coding separate client lists.
"""

from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.services.lstm_pipeline import (
    _DEFAULT_DROPOUT,
    _DEFAULT_HIDDEN_SIZE,
    _DEFAULT_LEARNING_RATE,
    _DEFAULT_LOOKBACK_WINDOW,
    _DEFAULT_MAX_EPOCHS,
    _DEFAULT_NUM_LAYERS,
    _DEFAULT_PATIENCE,
    torch_package_import_succeeded_exclusive,
)
from app.services.ensemble_pipeline import xgboost_package_import_succeeded_exclusive
from app.services.training_pipeline import (
    _SUPPORTED_SKLEARN_SLUGS,
    _TIME_SERIES_CV_FOLDS,
    _build_estimator,
    lightgbm_package_import_succeeded_exclusive,
)

LSTM_MODEL_TYPE_SLUG_LITERAL = "lstm_ocm"

_SKLEARN_PARAM_KEYS_BY_SLUG: dict[str, list[str]] = {
    "ridge_ocm": ["alpha"],
    "rf_ocm": ["n_estimators", "max_features", "min_samples_leaf"],
    "et_ocm": ["n_estimators", "max_features", "min_samples_leaf"],
    "hgb_ocm": ["learning_rate", "max_iter", "max_depth", "min_samples_leaf", "l2_regularization"],
    "lgbm_ocm": [
        "n_estimators",
        "learning_rate",
        "num_leaves",
        "min_child_samples",
        "subsample",
        "colsample_bytree",
    ],
}

_LGBM_FALLBACK_DEFAULTS: dict[str, float | int] = {
    "n_estimators": 500,
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_child_samples": 20,
    "subsample": 0.8,
    "colsample_bytree": 0.6,
}

_ORCHESTRATION_FIELD_UI_BY_PARAM_KEY: dict[str, dict[str, Any]] = {
    "time_series_cv_folds": {
        "label": "Time-series CV folds",
        "hint": (
            "Chronological cross-validation depth before the final fit on all pre-holdout rows. "
            "Each fold trains on the past and scores the next slice (capped between 2 and 12)."
        ),
        "value_kind": "int",
        "minimum": 2,
        "maximum": 12,
    },
}

_SKLEARN_ESTIMATOR_FIELD_UI_BY_PARAM_KEY: dict[str, dict[str, Any]] = {
    "alpha": {
        "label": "Ridge penalty (alpha)",
        "hint": "Controls how strongly coefficients are shrunk; larger values produce smoother, smaller weights.",
        "value_kind": "float",
        "minimum": 1e-8,
        "maximum": 1e6,
    },
    "n_estimators": {
        "label": "Number of trees",
        "hint": "More trees reduce variance but increase fit time; very small values can underfit.",
        "value_kind": "int",
        "minimum": 10,
        "maximum": 5000,
    },
    "max_features": {
        "label": "Feature subsample per split",
        "hint": (
            "Fraction of input columns considered at each split (0–1). Lower values add randomness and can "
            "help wide metric panels."
        ),
        "value_kind": "float",
        "minimum": 0.05,
        "maximum": 1.0,
    },
    "min_samples_leaf": {
        "label": "Minimum samples per leaf",
        "hint": "Larger leaves smooth tree predictions and reduce sensitivity to noise.",
        "value_kind": "int",
        "minimum": 1,
        "maximum": 500,
    },
    "learning_rate": {
        "label": "Learning rate (boosting)",
        "hint": "Step size for tree boosting updates; lower values are steadier but need more trees or iterations.",
        "value_kind": "float",
        "minimum": 0.001,
        "maximum": 0.5,
    },
    "max_iter": {
        "label": "Boosting iterations",
        "hint": "Maximum boosting stages for histogram gradient boosting before built-in early stopping applies.",
        "value_kind": "int",
        "minimum": 20,
        "maximum": 2000,
    },
    "max_depth": {
        "label": "Max tree depth",
        "hint": "Depth of each base learner in the ensemble; deeper trees capture more interaction but can overfit.",
        "value_kind": "int",
        "minimum": 2,
        "maximum": 32,
    },
    "l2_regularization": {
        "label": "L2 regularization",
        "hint": "Penalty on leaf scores for histogram gradient boosting; higher values stabilise noisy panels.",
        "value_kind": "float",
        "minimum": 0.0,
        "maximum": 10.0,
    },
    "num_leaves": {
        "label": "LightGBM num_leaves",
        "hint": "Maximum leaves per tree; larger models are more expressive and slower to train.",
        "value_kind": "int",
        "minimum": 8,
        "maximum": 512,
    },
    "min_child_samples": {
        "label": "Minimum data in a leaf",
        "hint": "LightGBM counterpart to min_samples_leaf; increases robustness on sparse days.",
        "value_kind": "int",
        "minimum": 5,
        "maximum": 500,
    },
    "subsample": {
        "label": "Row subsample",
        "hint": "Fraction of rows sampled per boosting iteration (bagging effect).",
        "value_kind": "float",
        "minimum": 0.1,
        "maximum": 1.0,
    },
    "colsample_bytree": {
        "label": "Column subsample per tree",
        "hint": "Fraction of features sampled for each tree; decorrelates trees in wide panels.",
        "value_kind": "float",
        "minimum": 0.1,
        "maximum": 1.0,
    },
}

_LSTM_TRAINER_FIELD_UI_BY_PARAM_KEY: dict[str, dict[str, Any]] = {
    "lookback_window": {
        "label": "Lookback days",
        "hint": "How many past daily rows the LSTM sees before predicting the next log return.",
        "value_kind": "int",
        "minimum": 10,
        "maximum": 180,
    },
    "hidden_size": {
        "label": "Hidden units",
        "hint": "Width of the recurrent state; larger networks model richer dynamics but need more data.",
        "value_kind": "int",
        "minimum": 16,
        "maximum": 512,
    },
    "num_layers": {
        "label": "LSTM layers",
        "hint": "Stacked recurrent depth; values above one enable dropout between layers.",
        "value_kind": "int",
        "minimum": 1,
        "maximum": 4,
    },
    "dropout": {
        "label": "Dropout",
        "hint": "Stochastic regularisation inside the LSTM stack and MLP head (0 disables).",
        "value_kind": "float",
        "minimum": 0.0,
        "maximum": 0.6,
    },
    "learning_rate": {
        "label": "Learning rate (Adam)",
        "hint": "Step size for neural network weight updates during LSTM training.",
        "value_kind": "float",
        "minimum": 1e-6,
        "maximum": 0.1,
    },
    "max_epochs": {
        "label": "Max epochs",
        "hint": "Upper bound on training passes; early stopping usually finishes sooner.",
        "value_kind": "int",
        "minimum": 10,
        "maximum": 500,
    },
    "patience": {
        "label": "Early-stopping patience",
        "hint": "Epochs without validation improvement before training stops.",
        "value_kind": "int",
        "minimum": 1,
        "maximum": 120,
    },
}


def _coerce_json_friendly_number(candidate_value: Any) -> float | int | None:
    """Normalise numpy scalars and plain numbers into JSON-safe numeric defaults."""

    if candidate_value is None:
        return None
    if isinstance(candidate_value, bool):
        return None
    if isinstance(candidate_value, (int, float)):
        return candidate_value
    candidate_item = getattr(candidate_value, "item", None)
    if callable(candidate_item):
        try:
            primitive = candidate_item()
        except Exception:
            return None
        if isinstance(primitive, bool):
            return None
        if isinstance(primitive, (int, float)):
            return primitive
    return None


def _estimator_constructor_defaults_exclusive(model_type_slug: str) -> dict[str, Any] | None:
    """Return shallow ``get_params`` for a slug, or ``None`` when construction fails."""

    try:
        estimator_piece = _build_estimator(model_type_slug)
    except ValueError:
        return None
    return dict(estimator_piece.get_params(deep=False))


def _compose_field_record_exclusive(
    parameter_key: str,
    default_numeric_value: float | int | None,
    ui_catalog_exclusive: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Merge static UI copy with a concrete default for forms to pre-fill."""

    ui_slice = dict(ui_catalog_exclusive[parameter_key])
    ui_slice["parameter_key"] = parameter_key
    ui_slice["default_value"] = default_numeric_value
    return ui_slice


def build_trainer_hyperparameter_schema_envelope_exclusive(
    resolved_settings: Settings,
) -> dict[str, Any]:
    """Return a JSON object describing every user-facing trainer field per architecture."""

    default_model_type_slug = (resolved_settings.TRAIN_DEFAULT_MODEL_TYPE or "hgb_ocm").strip() or "hgb_ocm"

    time_series_cv_field = _compose_field_record_exclusive(
        "time_series_cv_folds",
        int(_TIME_SERIES_CV_FOLDS),
        _ORCHESTRATION_FIELD_UI_BY_PARAM_KEY,
    )

    ordered_sklearn_slugs = sorted(_SUPPORTED_SKLEARN_SLUGS)
    sklearn_hyperparameter_fields_by_slug: dict[str, list[dict[str, Any]]] = {}

    for model_slug_piece in ordered_sklearn_slugs:
        parameter_literal_keys = _SKLEARN_PARAM_KEYS_BY_SLUG.get(model_slug_piece, [])
        constructor_defaults = _estimator_constructor_defaults_exclusive(model_slug_piece)
        if constructor_defaults is None and model_slug_piece == "lgbm_ocm":
            constructor_defaults = {k: v for k, v in _LGBM_FALLBACK_DEFAULTS.items()}

        slug_field_rows: list[dict[str, Any]] = []
        for parameter_literal_key in parameter_literal_keys:
            default_numeric_value: float | int | None = None
            if constructor_defaults is not None and parameter_literal_key in constructor_defaults:
                default_numeric_value = _coerce_json_friendly_number(
                    constructor_defaults[parameter_literal_key],
                )
            if default_numeric_value is None and model_slug_piece == "lgbm_ocm":
                fallback_piece = _LGBM_FALLBACK_DEFAULTS.get(parameter_literal_key)
                if fallback_piece is not None:
                    default_numeric_value = fallback_piece

            slug_field_rows.append(
                _compose_field_record_exclusive(
                    parameter_literal_key,
                    default_numeric_value,
                    _SKLEARN_ESTIMATOR_FIELD_UI_BY_PARAM_KEY,
                ),
            )

        sklearn_hyperparameter_fields_by_slug[model_slug_piece] = slug_field_rows

    lstm_default_lookup = {
        "lookback_window": _DEFAULT_LOOKBACK_WINDOW,
        "hidden_size": _DEFAULT_HIDDEN_SIZE,
        "num_layers": _DEFAULT_NUM_LAYERS,
        "dropout": _DEFAULT_DROPOUT,
        "learning_rate": _DEFAULT_LEARNING_RATE,
        "max_epochs": _DEFAULT_MAX_EPOCHS,
        "patience": _DEFAULT_PATIENCE,
    }

    lstm_default_keys_ordered = (
        "lookback_window",
        "hidden_size",
        "num_layers",
        "dropout",
        "learning_rate",
        "max_epochs",
        "patience",
    )

    lstm_ocm_hyperparameter_fields = [
        _compose_field_record_exclusive(
            lstm_parameter_key,
            lstm_default_lookup[lstm_parameter_key],
            _LSTM_TRAINER_FIELD_UI_BY_PARAM_KEY,
        )
        for lstm_parameter_key in lstm_default_keys_ordered
    ]

    return {
        "default_model_type_slug": default_model_type_slug,
        "sklearn_model_type_slugs": ordered_sklearn_slugs,
        "lstm_model_type_slug": LSTM_MODEL_TYPE_SLUG_LITERAL,
        "time_series_cv_folds_shared": time_series_cv_field,
        "sklearn_hyperparameter_fields_by_slug": sklearn_hyperparameter_fields_by_slug,
        "lstm_ocm_hyperparameter_fields": lstm_ocm_hyperparameter_fields,
        "runtime_capability_flags": {
            "lightgbm_import_available": lightgbm_package_import_succeeded_exclusive(),
            "torch_import_available": torch_package_import_succeeded_exclusive(),
            "xgboost_import_available": xgboost_package_import_succeeded_exclusive(),
        },
    }
