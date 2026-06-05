FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /worker

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install \
    "fbchat-muqit>=1.2.2" \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "httpx>=0.27.0" \
    "pydantic>=2.9.0" \
    "pydantic-settings>=2.5.0" \
    "pyotp>=2.9.0"

COPY app ./app

RUN useradd -m -u 1000 worker && chown -R worker:worker /worker && \
    mkdir -p /data/fb-cookies && chown -R worker:worker /data
USER worker

EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9100/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9100", "--proxy-headers"]
