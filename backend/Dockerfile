# Build from the repository root (see docker-compose: context ., dockerfile backend/Dockerfile).

FROM python:3.11-slim AS builder

WORKDIR /build

COPY backend/pyproject.toml backend/README.md ./
COPY backend/app ./app/
RUN pip install --no-cache-dir .

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY backend/app ./app/
COPY scrapers /scrapers

RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /scrapers

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-c", "import uvicorn; uvicorn.run('app.main:app', host='0.0.0.0', port=8000, log_config=None)"]
