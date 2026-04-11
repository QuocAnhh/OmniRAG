# OpenDataLoader PDF Integration

OmniRAG sử dụng **[opendataloader-pdf](https://github.com/opendataloader-project/opendataloader-pdf)** để parse PDF — thay thế PyPDFLoader cũ. Parser này cho chất lượng extract cao hơn đáng kể: table, heading hierarchy, multi-column layout, và bounding boxes.

---

## Tại sao thay đổi?

| | PyPDFLoader (cũ) | OpenDataLoader PDF (hiện tại) |
|--|------------------|-------------------------------|
| **Text extraction** | Basic, dễ lỗi reading order | XY-Cut++ deterministic, đúng thứ tự |
| **Tables** | Mất structure, chỉ raw text | #1 benchmark (0.928 accuracy) |
| **Heading hierarchy** | Không detect | H1/H2/H3... đầy đủ |
| **Multi-column** | Lộn xộn | Đúng reading order |
| **Bounding boxes** | Không có | Mỗi element có coordinates |
| **OCR (scanned PDF)** | Không hỗ trợ | Hybrid mode: 80+ ngôn ngữ |
| **Formula extraction** | Không | LaTeX qua Hybrid mode |
| **Tốc độ** | Nhanh | 0.015s/page (local mode) |

---

## Kiến trúc

```
PDF Upload
  │
  ↓
_load_document()                        ← openrouter_rag_service.py:254
  │
  ├── filename.endswith(".pdf")
  │     └── _load_pdf_opendataloader()  ← gọi opendataloader-pdf
  │           │
  │           ├── opendataloader_pdf.convert()
  │           │     input_path=[file], output_dir=tmp, format="markdown"
  │           │     ↓ Java JAR (bundled) chạy subprocess
  │           │     ↓ Output: structured Markdown file
  │           │
  │           ├── Success → trả về LangChainDocument
  │           │
  │           └── Fail → fallback PyPDFLoader (log warning)
  │
  └── filename.endswith(".txt")
        └── TextLoader (không đổi)
```

### Fallback mechanism

Nếu `opendataloader-pdf` không khả dụng (thiếu Java, import lỗi, output rỗng), system tự động fallback về `PyPDFLoader` — không crash, chỉ log warning.

```python
except (ImportError, FileNotFoundError, RuntimeError, Exception) as e:
    logger.warning(f"opendataloader-pdf unavailable ({e}), falling back to PyPDFLoader")
    return PyPDFLoader(file_path).load()
```

---

## Dependencies

### Python package
```
opendataloader-pdf>=2.0.0    # trong backend/requirements.txt
```

### System requirement
- **Java 21 JRE** — cài trong Docker image (`openjdk-21-jre-headless`)
- opendataloader-pdf bundled JAR gọi `java -jar` internally

### Docker image

`backend/Dockerfile` đã thêm Java vào cả builder và runtime stage:

```dockerfile
# Builder stage
RUN apt-get install -y openjdk-21-jre-headless

# Final stage
RUN apt-get install -y openjdk-21-jre-headless
```

---

## Output format

OpenDataLoader output **Markdown** — format tốt nhất cho RAG chunking:
- Heading hierarchy preserved (`#`, `##`, `###`)
- Tables giữ nguyên structure
- Đúng reading order (multi-column, sidebar)
- Lists (numbered, bulleted, nested)

Markdown output → fed vào `_chunk_documents()` → existing chunking strategies xử lý bình thường.

### So sánh output thực tế

**PyPDFLoader (cũ):**
```
Episodic memory in AI agents poses risks that should be studied and mitigated
Chad DeChant
Department of Computer Science ...
1. Introduction ...
```
→ Text dính liền, không phân biệt heading/paragraph/table

**OpenDataLoader PDF:**
```markdown
# Episodic memory in AI agents poses risks that should be studied and mitigated

Chad DeChant

Department of Computer Science ...

## 1. Introduction

...
```
→ Structure rõ ràng, chunking quality cao hơn

---

## Modes (hiện tại và tương lai)

### Local mode (đang dùng)
- Deterministic, không cần GPU
- 0.015s/page, chạy trên CPU
- Quality đã vượt trội so với PyPDFLoader
- Không cần thêm Docker service

### Hybrid mode (tương lai, optional)
- OCR cho scanned PDFs (80+ languages)
- Complex/borderless table extraction
- Formula extraction (LaTeX)
- Chart & image AI description
- Cần chạy Docling server riêng (port 5002)
- Enable: thêm service vào `docker-compose.yml` và set `hybrid="docling-fast"`

---

## Testing

### Chạy test trong Docker container

```bash
# Start services
docker compose up -d

# Copy PDF test vào container
docker cp test.pdf $(docker compose ps -q backend):/tmp/test.pdf

# Copy test script vào container (nằm ngoài backend/ volume)
docker cp scripts/test_pdf_parsing.py $(docker compose ps -q backend):/tmp/test_pdf_parsing.py

# Chạy test
docker compose exec backend python /tmp/test_pdf_parsing.py /tmp/test.pdf
```

### Test E2E (cần backend chạy)

```bash
docker compose exec backend python /tmp/test_pdf_parsing.py --e2e /tmp/test.pdf
```

### Test script chạy 3 bài kiểm tra:
1. **Direct parser** — convert PDF → Markdown, verify content
2. **Fallback** — verify PyPDFLoader vẫn hoạt động khi opendataloader-pdf lỗi
3. **E2E** (optional `--e2e` flag) — upload → ingest → chat

---

## Files đã thay đổi

| File | Thay đổi |
|------|----------|
| `backend/requirements.txt` | `pypdf` → `opendataloader-pdf>=2.0.0` |
| `backend/Dockerfile` | Thêm `openjdk-21-jre-headless` (builder + final stage) |
| `backend/app/services/openrouter_rag_service.py` | `_load_document()` → `_load_pdf_opendataloader()` + fallback |
| `scripts/test_pdf_parsing.py` | Integration test script mới |

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `java: command not found` | Java chưa cài | `apt-get install openjdk-21-jre-headless` |
| `opendataloader-pdf produced no markdown` | PDF corrupt hoặc empty | Check file, fallback tự động trigger |
| Docker build fail `openjdk-17 not available` | Debian Bookworm không có JDK 17 | Dùng `openjdk-21-jre-headless` |
| Slow first parse (~2-3s) | JVM startup cost | Normal — subsequent parses nhanh hơn |

---

## Tham khảo

- [OpenDataLoader PDF GitHub](https://github.com/opendataloader-project/opendataloader-pdf)
- [Benchmark results](https://github.com/opendataloader-project/opendataloader-bench) — #1 overall (0.907)
- [LangChain integration](https://github.com/opendataloader-project/langchain-opendataloader-pdf)
- CLAUDE.md — Document Processing Pipeline section
