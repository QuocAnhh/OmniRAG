# Advanced RAG Features

Chi tiết về pipeline RAG trong OmniRAG và cách hoạt động của từng component.

---

## Pipeline Tổng Quan

```
Query → Transform → Hybrid Search → Rerank → Knowledge Graph → Memory → LLM → Response
                                                                      ↑
                                                              Memory Update (Mem0)
```

---

## 1. Hybrid Search

Kết hợp 2 phương pháp tìm kiếm trong Qdrant:

- **Vector Search**: Tìm documents có semantic similarity cao (cosine similarity với embedding của query)
- **Keyword/Metadata Filter**: Lọc theo `bot_id` và metadata để đảm bảo kết quả đúng bot

**Config:**
- Collection: `omnirag_advanced` trong Qdrant
- Indexing: HNSW (Hierarchical Navigable Small World)
- `top_k`: mặc định 5, có thể điều chỉnh per-request

---

## 2. Query Transformation

### HyDE — Hypothetical Document Embeddings

Thay vì embed trực tiếp query (thường là câu hỏi), HyDE:
1. Dùng LLM generate một "hypothetical answer" cho query
2. Embed câu trả lời giả thuyết này
3. Tìm documents có vector gần với câu trả lời giả thuyết

Điều này bridge gap giữa question space và answer space → retrieval chính xác hơn.

### Multi-Query Generation

1. Dùng LLM rephrase query thành N biến thể (khác góc nhìn, cách diễn đạt)
2. Chạy retrieval cho mỗi biến thể
3. Merge kết quả, deduplicate
4. Tăng recall đáng kể cho complex queries

---

## 3. Chunking Strategies

### Recursive (Default)

```
Chunk size : 800 characters
Overlap    : 200 characters
Best for   : Văn bản thông thường, essays, articles, chat logs
```

Chia text theo hierarchy: paragraph → sentence → word. Đảm bảo không cắt đứt ý.

### Semantic

```
Chunk size : 500 characters
Overlap    : 100 characters
Best for   : Technical docs, FAQs, manuals có cấu trúc rõ ràng
```

Chunk theo semantic boundaries (câu hoàn chỉnh, section breaks).

---

## 4. Document Re-ranking

Sau retrieval ban đầu (top-20), áp dụng re-ranking để sort lại theo relevance thực sự với query:

- Dùng cross-encoder model hoặc LLM-based scoring
- Giữ lại top-K sau re-rank (thường K=5)
- Cải thiện precision đáng kể so với chỉ dùng vector similarity

---

## 5. Knowledge Graph RAG (LightRAG)

Feature mới — extract và query knowledge graph từ documents.

### Cách hoạt động

**Ingestion:**
1. Document được chunk và gửi tới LightRAG
2. LightRAG dùng LLM (mặc định `openai/gpt-4.1-mini`) để extract:
   - **Entities**: người, tổ chức, khái niệm, địa điểm...
   - **Relationships**: liên kết giữa các entity
3. Graph được lưu tại `backend/rag_storage/lightrag_{bot_id}/`

**Query:**
1. Query được phân tích để xác định entities liên quan
2. Graph traversal để tìm context entity/relationship
3. Graph context được inject vào prompt LLM cùng vector search results

### Config

```env
LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini   # LLM cho entity extraction
```

Trong bot config:
```json
{
  "enable_knowledge_graph": true
}
```

### Khi nào dùng Knowledge Graph?

Knowledge Graph đặc biệt hiệu quả khi:
- Documents chứa nhiều entities có quan hệ phức tạp (org charts, process flows)
- Câu hỏi yêu cầu reasoning qua nhiều bước (A liên quan B, B liên quan C)
- Tài liệu kỹ thuật, legal documents, research papers

### Visualisation

Truy cập đồ thị tương tác tại: `http://localhost:5173/bots/{id}/knowledge-graph`

- Click node để xem entity details
- Drag để pan, scroll để zoom
- Các node có màu theo loại entity
- Edge hiển thị relationship type

---

## 6. Persistent Memory (Mem0)

Khác với conversation history (chỉ lưu N messages cuối), Mem0 lưu **facts/memories** được extract từ cuộc trò chuyện.

### Cách hoạt động

1. Sau mỗi conversation turn, LLM extract các facts quan trọng
2. Facts được lưu vào Mem0 collection (Qdrant backend)
3. Ở turn tiếp theo — kể cả session mới — top-K memories được retrieve và inject vào context

**Ví dụ:**
- User nói: "Công ty tôi có 500 nhân viên và đang mở rộng sang Singapore"
- Mem0 lưu: `["Công ty của user có 500 nhân viên", "User đang mở rộng sang Singapore"]`
- Session sau, bot sẽ nhớ những điều này

### Config

```env
MEM0_ENABLED=true
MEM0_COLLECTION_NAME=omnirag_memories
MEM0_MEMORY_MODEL=openai/gpt-4o-mini    # LLM cho fact extraction
MEM0_TOP_K=5                            # Số memories retrieve mỗi query
```

---

## 7. Redis Response Cache

Responses được cache để tăng tốc cho repeated queries.

```
Cache key : MD5(bot_id + query_text)
TTL       : 1 giờ
Storage   : Redis (db 0)
Header    : X-Cache: HIT | MISS (từ Gateway)
```

**Cache invalidation:**
- TTL expiry tự động sau 1 giờ
- Upload document mới → invalidate cache của bot đó

**Bypass cache** (để test fresh response):
```bash
# Thêm header
X-No-Cache: true
```

---

## 8. Embedding Models

| Model | Provider | Dimensions | Notes |
|-------|----------|-----------|-------|
| `openai/text-embedding-3-small` | OpenRouter | 1536 | Default, balanced |
| `openai/text-embedding-3-large` | OpenRouter | 3072 | Higher quality, slower |
| `sentence-transformers/all-MiniLM-L6-v2` | Local | 384 | Opt-in, no API cost |

Để dùng local embeddings:
```env
USE_LOCAL_EMBEDDINGS=true
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

> Local embeddings cần download model (~90MB) lần đầu, lưu tại `.cache/huggingface/`.

---

## 9. Performance Tips

| Scenario | Recommendation |
|----------|---------------|
| Tài liệu lớn (>100 pages) | `chunking_strategy=recursive`, `chunk_size=1000` |
| Tài liệu kỹ thuật/FAQ | `chunking_strategy=semantic` |
| Cần reasoning phức tạp | `enable_knowledge_graph=true` |
| Cần nhớ user preferences | `enable_memory=true`, set `session_id` |
| Low latency | `top_k=3`, disable knowledge graph, dùng cache |
| High accuracy | `top_k=10`, enable reranking + knowledge graph |
| Cost optimization | `llm_model=openai/gpt-4o-mini` (nhanh + rẻ nhất) |
