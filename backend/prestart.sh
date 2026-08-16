#!/bin/bash
set -e

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Starting application..."
# --forwarded-allow-ips lets the rate limiter see the real client rather than
# the gateway's container IP. Only safe while port 8000 stays unpublished.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
