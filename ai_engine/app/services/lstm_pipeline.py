"""LSTM training, serialization, and inference pipeline for the lstm_ocm model type.

Architecture:
    Input  [batch, lookback_window, n_features]
      └─> LSTM (num_layers=2, hidden_size=128, dropout=0.2)
      └─> last hidden state  [batch, 128]
      └─> Linear(128 → 64) + ReLU + Dropout(0.2)
      └─> Linear(64 → 1)   [batch, 1]   # predicted one-day log return

Serialization:
    torch.save is used because sklearn joblib cannot handle PyTorch state dicts.
    The artifact is a dict with keys defined in ``LSTM_ARTIFACT_KEYS``.
    ``FittedEstimatorBundle`` receives an ``is_torch_artifact=True`` flag so
    ``revive_bundle_from_disk`` in training_pipeline.py can dispatch correctly.

Training details:
    - Chronological 80/20 split (no overlap between train and validation windows).
    - Sliding window sequences of shape [lookback_window, n_features].
    - Adam optimiser, MSELoss, early stopping on validation MAE (patience=20, max 150 epochs).
    - Per-feature MinMax scaling computed only on the training window to prevent look-ahead.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn

    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False
    torch = None  # type: ignore[assignment]
    nn = None  # type: ignore[assignment]

LSTM_ARTIFACT_KEYS = frozenset({
    "model_state_dict",
    "scaler_min",
    "scaler_scale",
    "feature_column_order",
    "lookback_window",
    "hidden_size",
    "num_layers",
    "is_torch_artifact",
})

_DEFAULT_LOOKBACK_WINDOW = 60
_DEFAULT_HIDDEN_SIZE = 128
_DEFAULT_NUM_LAYERS = 2
_DEFAULT_DROPOUT = 0.2
_DEFAULT_LEARNING_RATE = 1e-3
_DEFAULT_MAX_EPOCHS = 150
_DEFAULT_PATIENCE = 20
_TRAIN_FRACTION = 0.80


def torch_package_import_succeeded_exclusive() -> bool:
    """Whether PyTorch is importable (required for lstm_ocm)."""

    return _TORCH_AVAILABLE


def _require_torch() -> None:
    """Raise a clear error if PyTorch is not installed."""
    if not _TORCH_AVAILABLE:
        raise ValueError(
            "lstm_ocm requires torch>=2.2 which is not installed in this environment. "
            "Install it or choose a different model_type_slug."
        )


class _LstmRegressionModel(nn.Module if _TORCH_AVAILABLE else object):
    """Two-layer LSTM followed by a two-stage MLP head for log-return regression."""

    def __init__(
        self,
        input_size: int,
        hidden_size: int = _DEFAULT_HIDDEN_SIZE,
        num_layers: int = _DEFAULT_NUM_LAYERS,
        dropout: float = _DEFAULT_DROPOUT,
    ) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

    def forward(self, sequence_tensor: Any) -> Any:
        """Return shape [batch, 1] log-return prediction from [batch, T, features] input."""
        lstm_out, _ = self.lstm(sequence_tensor)
        last_hidden = lstm_out[:, -1, :]
        return self.head(last_hidden)


def _build_sequences(
    feature_array: np.ndarray,
    target_array: np.ndarray,
    lookback_window: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Slide a window of length ``lookback_window`` over the time axis.

    Returns X of shape [N, lookback_window, features] and y of shape [N].
    The first valid prediction target is at position ``lookback_window`` (0-indexed).
    """
    num_sequences = len(feature_array) - lookback_window
    if num_sequences < 1:
        raise ValueError(
            f"Cannot build sequences: only {len(feature_array)} rows but lookback is {lookback_window}."
        )

    sequence_list = []
    target_list = []
    for start_index in range(num_sequences):
        window_features = feature_array[start_index : start_index + lookback_window]
        window_target = target_array[start_index + lookback_window]
        sequence_list.append(window_features)
        target_list.append(window_target)

    return np.stack(sequence_list, axis=0).astype(np.float32), np.array(target_list, dtype=np.float32)


