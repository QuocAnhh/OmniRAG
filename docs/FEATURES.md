# ✨ OmniRAG Features

## Core Features
- ✅ **Multi-tenancy**: Hỗ trợ nhiều tổ chức với dữ liệu được tách biệt hoàn toàn
- ✅ **JWT Authentication**: Xác thực người dùng với token-based authentication
- ✅ **Role-Based Access Control (RBAC)**: Phân quyền owner/admin/member
- ✅ **Bot Management**: Tạo và quản lý nhiều chatbot với API key riêng
- ✅ **Document Processing**: Upload và xử lý PDF, DOCX, PPTX, TXT
- ⭐ **Golang API Gateway**: High-performance gateway với caching & rate limiting

## Advanced RAG Features
- ✅ **OpenRouter Integration**: Access 400+ AI models (GPT-4, Claude, Gemini, Llama...)
- ✅ **Unified Embeddings**: Single API for all embedding models
- ✅ **Hybrid Search**: Kết hợp vector search (semantic) và keyword matching
- ✅ **Query Transformation**: 
  - HyDE (Hypothetical Document Embeddings)
  - Multi-query generation
- ✅ **Advanced Chunking Strategies**:
  - Recursive splitting (800 chars, 200 overlap)
  - Semantic splitting (500 chars, 100 overlap)
- ✅ **Document Re-ranking**: Sắp xếp lại documents theo độ liên quan
- ✅ **Redis Caching**: Cache responses với TTL 1 giờ
- ✅ **Conversation History**: Hỗ trợ ngữ cảnh hội thoại (5 messages cuối)

## Infrastructure
- ⭐ **Golang Gateway**: High-performance API layer (10-50x faster I/O)
- ✅ **PostgreSQL**: Database chính với Alembic migrations
- ✅ **MongoDB**: Lưu chat logs và analytics
- ✅ **Redis**: Caching và Celery broker
- ✅ **Qdrant**: Vector database với HNSW indexing
- ✅ **MinIO**: S3-compatible object storage
- ✅ **Celery**: Background task processing
