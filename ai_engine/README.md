# Tauron AI Engine

AI Engine service for the Tauron project, providing machine learning inference and training capabilities.

## Overview

This service is built with FastAPI and provides endpoints for model inference and training. It supports various ML frameworks including PyTorch, Transformers, and scikit-learn.

## Features

- RESTful API for model inference
- Model training endpoints
- Support for multiple ML frameworks (PyTorch, Transformers, scikit-learn)
- Model management and versioning
- Data preprocessing utilities
- Training status tracking

## Prerequisites

- Python 3.9 or higher
- pip (Python package manager)
- CUDA (optional, for GPU acceleration)

## Installation

### 1. Create Virtual Environment

```bash
python -m venv venv
```

### 2. Activate Virtual Environment

**Linux/macOS:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

**Note**: PyTorch installation may vary based on your system. Visit [PyTorch Installation Guide](https://pytorch.org/get-started/locally/) for system-specific instructions.

## Configuration

### Environment Variables

Create a `.env` file in the ai_engine directory:

```env
MODEL_PATH=./models
DATA_PATH=./data
CORS_ORIGINS=http://localhost:4200,http://localhost:8000
```

### Configuration File

Edit `config/config.yaml` to customize training and model parameters:

```yaml
model:
  default_type: "neural_network"
  save_path: "./models"

training:
  batch_size: 32
  epochs: 100
  learning_rate: 0.001
  validation_split: 0.2

data:
  raw_path: "./data/raw"
  processed_path: "./data/processed"
```

## Development

Start the development server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

The AI Engine will be available at:
- **API**: `http://localhost:8001`
- **Interactive API Docs (Swagger)**: `http://localhost:8001/docs`
- **Alternative API Docs (ReDoc)**: `http://localhost:8001/redoc`
- **Health Check**: `http://localhost:8001/health`

## Project Structure

```
ai_engine/
├── app/
│   ├── routes/
│   │   ├── inference.py    # Inference endpoints
│   │   └── training.py     # Training endpoints
│   ├── models/
│   │   └── base_model.py   # Base model class
│   ├── services/
│   │   └── model_service.py  # Model management service
│   ├── utils/
│   │   └── data_loader.py  # Data loading utilities
│   └── core/
│       └── config.py       # Configuration settings
├── data/
│   ├── raw/                # Raw data files
│   └── processed/          # Processed data files
├── models/                 # Saved model files
├── config/
│   └── config.yaml         # Configuration file
├── main.py                 # Service entry point
└── requirements.txt        # Python dependencies
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "ai-engine"
}
```

### Inference

#### Predict

```http
POST /api/v1/inference/predict
Content-Type: application/json

{
  "input_data": {
    "feature1": value1,
    "feature2": value2
  }
}
```

Response:
```json
{
  "prediction": "result",
  "confidence": 0.95
}
```

### Training

#### Start Training

```http
POST /api/v1/training/train
Content-Type: application/json

{
  "model_type": "neural_network",
  "training_data_path": "./data/raw/train.csv",
  "parameters": {
    "epochs": 100,
    "batch_size": 32,
    "learning_rate": 0.001
  }
}
```

Response:
```json
{
  "status": "training_started",
  "model_id": "model_001",
  "metrics": {
    "accuracy": 0.0
  }
}
```

#### Get Training Status

```http
GET /api/v1/training/status/{model_id}
```

Response:
```json
{
  "model_id": "model_001",
  "status": "completed",
  "progress": 100
}
```

## Model Development

### Creating a Custom Model

Extend the `BaseModel` class in `app/models/base_model.py`:

```python
from app.models.base_model import BaseModel

class MyCustomModel(BaseModel):
    def load(self, model_path: str):
        # Load model implementation
        pass
    
    def save(self, model_path: str):
        # Save model implementation
        pass
    
    def train(self, training_data, **kwargs):
        # Training implementation
        pass
    
    def predict(self, input_data):
        # Prediction implementation
        pass
```

### Registering a Model

```python
from app.services.model_service import ModelService

model_service = ModelService()
model_service.register_model("my_model", MyCustomModel())
```

## Data Management

### Data Loading

Use the `DataLoader` utility for loading data:

```python
from app.utils.data_loader import DataLoader

loader = DataLoader()
data = loader.load_csv("./data/raw/train.csv")
processed_data = loader.preprocess_data(data)
```

### Data Storage

- **Raw Data**: Place unprocessed data files in `data/raw/`
- **Processed Data**: Processed data files go in `data/processed/`

## Training Workflow

1. Prepare training data in `data/raw/`
2. Preprocess data using `DataLoader`
3. Call the training endpoint with model parameters
4. Monitor training status using the status endpoint
5. Trained models are saved in `models/` directory

## Production Deployment

### Using Uvicorn

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

### Using Gunicorn with Uvicorn Workers

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

## GPU Support

For GPU acceleration with PyTorch:

1. Install CUDA-compatible PyTorch:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

2. Verify GPU availability:
```python
import torch
print(torch.cuda.is_available())
```

## Troubleshooting

### Out of Memory Errors

- Reduce batch size in training configuration
- Use gradient accumulation
- Enable mixed precision training

### Model Loading Issues

- Verify model file paths
- Check model format compatibility
- Ensure all dependencies are installed

### Port Already in Use

If port 8001 is already in use:

```bash
uvicorn main:app --reload --port 8002
```

## Performance Optimization

- Use GPU acceleration when available
- Implement model caching for frequently used models
- Use batch inference for multiple predictions
- Optimize data preprocessing pipelines

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Documentation](https://pytorch.org/docs/)
- [Transformers Documentation](https://huggingface.co/docs/transformers/)
- [scikit-learn Documentation](https://scikit-learn.org/)