@dataclass
class LstmTrainResult:
    """Outcome of LSTM training — metrics plus data for artifact construction."""

    model_state_dict: dict[str, Any]
    scaler_min: np.ndarray
    scaler_scale: np.ndarray
    feature_column_order: list[str]
    lookback_window: int
    hidden_size: int
    num_layers: int
    training_rows: int
    final_fold_mae: float
    final_fold_residual_sigma: float
    epoch_val_mae_history: list[float] = field(default_factory=list)


def train_lstm_for_asset(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    *,
    lookback_window: int = _DEFAULT_LOOKBACK_WINDOW,
    hidden_size: int = _DEFAULT_HIDDEN_SIZE,
    num_layers: int = _DEFAULT_NUM_LAYERS,
    dropout: float = _DEFAULT_DROPOUT,
    learning_rate: float = _DEFAULT_LEARNING_RATE,
    max_epochs: int = _DEFAULT_MAX_EPOCHS,
    patience: int = _DEFAULT_PATIENCE,
) -> LstmTrainResult:
    """
    Train an LSTM on the aligned (feature_frame, target_series) pair.

    Data preparation:
    1. Align on time index, forward-fill remaining NaN, fill any residual NaN with 0.
    2. Per-feature min-max scaling fitted on the training portion only (no look-ahead).
    3. Build sliding-window sequences.
    4. 80/20 chronological split into train and validation sets.

    Training loop uses Adam + MSELoss with early stopping on validation MAE.
    Returns ``LstmTrainResult`` containing the model state dict and scaler parameters
    needed to reconstruct the artifact file.
    """
    _require_torch()

    aligned_index = feature_frame.index.intersection(target_series.index)
    feature_aligned = feature_frame.loc[aligned_index].sort_index().ffill().fillna(0.0)
    target_aligned = target_series.loc[aligned_index].sort_index().astype(float).fillna(0.0)

    feature_array = feature_aligned.values.astype(np.float32)
    target_array = target_aligned.values.astype(np.float32)
    total_rows = len(feature_array)

    train_cut = math.floor(total_rows * _TRAIN_FRACTION)
    train_features_raw = feature_array[:train_cut]
    val_features_raw = feature_array[train_cut:]
    train_targets_raw = target_array[:train_cut]
    val_targets_raw = target_array[train_cut:]

    scaler_min = train_features_raw.min(axis=0)
    scaler_max = train_features_raw.max(axis=0)
    scaler_scale = np.where(scaler_max - scaler_min > 1e-12, scaler_max - scaler_min, 1.0)

    train_features_scaled = (train_features_raw - scaler_min) / scaler_scale
    val_features_scaled = (val_features_raw - scaler_min) / scaler_scale

    train_sequences, train_targets_seq = _build_sequences(train_features_scaled, train_targets_raw, lookback_window)
    val_sequences, val_targets_seq = _build_sequences(val_features_scaled, val_targets_raw, lookback_window)

    device = torch.device("cpu")
    model = _LstmRegressionModel(
        input_size=feature_array.shape[1],
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout,
    ).to(device)

    optimiser = torch.optim.Adam(model.parameters(), lr=learning_rate)
    loss_function = nn.MSELoss()

    train_x = torch.tensor(train_sequences, dtype=torch.float32, device=device)
    train_y = torch.tensor(train_targets_seq, dtype=torch.float32, device=device).unsqueeze(1)
    val_x = torch.tensor(val_sequences, dtype=torch.float32, device=device)
    val_y_numpy = val_targets_seq

    batch_size = min(64, len(train_x))
    train_dataset = torch.utils.data.TensorDataset(train_x, train_y)
    train_loader = torch.utils.data.DataLoader(
        train_dataset, batch_size=batch_size, shuffle=False, drop_last=False
    )

    best_val_mae = float("inf")
    best_state_dict: dict[str, Any] = {}
    patience_counter = 0
    epoch_val_mae_history: list[float] = []

    for epoch_index in range(max_epochs):
        model.train()
        for batch_features, batch_targets in train_loader:
            optimiser.zero_grad()
            predictions = model(batch_features)
            loss = loss_function(predictions, batch_targets)
            loss.backward()
            optimiser.step()

        model.eval()
        with torch.no_grad():
            val_predictions_tensor = model(val_x).squeeze(1).cpu().numpy()
        val_mae = float(np.mean(np.abs(val_y_numpy - val_predictions_tensor)))
        epoch_val_mae_history.append(val_mae)

        if val_mae < best_val_mae:
            best_val_mae = val_mae
            best_state_dict = {k: v.clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                break

    model.load_state_dict(best_state_dict)
    model.eval()
    with torch.no_grad():
        final_val_preds = model(val_x).squeeze(1).cpu().numpy()
    final_residuals = val_y_numpy - final_val_preds
    final_residual_sigma = float(np.sqrt(np.maximum(np.mean(np.square(final_residuals)), 1e-12)))

    serializable_state_dict = {k: v.cpu() for k, v in best_state_dict.items()}

    return LstmTrainResult(
        model_state_dict=serializable_state_dict,
        scaler_min=scaler_min,
        scaler_scale=scaler_scale,
        feature_column_order=list(feature_aligned.columns),
        lookback_window=lookback_window,
        hidden_size=hidden_size,
        num_layers=num_layers,
        training_rows=len(train_sequences),
        final_fold_mae=best_val_mae,
        final_fold_residual_sigma=final_residual_sigma,
        epoch_val_mae_history=epoch_val_mae_history,
    )


def lstm_artifact_dictionary_from_train_result(train_outcome: LstmTrainResult) -> dict[str, Any]:
    """Serialize training outcome fields into the same dictionary shape persisted by ``torch.save``."""
    return {
        "model_state_dict": train_outcome.model_state_dict,
        "scaler_min": train_outcome.scaler_min,
        "scaler_scale": train_outcome.scaler_scale,
        "feature_column_order": train_outcome.feature_column_order,
        "lookback_window": train_outcome.lookback_window,
        "hidden_size": train_outcome.hidden_size,
        "num_layers": train_outcome.num_layers,
        "is_torch_artifact": True,
    }


def save_lstm_artifact(result: LstmTrainResult, artifact_path: Path) -> None:
    """Write the LSTM artifact dict to disk using ``torch.save``."""
    _require_torch()
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        lstm_artifact_dictionary_from_train_result(result),
        artifact_path,
    )


