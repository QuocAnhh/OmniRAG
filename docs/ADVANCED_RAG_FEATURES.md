# 🧠 Advanced RAG Features

This system implements several advanced RAG techniques to improve retrieval quality and generation accuracy.

## 1. Hybrid Search
Combines two search methods:
- **Vector Search**: Finds documents with semantic similarity (cosine similarity).
- **Keyword Matching**: Filters by metadata (e.g., specific bot ID).

## 2. Query Transformation

### HyDE (Hypothetical Document Embeddings)
Generates a "hypothetical answer" to the user's query and embeds that answer to find semantically similar real documents. This bridges the gap between questions and declarative statements in documents.

### Multi-Query Generation
Generates multiple variations of the user's query (rephrasing, different perspectives) to cast a wider net during retrieval.

## 3. Chunking Strategies

### Recursive (Default)
- **Chunk Size**: 800 characters
- **Overlap**: 200 characters
- **Best for**: General text, essays, articles.

### Semantic
- **Chunk Size**: 500 characters
- **Overlap**: 100 characters
- **Best for**: Structured documents, technical manuals, FAQs.

## 4. Document Re-ranking
After retrieving initial results from the vector database, an optional re-ranking step (using a cross-encoder or LLM) re-sorts the documents by relevance to the query.

## 5. Caching
Responses are cached in **Redis** with a TTL of 1 hour.
- **Key**: MD5 hash of `bot_id + query`
- **Invalidation**: Automatic on TTL expiry or new document uploads.

## 6. Conversation Memory
Maintains the last 5 messages in the conversation history to allow follow-up questions and context-aware answers.
