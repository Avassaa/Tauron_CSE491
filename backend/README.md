# Tauron Backend

FastAPI backend application for the Tauron project.

## Overview

This is the main backend API service built with FastAPI, providing RESTful endpoints for the frontend application and integrating with the AI Engine service.

## Features

- FastAPI framework with automatic API documentation
- JWT-based authentication
- CORS middleware for frontend integration
- SQLAlchemy for database operations
- Pydantic for data validation
- Modular architecture with clear separation of concerns

## Prerequisites

- Python 3.9 or higher
- pip (Python package manager)

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

## Configuration

### Environment Variables

Create a `.env` file in the backend directory (copy from `.env.example` if available):

```env
SECRET_KEY=your-secret-key-here-change-in-production
DATABASE_URL=sqlite:///./tauron.db
AI_ENGINE_URL=http://localhost:8001
CORS_ORIGINS=http://localhost:4200,http://localhost:3000
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Important**: Change the `SECRET_KEY` in production!

## Development

Start the development server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- **API**: `http://localhost:8000`
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **Alternative API Docs (ReDoc)**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/    # API endpoint modules
│   │       └── __init__.py   # API router configuration
│   ├── core/
│   │   ├── config.py         # Application settings
│   │   └── security.py       # Authentication & security utilities
│   ├── models/               # Database models
│   ├── services/             # Business logic services
│   └── utils/                # Utility functions
├── tests/                    # Test files
├── main.py                   # Application entry point
└── requirements.txt         # Python dependencies
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "healthy"
}
```

### API v1 Endpoints

All v1 endpoints are prefixed with `/api/v1`:

```http
GET /api/v1/health
```

## Authentication

The backend uses JWT (JSON Web Tokens) for authentication. See `app/core/security.py` for implementation details.

### Creating Access Tokens

```python
from app.core.security import create_access_token
from datetime import timedelta

access_token_expires = timedelta(minutes=30)
access_token = create_access_token(
    data={"sub": user.email},
    expires_delta=access_token_expires
)
```

## Database

The default configuration uses SQLite. To use PostgreSQL or MySQL, update the `DATABASE_URL` in your `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost/tauron
```

## Testing

Run tests with pytest:

```bash
pytest
```

Run tests with coverage:

```bash
pytest --cov=app tests/
```

## Production Deployment

### Using Uvicorn

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Using Gunicorn with Uvicorn Workers

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Environment Variables Reference

| Variable                      | Description                            | Default                 |
| ----------------------------- | -------------------------------------- | ----------------------- |
| `SECRET_KEY`                  | Secret key for JWT token signing       | Required                |
| `DATABASE_URL`                | Database connection string             | `sqlite:///./tauron.db` |
| `AI_ENGINE_URL`               | AI Engine service URL                  | `http://localhost:8001` |
| `CORS_ORIGINS`                | Allowed CORS origins (comma-separated) | `http://localhost:4200` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time              | `30`                    |

## Integration with AI Engine

The backend can communicate with the AI Engine service. Configure the `AI_ENGINE_URL` in your `.env` file.

Example integration:

```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        f"{settings.AI_ENGINE_URL}/api/v1/inference/predict",
        json={"input_data": {...}}
    )
```

## Troubleshooting

### Port Already in Use

If port 8000 is already in use, specify a different port:

```bash
uvicorn main:app --reload --port 8001
```

### Import Errors

Ensure you're in the virtual environment and all dependencies are installed:

```bash
pip install -r requirements.txt
```

### Database Issues

For SQLite, ensure the database file has write permissions. For other databases, verify connection credentials in `DATABASE_URL`.

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