def load_lstm_artifact(artifact_path: Path) -> dict[str, Any]:
    """Load a previously saved LSTM artifact dict from disk."""
    _require_torch()
    return torch.load(artifact_path, map_location="cpu", weights_only=False)


def predict_lstm(
    artifact: dict[str, Any],
    feature_history_frame: pd.DataFrame,
) -> float:
    """
    Run one forward pass on the most recent ``lookback_window`` days.

    ``feature_history_frame`` must contain at least ``lookback_window`` rows ordered
    chronologically and must include all columns in ``artifact['feature_column_order']``.
    Returns the predicted one-day log return as a Python float.
    """
    _require_torch()

    lookback_window: int = int(artifact["lookback_window"])
    hidden_size: int = int(artifact["hidden_size"])
    num_layers: int = int(artifact["num_layers"])
    feature_column_order: list[str] = list(artifact["feature_column_order"])
    scaler_min: np.ndarray = np.asarray(artifact["scaler_min"], dtype=np.float32)
    scaler_scale: np.ndarray = np.asarray(artifact["scaler_scale"], dtype=np.float32)

    aligned_history = (
        feature_history_frame
        .reindex(columns=feature_column_order)
        .sort_index()
        .ffill()
        .fillna(0.0)
    )

    if len(aligned_history) < lookback_window:
        raise ValueError(
            f"predict_lstm requires at least {lookback_window} rows; "
            f"got {len(aligned_history)}."
        )

    window_raw = aligned_history.values[-lookback_window:].astype(np.float32)
    window_scaled = (window_raw - scaler_min) / scaler_scale

    model = _LstmRegressionModel(
        input_size=len(feature_column_order),
        hidden_size=hidden_size,
        num_layers=num_layers,
    )
    model.load_state_dict(artifact["model_state_dict"])
    model.eval()

    input_tensor = torch.tensor(window_scaled[np.newaxis, :, :], dtype=torch.float32)
    with torch.no_grad():
        prediction_tensor = model(input_tensor)

    return float(prediction_tensor.squeeze().item())
