# Tauron Project

Senior Design Project - Tauron

## Overview

Tauron is a full-stack application with a modern Angular frontend, FastAPI backend, and a dedicated AI Engine service. This project demonstrates a microservices architecture with clear separation of concerns.

## Project Structure

```
Tauron/
├── frontend/          # Angular 17 frontend application
│   ├── src/
│   │   ├── app/      # Application components, services, models
│   │   ├── assets/   # Static assets (images, styles)
│   │   └── environments/  # Environment configurations
│   └── package.json
│
├── backend/           # FastAPI backend application
│   ├── app/
│   │   ├── api/      # API routes and endpoints
│   │   ├── core/     # Core configuration and security
│   │   ├── models/   # Data models
│   │   ├── services/ # Business logic services
│   │   └── utils/    # Utility functions
│   ├── main.py       # Application entry point
│   └── requirements.txt
│
└── ai_engine/         # AI Engine service
    ├── app/
    │   ├── routes/   # API routes for inference and training
    │   ├── models/   # ML model implementations
    │   ├── services/ # Model management services
    │   └── utils/    # Data processing utilities
    ├── data/         # Data storage (raw and processed)
    ├── config/       # Configuration files
    ├── main.py       # Service entry point
    └── requirements.txt
```

## Prerequisites

- **Node.js** (v18 or higher) and npm
- **Python** (v3.9 or higher)
- **pip** (Python package manager)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Tauron
```

### 2. Start Backend Service

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 3. Start AI Engine Service

```bash
cd ai_engine
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

AI Engine will be available at `http://localhost:8001`
- API Documentation: `http://localhost:8001/docs`
- Health Check: `http://localhost:8001/health`

### 4. Start Frontend Application

```bash
cd frontend
npm install
ng serve
```

Frontend will be available at `http://localhost:4200`

## Technology Stack

### Frontend
- **Framework**: Angular 17
- **Language**: TypeScript
- **Build Tool**: Angular CLI
- **HTTP Client**: Angular HttpClient

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.9+
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: SQLite (configurable)
- **API Documentation**: Swagger/OpenAPI

### AI Engine
- **Framework**: FastAPI
- **ML Libraries**: PyTorch, Transformers, scikit-learn
- **Data Processing**: NumPy, Pandas
- **Language**: Python 3.9+

## Development Workflow

1. **Backend Development**: Start with the backend service to define API endpoints
2. **AI Engine Development**: Implement and train ML models in the AI engine
3. **Frontend Development**: Build UI components that consume the backend APIs
4. **Integration**: Connect all services and test end-to-end functionality

## Environment Configuration

Each service has its own environment configuration:

- **Backend**: Copy `backend/.env.example` to `backend/.env`
- **AI Engine**: Copy `ai_engine/.env.example` to `ai_engine/.env` (if exists)
- **Frontend**: Update `src/environments/environment.ts` for development

## API Endpoints

### Backend API (Port 8000)
- Base URL: `http://localhost:8000/api/v1`
- Health: `GET /api/v1/health`

### AI Engine API (Port 8001)
- Base URL: `http://localhost:8001/api/v1`
- Inference: `POST /api/v1/inference/predict`
- Training: `POST /api/v1/training/train`
- Training Status: `GET /api/v1/training/status/{model_id}`

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
ng test
```

## Building for Production

### Frontend
```bash
cd frontend
ng build --configuration production
```

### Backend
The backend runs directly with uvicorn. For production, use:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### AI Engine
```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Add your license information here]

## Contact

[Add contact information here]
