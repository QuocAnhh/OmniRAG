FROM node:20-slim

ENV NODE_ENV=production

WORKDIR /worker

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN useradd -m worker \
    && mkdir -p /sessions \
    && chown -R worker:worker /worker /sessions

USER worker

EXPOSE 9200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9200/health || exit 1

CMD ["node", "src/main.js"]
