import os
import sys

import pytest

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


def _service_without_init():
    OpenRouterRAGService = pytest.importorskip("app.services.openrouter_rag_service").OpenRouterRAGService
    svc = OpenRouterRAGService.__new__(OpenRouterRAGService)
    svc.collection_name = "test_collection"
    svc.embedding_dim = 1536
    svc.dense_vector_name = "dense"
    svc.sparse_vector_name = "bm25"
    svc.cache = None
    return svc


def test_opendataloader_convert_kwargs_use_v24_api(monkeypatch):
    rag_module = pytest.importorskip("app.services.openrouter_rag_service")
    svc = _service_without_init()

    monkeypatch.setattr(rag_module.settings, "PDF_HYBRID_MODE", "docling-fast")
    pdf_config = svc._resolve_pdf_runtime_config(
        bot_config={
            "pdf_parser_mode": "hybrid_auto",
            "pdf_structured_chunking": True,
            "pdf_enrich_formula": True,
        }
    )
    kwargs = svc._build_opendataloader_convert_kwargs(
        file_path="/tmp/in.pdf",
        output_dir="/tmp/out",
        image_dir="/tmp/out/images",
        pdf_config=pdf_config,
    )

    assert kwargs["format"] == "markdown,json"
    assert kwargs["markdown_with_html"] is True
    assert kwargs["image_output"] == "external"
    assert kwargs["table_method"] == "cluster"
    assert kwargs["reading_order"] == "xycut"
    assert kwargs["hybrid"] == "docling-fast"
    assert kwargs["hybrid_mode"] == "full"
    assert "markdown-with-images" not in str(kwargs)


def test_opendataloader_enrichment_forces_hybrid_full_when_global_hybrid_off(monkeypatch):
    rag_module = pytest.importorskip("app.services.openrouter_rag_service")
    svc = _service_without_init()

    monkeypatch.setattr(rag_module.settings, "PDF_HYBRID_MODE", "off")
    pdf_config = svc._resolve_pdf_runtime_config(
        bot_config={"pdf_parser_mode": "local_fast", "enrich_picture_description": True}
    )
    kwargs = svc._build_opendataloader_convert_kwargs(
        file_path="/tmp/in.pdf",
        output_dir="/tmp/out",
        image_dir="/tmp/out/images",
        pdf_config=pdf_config,
    )

    assert pdf_config["parser_mode"] == "hybrid_full"
    assert kwargs["hybrid"] == "docling-fast"
    assert kwargs["hybrid_mode"] == "full"


def test_response_cache_is_stateless_only():
    OpenRouterRAGService = pytest.importorskip("app.services.openrouter_rag_service").OpenRouterRAGService
    assert OpenRouterRAGService._is_response_cache_safe({"enable_memory": False}, []) is True
    assert OpenRouterRAGService._is_response_cache_safe({"enable_memory": True}, []) is False
    assert OpenRouterRAGService._is_response_cache_safe({"enable_memory": False, "user_id": "u1"}, []) is False
    assert OpenRouterRAGService._is_response_cache_safe({"enable_memory": False}, [{"role": "user", "content": "hi"}]) is False
    assert OpenRouterRAGService._is_response_cache_safe({"enable_memory": False, "group_recent_messages": [{"text": "x"}]}, []) is False


