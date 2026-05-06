FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY ai_engine /app-src
WORKDIR /app-src

RUN pip install --no-cache-dir . \
    && mkdir -p /models \
    && useradd --create-home --uid 1000 mluser \
    && chown -R mluser:mluser /app-src /models

USER mluser
WORKDIR /app-src

EXPOSE 8001

ENV MODEL_PATH=/models \
    PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=4 \
    CMD curl -fsS http://127.0.0.1:8001/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
