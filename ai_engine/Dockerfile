FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app-src

COPY ai_engine/requirements-base.txt ./requirements-base.txt

ENV PIP_CACHE_DIR=/root/.cache/pip \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN --mount=type=cache,id=tauron-ai-engine-pip,target=/root/.cache/pip,sharing=shared \
    pip install -r requirements-base.txt

COPY ai_engine/requirements-torch-cpu.txt ./requirements-torch-cpu.txt

RUN --mount=type=cache,id=tauron-ai-engine-pip,target=/root/.cache/pip,sharing=shared \
    pip install -r requirements-torch-cpu.txt

COPY ai_engine/ .

RUN pip install --no-cache-dir --no-deps . \
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
