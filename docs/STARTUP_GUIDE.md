# Startup Guide

Tài liệu này mô tả các cách khởi động OmniRAG cho dev/ops. Mặc định nên chạy qua Docker Compose và gọi API qua gateway `http://localhost:8080`.

## Topology khi chạy Docker

| Service | Container port | Host port mặc định | Vai trò |
| --- | ---: | ---: | --- |
| gateway | `8080` | `${GATEWAY_HOST_PORT:-8080}` | Entrypoint HTTP chính |
| backend | `8000` | `${BACKEND_HOST_PORT:-8001}` | FastAPI direct access |
| frontend | `5173` | `${FRONTEND_HOST_PORT:-5173}` | React dev server |
| db | `5432` | `${POSTGRES_HOST_PORT:-5433}` | PostgreSQL database |
| mongodb | `27017` | `${MONGODB_HOST_PORT:-27017}` | Conversations, sessions, integrations |
| redis | `6379` | `${REDIS_HOST_PORT:-6380}` | Broker/cache |
| minio | `9000`, `9001` | `${MINIO_API_HOST_PORT:-9000}`, `${MINIO_CONSOLE_HOST_PORT:-9001}` | Object storage |
| qdrant | `6333` | `${QDRANT_HOST_PORT:-6333}` | Vector store |
| opendataloader-hybrid | `5002` | `${PDF_HYBRID_HOST_PORT:-5002}` | CPU-only PDF parsing service |
| fb-channel-worker | `9100` | internal | Facebook Messenger bridge |
| zalo-personal-worker | `9200` | internal | Zalo Personal bridge |

Backend trong Docker lắng nghe `8000`, nhưng host dùng `8001`. Local uvicorn ngoài Docker mới dùng `8000`.

## Env backend

Không dùng lệnh `cp .env.example .env` trong nhánh này vì repo không có `backend/.env.example`.

Tạo file:

```bash
cd backend
touch .env
```

Biến tối thiểu:

```env
SECRET_KEY=change-me
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENAI_API_KEY=sk-your-openai-key
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@db:5432/omnirag
MONGODB_URL=mongodb://admin:password@mongodb:27017
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
QDRANT_HOST=qdrant
QDRANT_PORT=6333
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
RAG_COLLECTION_NAME=omnirag_openrouter_collection_v3
```

Compose tự truyền OpenRouter env vào backend/Celery. Nếu chạy stack bằng shell env thay vì `backend/.env`, export `OPENROUTER_API_KEY` ở root trước khi `docker compose up`.

Biến channel tùy chọn:

```env
# Public URL cho webhook registration
PUBLIC_URL=https://your-domain.example.com

# Zalo Hub / Func.vn
FUNC_API_URL=
FUNC_API_TOKEN=
ZALO_HUB_WEBHOOK_SECRET=

# Facebook Messenger worker
FB_WORKER_API_TOKEN=replace-with-random-token
FB_INBOUND_SECRET=replace-with-random-hmac-secret

# Zalo Personal worker
ZALO_PERSONAL_ENABLED=false
ZALO_PERSONAL_WORKER_URL=http://zalo-personal-worker:9200
ZALO_PERSONAL_WORKER_API_TOKEN=replace-with-random-token
ZALO_PERSONAL_INBOUND_SECRET=replace-with-random-hmac-secret
```

Biến frontend liên quan Zalo Personal:

```env
VITE_ENABLE_ZALO_PERSONAL=false
```

Model mặc định cần hiểu rõ:

- Trong code, internal/default LightRAG model là `openai/gpt-5.4-nano`.
- `docker-compose.yml` override `LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini` cho backend và Celery worker.
- Nếu muốn đổi model runtime, set `LIGHTRAG_LLM_MODEL` trong env/compose.

## Chạy bằng Docker Compose

```bash
docker compose up -d --build
```

Theo dõi log:

```bash
docker compose logs -f backend
docker compose logs -f celery_worker
docker compose logs -f gateway
docker compose logs -f fb-channel-worker
docker compose logs -f zalo-personal-worker
```

Kiểm tra health:

```bash
curl http://localhost:8080/health
curl http://localhost:8001/health
```

Swagger:

- Qua gateway: `http://localhost:8080/docs`
- Direct backend Docker: `http://localhost:8001/docs`
- Local uvicorn: `http://localhost:8000/docs`

## Chạy một phần stack

Khởi động dependencies cho backend local:

```bash
docker compose up -d db mongodb redis minio qdrant opendataloader-hybrid
```

OpenDataLoader hybrid mặc định dùng CPU:

```env
PDF_HYBRID_DEVICE=cpu
PDF_HYBRID_FORCE_OCR=false
PDF_HYBRID_OCR_ENGINE=auto
```

Build lại riêng Zalo Personal channel:

```bash
docker compose build backend frontend zalo-personal-worker
docker compose up -d backend frontend zalo-personal-worker
```

Production compose — `docker-compose.prod.yml` is an override file with no
service definitions of its own, so it must be passed alongside the base file:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Chạy backend ngoài Docker

Dùng khi cần debug Python trực tiếp. Vẫn có thể dùng Postgres/Redis/MinIO/Qdrant từ Docker.

1. Tạo virtualenv và cài dependency:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Điều chỉnh env trỏ về host:

```env
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@localhost:5433/omnirag
MONGODB_URL=mongodb://admin:password@localhost:27017
REDIS_URL=redis://localhost:6380/0
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
QDRANT_URL=http://localhost:6333
QDRANT_HOST=localhost
QDRANT_PORT=6333
MINIO_ENDPOINT=localhost:9000
OPENDATALOADER_BASE_URL=http://localhost:5002
```

3. Chạy migration và server:

```bash
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Chạy frontend ngoài Docker

```bash
cd frontend
npm install
npm run dev
```

Frontend dùng `VITE_API_URL=http://localhost:8080` khi chạy cùng Docker gateway. Nếu gọi backend direct, đổi sang `http://localhost:8001`.

## Checklist vận hành

- Gateway là entrypoint public cho frontend và API.
- Backend direct host port là `8001`, không phải `8000`, khi chạy Docker.
- Redis host port là `6380`, Postgres host port là `5433`.
- Celery worker phải chạy thì upload tài liệu mới được ingest.
- OpenRouter/OpenAI key phải hợp lệ trước khi test RAG/chat.
- Qdrant image được pin `qdrant/qdrant:v1.16.0`; health endpoint backend kiểm tra `/healthz`.
- OpenDataLoader hybrid là CPU-only mặc định, không cần CUDA cho pipeline dev/E2E hiện tại.
- Gateway cache chỉ áp dụng cho `GET`; chat cache nằm trong backend.
- Zalo Personal mặc định tắt; chỉ bật khi đã cấu hình worker token, inbound secret và frontend flag.

## Benchmark isolated

Để build stack isolated, ingest generated fixtures và đo pipeline:

```bash
python scripts/benchmark_opendataloader_pipeline.py
```

Script dùng `COMPOSE_PROJECT_NAME=omnirag-odl-bench` và host ports riêng như `18080`, `18001`, `16333`, `15002`; không đụng volumes mặc định.

## Troubleshooting

Xem [Troubleshooting](TROUBLESHOOTING.md).