def test_process_file_sync_upsert_batches_uses_coroutine_wrapper(monkeypatch, tmp_path):
    LangChainDocument = pytest.importorskip("langchain_core.documents").Document
    rest = pytest.importorskip("qdrant_client.http.models")
    svc = _service_without_init()
    upload_calls = []
    uploaded_payloads = []

    class FakeOpenRouter:
        embedding_model = "openai/text-embedding-3-small"

        async def embed_batch_async(self, texts, batch_size=100):
            return [[0.0] * 1536 for _ in texts]

    class FakeGateway:
        async def upsert(self, collection_name, batch):
            upload_calls.append((collection_name, len(batch)))
            uploaded_payloads.extend(point.payload for point in batch)

    async def fake_prefixes(doc_text, chunk_texts, max_chunks=0):
        return [""] * len(chunk_texts)

    svc.openrouter = FakeOpenRouter()
    svc._generate_contextual_prefix_batch = fake_prefixes
    svc._chunk_documents = lambda documents, **kwargs: documents
    svc._embed_sparse_texts = lambda texts: [rest.SparseVector(indices=[1], values=[1.0]) for _ in texts]
    svc.invalidate_bot_cache = lambda bot_id: None

    import app.services.qdrant_gateway as qdrant_gateway

    monkeypatch.setattr(qdrant_gateway, "get_qdrant_gateway", lambda: FakeGateway())

    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello", encoding="utf-8")

    result = svc.process_file_sync(
        str(file_path),
        "bot-1",
        "doc.txt",
        preloaded_documents=[LangChainDocument(page_content="hello", metadata={})],
        document_id="doc-1",
    )

    assert result["vectors_inserted"] == 1
    assert upload_calls == [("test_collection", 1)]
    assert uploaded_payloads[0]["document_id"] == "doc-1"


def test_process_file_sync_payload_preserves_structured_metadata(monkeypatch, tmp_path):
    LangChainDocument = pytest.importorskip("langchain_core.documents").Document
    rest = pytest.importorskip("qdrant_client.http.models")
    svc = _service_without_init()
    uploaded_payloads = []

    class FakeOpenRouter:
        embedding_model = "openai/text-embedding-3-small"

        async def embed_batch_async(self, texts, batch_size=100):
            return [[0.0] * 1536 for _ in texts]

    class FakeGateway:
        async def upsert(self, collection_name, batch):
            uploaded_payloads.extend(point.payload for point in batch)

    async def fake_prefixes(doc_text, chunk_texts, max_chunks=0):
        return ["prefix"] * len(chunk_texts)

    svc.openrouter = FakeOpenRouter()
    svc._generate_contextual_prefix_batch = fake_prefixes
    svc._chunk_documents = lambda documents, **kwargs: documents
    svc._embed_sparse_texts = lambda texts: [rest.SparseVector(indices=[1], values=[1.0]) for _ in texts]
    svc.invalidate_bot_cache = lambda bot_id: None

    import app.services.qdrant_gateway as qdrant_gateway

    monkeypatch.setattr(qdrant_gateway, "get_qdrant_gateway", lambda: FakeGateway())

    file_path = tmp_path / "doc.pdf"
    file_path.write_text("hello", encoding="utf-8")
    metadata = {
        "source": "doc.pdf",
        "page_numbers": [2],
        "bboxes": [[10.0, 20.0, 30.0, 40.0]],
        "element_types": ["table"],
        "heading_path": ["Report"],
        "opendataloader_element_ids": ["el-2"],
        "has_structured_json": True,
        "artifact_paths": {"markdown": "documents/doc-1/extracted/doc.md"},
    }

    result = svc.process_file_sync(
        str(file_path),
        "bot-1",
        "doc.pdf",
        preloaded_documents=[LangChainDocument(page_content="Table:\nA | B", metadata=metadata)],
        document_id="doc-1",
    )

    assert result["vectors_inserted"] == 1
    payload = uploaded_payloads[0]
    assert payload["page_numbers"] == [2]
    assert payload["bboxes"] == [[10.0, 20.0, 30.0, 40.0]]
    assert payload["element_types"] == ["table"]
    assert payload["artifact_paths"] == {"markdown": "documents/doc-1/extracted/doc.md"}
    assert payload["metadata"]["heading_path"] == ["Report"]


