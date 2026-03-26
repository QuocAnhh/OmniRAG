# Advanced RAG Features

Chi tiết về pipeline RAG nâng cao trong OmniRAG và cách từng chiến thuật hoạt động.

---

## Pipeline Tổng Quan

Pipeline được thiết kế để tối đa hoá parallelism — **~3.5s to first token** (từ 8.9s).

```
t=0:    ┌─ embed(query)      ─────────────────┐
        ├─ rewrite(query)    ────────────────┐ │
        └─ memory_search()  ────────────────┘ │
                                              ↓
t=~0.4: ┌─ hybrid_search()  ─────────────┐   │ (embed done)
        └─ lightrag_query() ───────────┐ │   │ (if KG bot)
                                       │ ↓   │
t=~1.5: └─ CRAG classify()  ────────┐  │ ↓   │ (search done)
                                    ↓  ↓ ↓   ↓
t=~2.5:   context assembled ← all tasks complete
t=~3.5:   LLM streaming begins
```

**Các bước:**
1. **Embed + Rewrite + Memory** — tất cả concurrent từ t=0
2. **Hybrid Search + LightRAG** — bắt đầu ngay khi embed xong
3. **CRAG** — bắt đầu ngay khi search xong (LightRAG vẫn chạy song song)
4. **Context Assembly + LLM** — khi tất cả tasks hoàn thành

---

## 1. Query Rewriting

**Method:** `_rewrite_query()`

Viết lại query của user thành dạng search-engine friendly trước khi mọi bước retrieval.

```
User:    "cái app này đăng nhập không được, nó báo lỗi tùm lum"
Rewrite: "lỗi không đăng nhập được ứng dụng mobile báo lỗi hệ thống"
```

- Model: `openai/gpt-5.4-nano` (`INTERNAL_LLM_MODEL`), temperature=0.1
- Chạy **concurrent** với embed — không nằm trên critical path
- Fallback: dùng query gốc nếu LLM call thất bại

> **HyDE & Multi-Query đã bị loại bỏ** khỏi pipeline mặc định để giảm latency (~2s tiết kiệm).
> - **HyDE** embed original query trực tiếp thay vì hypothesis text
> - **Multi-Query Variants** thay bằng single hybrid search với RRF (vector + FTS)

---

## 2. Hybrid Search + Reranking

**Method:** `_hybrid_search()`

### 2a. Vector Search (Semantic)
- Qdrant HNSW index, cosine similarity
- Query embedding: original query (embedded trực tiếp)

### 2b. Full-Text Search (BM25-style)
- Qdrant `MatchText` filter trên field `text`
- Query: original query (keyword-based)

### 2c. RRF Merge
- `initial_limit = top_k * 2` candidates từ mỗi search type
- Merge + deduplicate theo content fingerprint (200-char key)

### 2d. Cross-Encoder Reranking
- Model mặc định: `cross-encoder/ms-marco-MiniLM-L-6-v2` (88MB, ~0.5s CPU)
- Multilingual (tiếng Việt): set `RERANKER_MODEL=BAAI/bge-reranker-v2-m3` và chạy backend native trên M1/M2 Mac (dùng MPS GPU)
- Input: `top_k * 2` pairs của `(query, candidate_text)`
- Output: normalized sigmoid scores 0→1
- Auto-detect device: CUDA → MPS → CPU

---

## 5. Chunking Strategies

Mỗi domain có chunking strategy riêng, có thể override trong bot config.

### `recursive` — General, Sales
```
chunk_size    : 512 (general) | 256 (sales)
chunk_overlap : 64 (general)  | 32 (sales)
```
Chia theo hierarchy: `\n\n` → `\n` → `. ` → ` `. Default cho văn bản thông thường.

### `sentence` — Education
```
chunk_size    : 384
chunk_overlap : 32
```
Rolling-window accumulator — tích lũy câu đến khi đạt chunk_size. Bảo toàn paragraph coherence.

### `article` — Legal
```
chunk_size    : 1024
chunk_overlap : 128
```
Split tại Vietnamese article markers (`Điều N`) bằng regex. Sub-split bằng recursive nếu article quá dài. Giữ nguyên ranh giới điều luật.

### `parent_child`
```
parent_size   : chunk_size (e.g. 1024)
child_size    : chunk_size // 4 (e.g. 256)
```
- **Child chunks** nhỏ → precise semantic matching, embed child text
- **Parent text** lưu trong Qdrant payload → LLM nhận full context khi generate
- Kết quả: precision của child + context đầy đủ của parent

---

## 6. Contextual Retrieval (Anthropic Technique)

**Method:** `_generate_contextual_prefix_batch()`

**Vấn đề:** Chunk bị cắt khỏi document thường mất ngữ cảnh — không biết nó thuộc section nào.

**Giải pháp:**
Với mỗi chunk, generate 1-2 câu "situating context" dựa trên full document, prepend vào chunk **trước khi embed**.

```
BEFORE embedding:
  "Mức phạt này áp dụng trong vòng 30 ngày kể từ ngày vi phạm."

AFTER embedding (enriched):
  "Đây là quy định về hình thức xử phạt hành chính trong Chương III của Nghị định.
   Mức phạt này áp dụng trong vòng 30 ngày kể từ ngày vi phạm."
```

