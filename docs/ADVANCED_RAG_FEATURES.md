# Advanced RAG Features

Tài liệu này mô tả RAG pipeline hiện tại trong `backend/app/services/openrouter_rag_service.py` và `backend/app/services/lightrag_service.py`.

## Pipeline tổng quát

```text
Upload document
  -> MinIO object + PostgreSQL metadata
  -> Celery task
  -> OpenDataLoader/local parsing
  -> chunking
  -> embeddings
  -> Qdrant upsert
  -> optional Knowledge Graph / LightRAG
  -> chat retrieval + rerank + rewrite + answer
```

## Ingestion bất đồng bộ

`POST /api/v1/bots/{bot_id}/documents` không xử lý toàn bộ RAG ngay trong request. Backend tạo document record, lưu file, rồi enqueue Celery task. Worker xử lý parse, chunk, embed và cập nhật trạng thái document.

Điều này giúp upload response nhanh hơn, nhưng dev/ops cần nhớ:

- Worker phải chạy thì tài liệu mới sẵn sàng cho chat.
- Khi knowledge base thay đổi, backend invalidates cache theo bot.
- Lỗi parse/embedding thường nằm trong log `celery-worker`, không chỉ log backend.

## Chunking strategies

Service hiện hỗ trợ:

| Strategy | Mục tiêu |
| --- | --- |
| `recursive` | Default an toàn cho văn bản tổng quát |
| `sentence` | Giữ ranh giới câu, phù hợp FAQ/policy ngắn |
| `article` | Tách theo cấu trúc điều/khoản/mục |
| `parent_child` | Parent chunk giữ ngữ cảnh, child chunk phục vụ retrieval chính xác |
| `semantic` | Tách theo tương đồng ngữ nghĩa nếu dependency runtime đủ |

Domain template defaults trong `domain_config.py` dùng `recursive`, `article`, `sentence`, `parent_child`. Người dùng vẫn có thể override strategy khi upload hoặc cấu hình bot nếu UI/API truyền vào.

## Retrieval

RAG service kết hợp nhiều bước:

- Query embedding.
- Query rewrite cho câu hỏi cần mở rộng.
- Hybrid retrieval trên Qdrant.
- Reranking để chọn context tốt hơn.
- CRAG verdict để đánh giá chất lượng context.
- Optional group chat context cho channel integrations.
- Response generation qua OpenRouter.

## Cache

Backend cache nằm ở `backend/app/services/cache_service.py`, dùng Redis async và singleflight để giảm cache stampede.

Các nhóm cache chính:

- `rag:chat`: cache câu trả lời chat theo bot và query.
- `emb`: cache embedding cho query.
- `rewrite`: cache query rewrite.
- `crag`: cache verdict CRAG.

Gateway không cache chat. Gateway chỉ cache `GET` response đủ điều kiện. Nếu kiểm tra `X-Cache` trên `POST /chat` sẽ không thấy hit từ gateway.

## Knowledge Graph và LightRAG

LightRAG service dùng working directory riêng cho từng bot và model OpenRouter. API hiện có:

```http
GET /api/v1/bots/{bot_id}/knowledge-graph
```

Frontend mở graph tại:

```text
/bots/:id/graph
```

## Model defaults

Có hai lớp default cần phân biệt:

- Code internal default: `openai/gpt-5.4-nano`.
- `LIGHTRAG_LLM_MODEL` default trong `lightrag_service.py`: `openai/gpt-5.4-nano`.
- Docker Compose override: `LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini`.

Khi debug output/model cost, luôn kiểm tra effective env của container:

```bash
docker compose exec backend env | grep LIGHTRAG_LLM_MODEL
docker compose exec celery_worker env | grep LIGHTRAG_LLM_MODEL
```

## Config liên quan

| Biến | Ý nghĩa |
| --- | --- |
| `OPENROUTER_API_KEY` | Key chính cho OpenRouter |
| `OPENAI_API_KEY` | Legacy/fallback tùy flow |
| `OPENROUTER_CHAT_MODEL` | Model chat utility/default |
| `OPENROUTER_EMBEDDING_MODEL` | Model embedding utility/default |
| `LIGHTRAG_LLM_MODEL` | Model cho LightRAG |
| `RERANKER_MODEL` | Cross encoder reranker |
| `USE_LOCAL_EMBEDDINGS` | Dùng local embedding thay API |
| `HF_HOME` | Cache HuggingFace trong container |

## Debug checklist

- Kiểm tra document status trong PostgreSQL.
- Kiểm tra log Celery khi upload không index.
- Kiểm tra Qdrant collections.
- Kiểm tra Redis nếu cache không hit.
- Kiểm tra OpenRouter key/model nếu chat lỗi provider.
- Kiểm tra frontend route `/bots/:id/graph` nếu graph page 404.
