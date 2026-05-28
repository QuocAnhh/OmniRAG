# PDF Parsing

OmniRAG dùng OpenDataLoader để parse PDF/Office trong document ingestion pipeline. Tài liệu này mô tả trạng thái hiện tại của snapshot `refactor/backend-perf-p1-observability`.

## Luồng xử lý

```text
Upload file
  -> MinIO
  -> Celery task
  -> OpenDataLoader parser
  -> optional hybrid service :5002
  -> normalized text/images/tables
  -> chunking
  -> embeddings + Qdrant
```

## Hybrid service

`docker-compose.yml` build service:

```yaml
opendataloader-hybrid:
  build:
    context: ./backend
    dockerfile: Dockerfile.hybrid
  ports:
    - "5002:5002"
```

Không dùng image `opendataloader/pdf-hybrid:latest` trong snapshot này.

Backend/Celery env trong compose:

```env
PDF_TABLE_METHOD=cluster
PDF_IMAGE_OUTPUT=external
PDF_HYBRID_MODE=docling-fast
PDF_HYBRID_URL=http://opendataloader-hybrid:5002
```

Config trong code còn có:

```env
PDF_IMAGE_FORMAT=png
PDF_PAGE_SEPARATOR="\n\n--- PAGE %page-number% ---\n\n"
PDF_HYBRID_FALLBACK=true
PDF_ENRICH_FORMULA=false
```

`PDF_ENRICH_FORMULA` là biến enrichment công thức. Image description enrichment là logic theo bot/config trong RAG flow, không phải biến `PDF_ENRICH_PICTURE_DESCRIPTION`.

## Dependency

`backend/requirements.txt` dùng:

```text
opendataloader-pdf>=2.0.0
```

Không document package extra `[hybrid]` như dependency bắt buộc của snapshot này.

## Table, image và formula

- `PDF_TABLE_METHOD=cluster`: ưu tiên nhận diện table tốt hơn border-only.
- `PDF_IMAGE_OUTPUT=external`: ảnh được xuất thành file reference thay vì nhúng base64.
- `PDF_HYBRID_MODE=docling-fast`: dùng hybrid service cho OCR/formula/chart/image extraction khi có.
- `PDF_HYBRID_FALLBACK=true`: nếu hybrid service lỗi, backend fallback local mode.
- `PDF_ENRICH_FORMULA=false`: công thức không enrich mặc định.

## Chunking sau parsing

Sau khi parse thành text/metadata, RAG service chunk tài liệu bằng strategy hiệu lực:

- `recursive`
- `sentence`
- `article`
- `parent_child`
- `semantic`

Domain templates có default strategy riêng. Nếu upload truyền `chunking_strategy=recursive`, backend có thể dùng config bot/domain để chọn strategy hiệu lực.

## Debug

Kiểm tra service:

```bash
curl http://localhost:5002/health
docker compose logs --tail=100 opendataloader-hybrid
```

Kiểm tra Celery:

```bash
docker compose logs -f celery-worker
```

Kiểm tra document status:

```bash
docker compose exec db psql -U postgres -d omnirag -c "select filename,status,error_message from documents order by created_at desc limit 10;"
```

Nếu parse lỗi nhưng upload API vẫn trả thành công, hãy nhớ ingestion chạy bất đồng bộ. Lỗi thật thường nằm trong worker log và `documents.error_message`.