def test_dimension_mismatch_never_deletes_collection(monkeypatch, tmp_path):
    LangChainDocument = pytest.importorskip("langchain_core.documents").Document
    rest = pytest.importorskip("qdrant_client.http.models")
    svc = _service_without_init()
    delete_called = False

    class FakeOpenRouter:
        embedding_model = "bad-embedding"

        async def embed_batch_async(self, texts, batch_size=100):
            return [[0.0] * 3 for _ in texts]

    class FakeQdrant:
        def delete_collection(self, *_args, **_kwargs):
            nonlocal delete_called
            delete_called = True

    async def fake_prefixes(doc_text, chunk_texts, max_chunks=0):
        return [""] * len(chunk_texts)

    svc.openrouter = FakeOpenRouter()
    svc.qdrant_client = FakeQdrant()
    svc._generate_contextual_prefix_batch = fake_prefixes
    svc._chunk_documents = lambda documents, **kwargs: documents
    svc._embed_sparse_texts = lambda texts: [rest.SparseVector(indices=[1], values=[1.0]) for _ in texts]

    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello", encoding="utf-8")

    with pytest.raises(Exception, match="Embedding dimension mismatch"):
        svc.process_file_sync(
            str(file_path),
            "bot-1",
            "doc.txt",
            preloaded_documents=[LangChainDocument(page_content="hello", metadata={})],
            document_id="doc-1",
        )

    assert delete_called is False


def test_opendataloader_json_normalizer_handles_kids_schema():
    svc = _service_without_init()
    docs = svc._documents_from_opendataloader_json(
        {
            "kids": [
                {
                    "type": "heading",
                    "id": 1,
                    "heading level": 1,
                    "page number": 1,
                    "bounding box": [1, 2, 3, 4],
                    "content": "Annual Report",
                },
                {
                    "type": "table",
                    "id": 2,
                    "page number": 1,
                    "bounding box": [10, 20, 30, 40],
                    "data": {"grid": [["Metric", "Value"], ["Revenue", "10"]]},
                },
                {
                    "type": "image",
                    "id": 3,
                    "page number": 2,
                    "bounding box": [5, 6, 7, 8],
                    "alt": "Bar chart showing revenue growth",
                },
            ]
        },
        source="report.pdf",
        artifact_paths={"json": "documents/doc-1/extracted/report.json"},
    )

    assert [doc.metadata["element_types"][0] for doc in docs] == ["heading", "table", "image"]
    assert docs[1].page_content.startswith("Table:")
    assert "Revenue | 10" in docs[1].page_content
    assert docs[1].metadata["heading_path"] == ["Annual Report"]
    assert docs[1].metadata["page_numbers"] == [1]
    assert docs[1].metadata["bboxes"] == [[10.0, 20.0, 30.0, 40.0]]
    assert docs[2].metadata["artifact_paths"]["json"] == "documents/doc-1/extracted/report.json"


def test_opendataloader_json_normalizer_handles_legacy_pages_schema():
    svc = _service_without_init()
    docs = svc._documents_from_opendataloader_json(
        {
            "pages": [
                {
                    "page_number": 3,
                    "elements": [
                        {
                            "type": "formula",
                            "id": "f-1",
                            "bbox": [1, 1, 2, 2],
                            "content": "E = mc^2",
                        }
                    ],
                }
            ]
        },
        source="formula.pdf",
    )

    assert len(docs) == 1
    assert docs[0].page_content == "Formula: E = mc^2"
    assert docs[0].metadata["page_numbers"] == [3]
    assert docs[0].metadata["bboxes"] == [[1.0, 1.0, 2.0, 2.0]]


def test_reindex_qdrant_v3_delegates_to_internal_v3_entrypoint(monkeypatch):
    document_tasks = pytest.importorskip("app.tasks.document_tasks")
    calls = []

    def fake_reindex_v2(bot_id=None, limit=None):
        calls.append((bot_id, limit))
        return {"status": "completed", "collection": "omnirag_openrouter_collection_v3"}

    monkeypatch.setattr(document_tasks, "reindex_qdrant_v2", fake_reindex_v2)

    result = document_tasks.reindex_qdrant_v3(bot_id="bot-1", limit=2)

    assert result["collection"].endswith("_v3")
    assert calls == [("bot-1", 2)]
