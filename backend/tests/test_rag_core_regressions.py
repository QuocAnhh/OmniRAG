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

    class FakeOpenRouter:
        embedding_model = "openai/text-embedding-3-small"

        async def embed_batch_async(self, texts, batch_size=100):
            return [[0.0] * 1536 for _ in texts]

    class FakeGateway:
        async def upsert(self, collection_name, batch):
            upload_calls.append((collection_name, len(batch)))

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
