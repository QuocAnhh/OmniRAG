# PDF Parsing

OmniRAG dùng OpenDataLoader để parse PDF trong document ingestion pipeline, đồng thời dùng các loader riêng cho TXT, MD, CSV, DOCX, PPTX và XLSX. Tài liệu này phản ánh codebase hiện tại sau audit ngày 2026-06-01.

## Luồng xử lý

```text
Upload file
  -> MinIO
  -> Celery task
  -> OpenDataLoader local/hybrid parser
  -> markdown + JSON element metadata + external images
  -> stable extracted artifacts in MinIO
  -> structured chunks with page/bbox metadata
  -> dense+sparse embeddings + Qdrant collection v3
```

## Hybrid service

`docker-compose.yml` build service:

```yaml
opendataloader-hybrid:
  build:
    context: ./backend
    dockerfile: Dockerfile.hybrid
  ports:
    - "${PDF_HYBRID_HOST_PORT:-5002}:5002"
  environment:
    - PDF_HYBRID_DEVICE=${PDF_HYBRID_DEVICE:-cpu}
    - PDF_HYBRID_FORCE_OCR=${PDF_HYBRID_FORCE_OCR:-false}
    - PDF_HYBRID_OCR_ENGINE=${PDF_HYBRID_OCR_ENGINE:-auto}
    - PDF_HYBRID_ENRICH_PICTURE=${PDF_HYBRID_ENRICH_PICTURE:-false}
    - PDF_HYBRID_ENRICH_FORMULA=${PDF_HYBRID_ENRICH_FORMULA:-false}
```

Không dùng image `opendataloader/pdf-hybrid:latest`. Repo build image riêng từ `backend/Dockerfile.hybrid`, cài CPU-only PyTorch trước rồi mới cài `opendataloader-pdf[hybrid]` để tránh kéo các wheel CUDA nhiều GB.

Backend/Celery env trong compose:

```env
PDF_TABLE_METHOD=cluster
PDF_READING_ORDER=xycut
PDF_IMAGE_OUTPUT=external
PDF_MARKDOWN_WITH_HTML=true
PDF_DEFAULT_PARSER_MODE=hybrid_auto
PDF_STRUCTURED_CHUNKING=true
PDF_HYBRID_MODE=docling-fast
PDF_HYBRID_URL=http://opendataloader-hybrid:5002
```

Config trong code còn có:

```env
PDF_IMAGE_FORMAT=png
PDF_PAGE_SEPARATOR="\n\n--- PAGE %page-number% ---\n\n"
PDF_HYBRID_FALLBACK=true
PDF_ENRICH_FORMULA=false
PDF_SANITIZE=false
PDF_USE_STRUCT_TREE=false
PDF_INCLUDE_HEADER_FOOTER=false
PDF_DETECT_STRIKETHROUGH=false
PDF_THREADS=1
```

Bot config có thể override các field PDF: `pdf_parser_mode`, `pdf_structured_chunking`, `pdf_enrich_formula`, `pdf_sanitize`, `pdf_use_struct_tree`, `pdf_include_header_footer`, `pdf_detect_strikethrough`, `pdf_threads` và `enrich_picture_description`. Khi bật picture/formula enrichment, parser dùng hybrid full mode.

## Dependency

`backend/requirements.txt` dùng:

```text
opendataloader-pdf>=2.4.7,<3.0
qdrant-client[fastembed]>=1.16.0,<2.0
```

Hybrid image dùng:

```text
opendataloader-pdf[hybrid]>=2.4.7,<3.0
```

## Table, image và formula

- `PDF_TABLE_METHOD=cluster`: ưu tiên nhận diện table tốt hơn border-only.
- `PDF_READING_ORDER=xycut`: dùng reading order layout-aware.
- `PDF_IMAGE_OUTPUT=external`: ảnh được xuất thành file reference thay vì nhúng base64.
- `PDF_MARKDOWN_WITH_HTML=true`: giữ bảng phức tạp tốt hơn trong markdown.
- `PDF_HYBRID_MODE=docling-fast`: dùng hybrid service cho OCR/formula/chart/image extraction khi có.
- `PDF_HYBRID_FALLBACK=true`: nếu hybrid service lỗi, backend fallback local mode.
- `PDF_ENRICH_FORMULA=false`: công thức không enrich mặc định.

OpenDataLoader convert call hiện dùng `format="markdown,json"` và không dùng option deprecated `markdown-with-images`.

## Structured chunks và artifacts

Nếu OpenDataLoader trả JSON elements, RAG service tạo chunks từ heading/paragraph/list/table/formula/image elements. Metadata chunk/payload gồm:

- `document_id`
- `page_numbers`
- `bboxes`
- `element_types`
- `heading_path`
- `opendataloader_element_ids`
- `has_structured_json`
- `artifact_paths`

Markdown, JSON và images được upload về MinIO dưới prefix ổn định:

```text
documents/{document_id}/extracted/...
```

Nếu JSON thiếu hoặc rỗng, backend fallback sang markdown/text chunking.

## Chunking sau parsing

Sau khi parse thành text/metadata, RAG service chunk tài liệu bằng strategy hiệu lực:

- `recursive`
- `sentence`
- `article`
- `parent_child`
- `semantic`

Domain templates có default strategy riêng. Nếu upload truyền `chunking_strategy=recursive`, backend có thể dùng config bot/domain để chọn strategy hiệu lực.

## Supported file types

Upload API hỗ trợ `.pdf`, `.txt`, `.md`, `.csv`, `.docx`, `.pptx`, `.xlsx`.

Legacy Office `.doc`, `.ppt`, `.xls` bị từ chối bằng `415` và yêu cầu convert sang `.docx`, `.pptx`, `.xlsx`.

## Debug

Kiểm tra service:

```bash
curl http://localhost:5002/health
docker compose logs --tail=100 opendataloader-hybrid
```

Kiểm tra Celery:

```bash
docker compose logs -f celery_worker
```

Kiểm tra document status:

```bash
docker compose exec db psql -U postgres -d omnirag -c "select filename,status,error_message from documents order by created_at desc limit 10;"
```

Nếu parse lỗi nhưng upload API vẫn trả thành công, hãy nhớ ingestion chạy bất đồng bộ. Lỗi thật thường nằm trong worker log và `documents.error_message`.

## E2E benchmark

Script benchmark isolated:

```bash
python scripts/benchmark_opendataloader_pipeline.py
```

Mặc định script dùng compose project `omnirag-odl-bench`, port gateway `18080`, collection `omnirag_openrouter_collection_v3`, generated fixtures và ghi report vào `/tmp/omnirag-odl-benchmark.json` + `/tmp/omnirag-odl-benchmark.md`.

Lần benchmark gần nhất trong workspace pass: 6 documents completed, 6 Qdrant points, retrieval 5 chunks, chat và stream đều hoạt động.
