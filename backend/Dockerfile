# Builder stage
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends gcc python3-dev curl openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Install uv - pip replacement, 10-100x faster dependency resolution
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install dependencies to a virtual environment
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV VIRTUAL_ENV=/opt/venv

# Install CPU-only torch first to avoid massive CUDA downloads
RUN uv pip install --no-cache torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN uv pip install --no-cache -r requirements.txt

# Pre-download spaCy model required by mem0 lemmatization (no pip at runtime)
RUN python -m spacy download en_core_web_sm

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Java runtime required by opendataloader-pdf (bundled JAR parser)
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with a home directory
RUN addgroup --system app && adduser --system --group --home /home/app app

# Set Hugging Face cache directory to a path within /app that we'll have permission for
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p /app/.cache/huggingface && chown -R app:app /app/.cache

# Copy virtual env from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .
RUN chmod +x /app/prestart.sh

# Chown all files to the app user
RUN chown -R app:app /app

# Switch to non-root user
USER app

CMD ["bash", "/app/prestart.sh"]
