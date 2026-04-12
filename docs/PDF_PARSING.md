# OpenDataLoader PDF — Full Integration

OmniRAG sử dụng **[opendataloader-pdf](https://github.com/opendataloader-project/opendataloader-pdf)** với **tất cả tính năng** để parse PDF — cluster table detection, image extraction, SmolVLM AI image descriptions, dual markdown+JSON output, page separators, và optional OCR/formula extraction.

---

## Tại sao full integration?

| | PyPDFLoader (cũ) | Basic MD (trước) | **Full Integration (hiện tại)** |
|--|------------------|-------------------|----------------------------------|
| **Text extraction** | Basic, lỗi reading order | XY-Cut++ đúng thứ tự | XY-Cut++ + page separators |
| **Tables** | Mất structure | Border detection | **Cluster detection** (border + cluster) |
| **Images** | Mất hoàn toàn | Mất | **Extract PNG/JPEG + AI descriptions** |
| **Image descriptions** | Không | Không | **SmolVLM 256M — mô tả charts, figures** |
| **Heading hierarchy** | Không | Có | Có |
| **Bounding boxes** | Không | Không | **JSON output — mỗi element có coordinates** |
| **Structured tables** | Không | Không | **JSON — rows, cells, row/column spans** |
| **OCR (scanned PDF)** | Không | Không | **80+ ngôn ngữ via hybrid mode** |
| **Formula extraction** | Không | Không | **LaTeX via hybrid mode** |
| **Page boundaries** | Không | Không | **PAGE separator trong markdown** |
| **Tốc độ** | Nhanh | 0.015s/page | 0.015s/page (local) / ~0.5s/page (hybrid) |

---

## Kiến trúc

```
PDF Upload
  │
  ↓
_load_pdf_opendataloader()              ← openrouter_rag_service.py
  │
  ├── opendataloader_pdf.convert()
  │     format="markdown-with-images,json"
  │     table_method="cluster"
  │     image_output="external"
  │     markdown_page_separator
  │     hybrid="docling-fast" (nếu enabled)
  │     enrich_picture_description=True
  │     ↓ Java JAR (bundled) + Hybrid AI server
  │
  ├── Output 1: markdown-with-images   ← SINGLE FILE cho LLM
  │     Text + heading hierarchy + tables
  │     + image references inline
  │     + SmolVLM image/chart descriptions (hybrid)
  │     + LaTeX formulas (hybrid)
  │     + page separators
  │     ↓
  │     → _chunk_documents() → contextual prefix → embed → Qdrant
  │     → LLM nhận MỘT file markdown đầy đủ text + mô tả ảnh
  │
  ├── Output 2: JSON                   ← Structured data
  │     Tables: rows → cells, row/column spans
  │     Headings: level hierarchy
  │     Images: source path, format, bounding box
  │     All elements: type, id, page number, bbox
  │     ↓
  │     → Upload MinIO (dùng cho table QA, structured search)
  │
  └── Output 3: Images/                ← Extracted image files
        figure_1.png, chart_2.png, ...
        ↓
        → Upload MinIO (dùng cho frontend display)
```

### Lưu ý quan trọng

- **Markdown-with-images** là SINGLE FILE duy nhất ném cho LLM qua RAG pipeline
- SmolVLM tự động tạo **mô tả text** cho mỗi hình/charts → LLM "nhìn thấy" ảnh qua text
- JSON và image files lưu MinIO cho future use (frontend, structured search, table QA)
- Fallback chain: hybrid → local → PyPDFLoader

---

## Configuration

Tất cả config trong `backend/app/core/config.py` (hoặc `.env`):

| Setting | Default | Mô tả |
|---------|---------|-------|
| `PDF_TABLE_METHOD` | `cluster` | `default` (border-only) \| `cluster` (border + cluster detection) |
| `PDF_IMAGE_OUTPUT` | `external` | `off` \| `embedded` (base64) \| `external` (file references) |
| `PDF_IMAGE_FORMAT` | `png` | `png` \| `jpeg` |
| `PDF_PAGE_SEPARATOR` | `\n\n--- PAGE %page-number% ---\n\n` | Separator giữa các page trong markdown |
| `PDF_HYBRID_MODE` | `docling-fast` | `off` \| `docling-fast` (AI-powered) |
| `PDF_HYBRID_URL` | `http://opendataloader-hybrid:5002` | Hybrid server URL |
| `PDF_HYBRID_FALLBACK` | `True` | Fall back to local mode nếu hybrid unavailable |
| `PDF_ENRICH_PICTURE_DESCRIPTION` | `True` | SmolVLM AI descriptions cho images/charts |
| `PDF_ENRICH_FORMULA` | `False` | LaTeX formula extraction (cần hybrid_mode=full) |

### Override per-bot

```
# Trong .env hoặc docker-compose.yml environment
PDF_HYBRID_MODE=off              # Tắt hybrid, chỉ dùng local deterministic
PDF_TABLE_METHOD=default          # Dùng border-only (nhanh hơn cluster)
PDF_ENRICH_PICTURE_DESCRIPTION=False  # Không generate image descriptions
```

---

## Hybrid Mode

### Khi nào cần?

| Tình huống | Hybrid? | Lý do |
|------------|---------|-------|
| Digital PDF (bình thường) | Optional | Local mode đã tốt, hybrid thêm image descriptions |
| Complex/borderless tables | Recommended | Cluster detection + AI table structure |
| Scanned PDF (ảnh scan) | **Bắt buộc** | OCR không hoạt động ở local mode |
| Non-English scanned PDF | **Bắt buộc** | OCR + `--ocr-lang "vi,en"` |
| Công thức toán học | Recommended | LaTeX formula extraction |
| Charts/figures cần mô tả | Recommended | SmolVLM AI descriptions |

### Setup Hybrid Server

Docker Compose đã có sẵn service `opendataloader-hybrid`:

```yaml
# docker-compose.yml
opendataloader-hybrid:
  image: opendataloader/pdf-hybrid:latest
  ports:
    - "5002:5002"
  restart: unless-stopped
```

Backend + Celery worker tự động kết nối đến `http://opendataloader-hybrid:5002`.

Nếu hybrid server unavailable, system tự fallback sang local mode (`PDF_HYBRID_FALLBACK=True`).

### Hybrid with GPU

```yaml
opendataloader-hybrid:
  image: opendataloader/pdf-hybrid:latest
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            capabilities: [gpu]
```

GPU tăng tốc OCR + SmolVLM chart description đáng kể.

---

## JSON Output Schema

Mỗi PDF element có cấu trúc:

```json
{
  "type": "table",
  "id": "table_1",
  "page": 3,
  "bbox": [72.0, 450.2, 520.0, 620.5],
  "rows": [
    {
      "cells": [
        {"content": "Header 1", "row_span": 1, "column_span": 1},
        {"content": "Header 2", "row_span": 1, "column_span": 2}
      ]
    }
  ]
}
```

```json
{
  "type": "image",
  "id": "image_5",
  "page": 7,
  "bbox": [100.0, 200.0, 400.0, 500.0],
  "source": "images/figure_5.png",
  "format": "png"
}
```

```json
{
  "type": "heading",
  "id": "heading_2",
  "page": 1,
  "bbox": [72.0, 700.0, 400.0, 720.0],
  "heading_level": 2,
  "content": "1. Introduction"
}
```

---

## Testing

### Direct parser test (no backend needed)

```bash
# Start services
docker compose up -d

# Copy PDF test vào container
docker cp test.pdf $(docker compose ps -q backend):/tmp/test.pdf

# Copy test script
docker cp scripts/test_pdf_parsing.py $(docker compose ps -q backend):/tmp/test_pdf_parsing.py

# Run test
docker compose exec backend python /tmp/test_pdf_parsing.py /tmp/test.pdf
```

### E2E test (requires backend)

```bash
docker compose exec backend python /tmp/test_pdf_parsing.py --e2e /tmp/test.pdf
```

### Test suite covers:

1. **Direct parser** — cluster tables, dual markdown+json, image extraction, page separators
2. **Fallback** — PyPDFLoader works when opendataloader-pdf unavailable
3. **Hybrid fallback** — graceful degradation when hybrid server unreachable
4. **E2E** (optional) — upload → ingest → chat

---

## Files

| File | Vai trò |
|------|---------|
| `backend/app/core/config.py` | PDF settings (table method, hybrid, image output) |
| `backend/app/services/openrouter_rag_service.py` | `_load_pdf_opendataloader()` + MinIO upload helpers |
| `backend/app/tasks/document_tasks.py` | Celery task, passes `has_structured_json` metadata |
| `docker-compose.yml` | Hybrid server service + PDF env vars |
| `backend/requirements.txt` | `opendataloader-pdf[hybrid]>=2.0.0` |
| `backend/Dockerfile` | Java 21 JRE for opendataloader-pdf JAR |
| `scripts/test_pdf_parsing.py` | Integration test |

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `java: command not found` | Java chưa cài | `apt-get install openjdk-21-jre-headless` |
| `opendataloader-pdf produced no markdown` | PDF corrupt/empty | Check file, fallback tự trigger |
| Hybrid server connection refused | Server chưa start | `docker compose up -d opendataloader-hybrid` |
| Images không được extract | `PDF_IMAGE_OUTPUT=off` | Set `PDF_IMAGE_OUTPUT=external` |
| Table structure sai | Border-only detection | Set `PDF_TABLE_METHOD=cluster` |
| Scanned PDF không có text | Cần OCR | Set `PDF_HYBRID_MODE=docling-fast` |
| Slow first parse (~2-3s) | JVM startup cost | Normal — subsequent parses nhanh hơn |
| `opendataloader-pdf[hybrid]` install fail | Missing build deps | `pip install torch` trước hoặc dùng CPU wheel |

---

## Tham khảo

- [OpenDataLoader PDF GitHub](https://github.com/opendataloader-project/opendataloader-pdf)
- [Benchmark results](https://github.com/opendataloader-project/opendataloader-bench) — #1 overall (0.907)
- [LangChain integration](https://github.com/opendataloader-project/langchain-opendataloader-pdf)
- CLAUDE.md — Document Processing Pipeline section