- Original chunk text vẫn được lưu cho display/citations
- Qdrant payload: `text` (original) + `context_prefix` (generated)
- Chạy parallel cho tất cả chunks via `asyncio.gather()`
- Cap at **50 chunks/document** để kiểm soát API cost
- Model: `openai/gpt-5.4-nano` (`INTERNAL_LLM_MODEL`), temperature=0.1, max_tokens=80
- Chạy tại **index time** (Celery task) — zero latency impact khi chat

---

## 7. CRAG — Corrective RAG

**Method:** `_crag_classify()`

**Vấn đề:** Khi knowledge base không có thông tin liên quan, LLM vẫn có thể hallucinate dựa trên irrelevant chunks.

**Giải pháp:**
1. Sau retrieval, gửi top-3 chunks + query đến LLM để classify
2. Inject signal vào system prompt để điều chỉnh LLM behavior

| Verdict | Trigger | Hành động |
|---------|---------|-----------|
| `relevant` | Chunks trả lời trực tiếp | Pipeline bình thường |
| `ambiguous` | Partial match, thiếu thông tin | LLM flag uncertainty, khuyến nghị verify |
| `no_context` | KB không có thông tin | LLM phải thông báo, KHÔNG tự chế câu trả lời |

- Model: `openai/gpt-5.4-nano` (`INTERNAL_LLM_MODEL`), temperature=0.0, max_tokens=16
- Chạy **concurrent** với LightRAG (không sequential sau search) — tiết kiệm ~1s
- Fallback: `"ambiguous"` — CRAG không bao giờ break pipeline
- Verdict xuất hiện trong `agent_logs` (visible trên frontend)

---

## 8. Domain Profiles

**File:** `backend/app/services/domain_config.py`

Mỗi bot có `domain` field (default: `general`). Domain profile tự động configure toàn bộ RAG pipeline.

| Domain | Strategy | Chunk Size | Retrieval K | LightRAG | Mode | KG Auto |
|--------|----------|------------|-------------|----------|------|---------|
| `general` | recursive | 512 | 10 | No | naive | No |
| `education` | sentence | 384 | 12 | Yes | local | Yes |
| `legal` | article | 1024 | 8 | Yes | hybrid | Yes |
| `sales` | recursive | 256 | 15 | No | naive | No |

**System prompt suffix per domain:**
- **Legal**: "Cite điều khoản bằng [[n]], dùng ngôn ngữ pháp lý, không đưa ra legal advice"
- **Education**: "Giải thích rõ ràng, có ví dụ, breakdown multi-step problems"
- **Sales**: "Nhấn mạnh lợi ích, persuasive, kết thúc bằng call-to-action rõ ràng"
- **General**: "Trả lời ngắn gọn, cite sources bằng [[n]]"

Mọi field đều có thể override trong bot config (`chunk_size`, `top_k`, `chunking_strategy`, ...).

---

## 9. Knowledge Graph (LightRAG)

Enabled khi `enable_knowledge_graph: true` (tự động bật với `education` và `legal`).

### Ingestion
```
Document text → LightRAG
  → LLM extract Entities + Relationships
  → Stored in backend/rag_storage/lightrag_{bot_id}/
```

### Query Modes

| Mode | Description | Best for |
|------|-------------|----------|
| `local` | Entity-centric traversal | Entity lookups, definitions |
| `global` | Global theme analysis | Topic summaries |
| `hybrid` | Local + Global | Legal docs, complex reasoning |
| `naive` | Simple KG-augmented | Fallback |

LightRAG query chạy **song song** với Hybrid Search — không tăng latency.

### Visualisation
`/bots/:id/graph` → KnowledgeGraphPage dùng `@react-sigma/core` + `graphology`

---

## 10. Persistent Memory (Mem0)

Extract và lưu **facts** từ mọi conversation (khác với history chỉ lưu N messages gần nhất).

```
User: "Tôi phụ trách team 50 người, đang triển khai ERP SAP"
  → Mem0 extract: ["User phụ trách team 50 người", "User triển khai ERP SAP"]
  → Session sau: retrieve top-5 memories → prepend vào system prompt
```

```env
MEM0_ENABLED=true
MEM0_TOP_K=5
MEM0_MEMORY_MODEL=openai/gpt-5.4-nano
```

---

## 11. Redis Response Cache

```
Cache key : MD5(bot_id + query_text)
TTL       : 1 giờ
```

**Invalidation:** Upload document mới → `invalidate_bot_cache(bot_id)` tự động.
**Bypass:** Header `X-No-Cache: true`

---

## Performance Guide

| Scenario | Recommendation |
|----------|---------------|
| Văn bản pháp lý tiếng Việt | Domain `legal` → `chunking_strategy=article` tự động |
| Tài liệu học thuật | Domain `education` → KG tự động bật |
| Product catalog | Domain `sales` → `top_k=15` tự động |
| Cần full context | `chunking_strategy=parent_child` |
| Low latency | `top_k=3`, tắt KG — target ~2s first token |
| Max accuracy | KG bật, `top_k=10+`, `parent_child` chunking, `RERANKER_MODEL=BAAI/bge-reranker-v2-m3` (native M1) |
| Production default | ~3.5s first token với full pipeline (rewrite+search+CRAG+rerank) |
| Cost tối ưu | Internal calls dùng `gpt-5.4-nano` tự động; chỉ answer model tốn chi phí chính |
