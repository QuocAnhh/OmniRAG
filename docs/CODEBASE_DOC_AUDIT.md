# Codebase Doc Audit

Audit date: 2026-06-01.

## Source of truth checked

- `backend/app/core/config.py`
- `backend/app/services/openrouter_rag_service.py`
- `backend/app/api/v1/endpoints/bots.py`
- `backend/Dockerfile.hybrid`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `scripts/benchmark_opendataloader_pipeline.py`
- `/tmp/omnirag-odl-benchmark.json`

## Current runtime facts

| Area | Current codebase state |
| --- | --- |
| Qdrant | `qdrant/qdrant:v1.16.0`, default collection `omnirag_openrouter_collection_v3` |
| Retrieval | Dense OpenRouter vector + sparse FastEmbed BM25 vector, fused with Qdrant RRF, then cross-encoder rerank |
| PDF parsing | OpenDataLoader `format="markdown,json"`, `table_method="cluster"`, `reading_order="xycut"`, `image_output="external"`, `markdown_with_html=true` |
| Hybrid image | CPU-only by default, guarded against `nvidia-*` CUDA wheels |
| PDF metadata | Page numbers, bboxes, element types, heading path, OpenDataLoader element ids, artifact paths |
| Artifacts | Stable MinIO prefix `documents/{document_id}/extracted/...` |
| Supported uploads | `.pdf`, `.txt`, `.md`, `.csv`, `.docx`, `.pptx`, `.xlsx` |
| Legacy uploads | `.doc`, `.ppt`, `.xls` return `415` |
| Host ports | Compose ports are env-overridable, with defaults documented in README/startup docs |

## Markdown docs updated

- `README.md`
- `docs/PDF_PARSING.md`
- `docs/ADVANCED_RAG_FEATURES.md`
- `docs/ARCHITECTURE.md`
- `docs/STARTUP_GUIDE.md`
- `docs/FEATURES.md`
- `docs/API_REFERENCE.md`
- `docs/POSTMAN_GUIDE.md`
- `docs/INTEGRATION_SUMMARY.md`
- `docs/INTEGRATION_COMPLETE.md`
- `docs/DATABASE_GUIDE.md`
- `docs/TROUBLESHOOTING.md`

## Benchmark evidence

Latest local isolated E2E report: `/tmp/omnirag-odl-benchmark.json`.

Summary:

- Status: `passed`
- Compose project: `omnirag-odl-bench`
- Base URL: `http://localhost:18080`
- Collection: `omnirag_openrouter_collection_v3`
- Completed documents: MD, TXT, CSV, PDF, DOCX, XLSX
- Legacy `.doc`: blocked with `415`
- Total chunks: `6`
- Qdrant points: `6`
- Retrieval results: `5`
- Chat retrieved chunks: `5`
- Stream TTFT: `0.088s`

## Remaining stale/non-authoritative docs

- `docs/Decuong_OmniRAG_v4.docx` has been patched for the v3 RAG/OpenDataLoader/Qdrant/Telegram accuracy issues; backup: `docs/Decuong_OmniRAG_v4_before_accuracy_fix.docx`.
- `docs/Decuong_OmniRAG_v3.docx` still describes parts of the PDF/RAG flow as markdown-only and includes older thesis-level claims. It should not be treated as the runtime reference until regenerated.
- Known MatchText/pseudo-BM25 strings in diagram generators and `.drawio` sources were updated during this audit. Rendered images or embedded images should still be visually reviewed in Word/LibreOffice before formal submission.
- `scripts/update_decuong_ch4.py` was not fully audited in this pass; regenerate thesis `.docx` only after reviewing all thesis generator scripts.

For implementation truth, prefer the markdown docs listed above plus the code files under "Source of truth checked".
