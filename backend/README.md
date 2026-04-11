# Tauron

Backend API for crypto analytics, ML predictions, chat, and market data. Built with FastAPI, JWT authentication, and PostgreSQL.

The canonical **database layout** (TimescaleDB, pgvector, and application tables) is described in [schemas.md](schemas.md). [examples.md](examples.md) shows sample rows and how scrapers, cron jobs, and services populate each pillar. Hypertables and vector columns can be added as the schema evolves; core reference tables `users` and `assets` are created by the startup bootstrap.

## Quick Start

1. Clone or copy the project (for example name the folder `tauron`).
2. Install dependencies:
   ```bash
   uv sync
   ```
3. Configure environment:
   ```bash
   cp env.example .env
   ```
   Set `JWT_SECRET` and your PostgreSQL connection (`POSTGRES_*` or `DATABASE_URL_OVERRIDE` with `postgresql+asyncpg://...`). All tables are created automatically on API startup under the PostgreSQL schema named by `DATABASE_SCHEMA` (default `tauron`), including foreign keys, optional Timescale hypertables when the TimescaleDB extension is present, and an HNSW index on `knowledge_base.embedding` when the `vector` extension is present. Set `BOOTSTRAP_DATABASE_ON_STARTUP=false` only if you manage DDL yourself.

4. Run the service:
   ```bash
   uvicorn app.main:app --reload
   ```

## Project Structure

```
app/
├── core/
├── api/
│   └── v1/
│       ├── dependencies.py
│       └── routes/
│           ├── auth.py       # Register / login (JWT)
│           └── health.py
├── db/
│   ├── models/
│   └── repositories/
├── models/
│   ├── request/
│   └── response/
├── main.py
└── config.py

schemas.md                    # SQL schema reference
examples.md                   # Sample data and pipeline notes
```

## Configuration

See `app/config.py` for all settings. Important variables:

- `JWT_SECRET` — secret for signing access tokens (required in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES` — JWT lifetime
- `POSTGRES_*` — database connection (or set `DATABASE_URL_OVERRIDE` for async SQLAlchemy URL)
- `SERVICE_ID`, `SERVICE_NAME` — logging and root payload labels
- `RATE_LIMIT_*` — optional limits on auth and other endpoints using the shared limiter

## API Documentation

With the app running:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Docker

```bash
docker build -t tauron .
docker run -p 8000:8000 --env-file .env tauron
```
