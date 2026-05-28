# Startup Guide

Tài liệu này mô tả các cách khởi động OmniRAG cho dev/ops. Mặc định nên chạy qua Docker Compose và gọi API qua gateway `http://localhost:8080`.

## Topology khi chạy Docker

| Service | Container port | Host port | Vai trò |
| --- | ---: | ---: | --- |
| gateway | `8080` | `8080` | Entrypoint HTTP chính |
| backend | `8000` | `8001` | FastAPI direct access |
| frontend | `5173` | `5173` | React dev server |
| db | `5432` | `5433` | PostgreSQL database |
| mongodb | `27017` | `27017` | Conversations, sessions, integrations |
| redis | `6379` | `6380` | Broker/cache |
| minio | `9000`, `9001` | `9000`, `9001` | Object storage |
| qdrant | `6333` | `6333` | Vector store |
| opendataloader-hybrid | `5002` | `5002` | PDF/Office parsing service |

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
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

Biến channel tùy chọn:

```env
ZALO_BOT_APP_ID=
ZALO_BOT_APP_SECRET=
ZALO_BOT_VERIFY_TOKEN=
ZALO_HUB_VERIFY_TOKEN=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_VERIFY_TOKEN=
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
docker compose logs -f celery-worker
docker compose logs -f gateway
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

## Chạy backend ngoài Docker

Dùng khi cần debug Python trực tiếp. Vẫn có thể dùng Postgres/Redis/MinIO/Qdrant từ Docker.

1. Khởi động dependencies:

```bash
docker compose up -d db mongodb redis minio qdrant opendataloader-hybrid
```

2. Tạo virtualenv và cài dependency:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Điều chỉnh env trỏ về host:

```env
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@localhost:5433/omnirag
MONGODB_URL=mongodb://admin:password@localhost:27017
REDIS_URL=redis://localhost:6380/0
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
QDRANT_URL=http://localhost:6333
MINIO_ENDPOINT=localhost:9000
OPENDATALOADER_BASE_URL=http://localhost:5002
```

4. Chạy migration và server:

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
- Gateway cache chỉ áp dụng cho `GET`; chat cache nằm trong backend.
- Không đưa Zalo Personal/ZCA vào cấu hình chính của snapshot này.

## Troubleshooting

Xem [Troubleshooting](TROUBLESHOOTING.md).
