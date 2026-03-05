import os
import logging
import asyncio
import numpy as np
from typing import List, Dict, Any, Optional

from lightrag import LightRAG, QueryParam
from lightrag.utils import EmbeddingFunc
from lightrag.llm.openai import openai_complete
from app.core.config import settings
from app.services.openrouter_service import get_openrouter_service

logger = logging.getLogger(__name__)

# ─── LightRAG LLM Config (OpenRouter) ────────────────────────────────────────
# Entity extraction uses OpenRouter (OpenAI-compatible) — fast, cheap.
# Recommended models for extraction (cost vs quality):
#   google/gemini-2.0-flash-001          → fastest, very cheap
#   openai/gpt-4o-mini                   → reliable, cheap
#   meta-llama/llama-3.1-8b-instruct     → free tier available
LIGHTRAG_LLM_MODEL    = os.getenv("LIGHTRAG_LLM_MODEL", "openai/gpt-4.1-mini")
LIGHTRAG_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

async def _global_embedding_func(texts: list[str]) -> np.ndarray:
    """
    Embedding function for LightRAG → OpenRouter.
    Regardless of how many texts LightRAG passes (even texts=1 per entity),
    we always send them as a single batched request to OpenRouter.
    """
    from app.services.openrouter_service import get_openrouter_service
    openrouter = get_openrouter_service()
    if not texts:
        return np.array([])
    logger.debug(f"LightRAG Embedding: {len(texts)} texts → 1 batched API call")
    try:
        embeddings = await asyncio.to_thread(
            openrouter.embed_batch,
            texts=texts          # OpenRouter handles up to 2048 texts per call
        )
        return np.array(embeddings)
    except Exception as e:
        logger.error(f"LightRAG Embedding error: {e}")
        raise

class OmniRAGTokenizer:
    """
    Lazy loading and picklable Tokenizer to prevent 'cannot pickle CoreBPE' error.
    """
    def __init__(self, model_name: str = "gpt-4o-mini"):
        self.model_name = model_name
        self._tokenizer = None

    @property
    def tokenizer(self):
        if self._tokenizer is None:
            import tiktoken
            self._tokenizer = tiktoken.encoding_for_model(self.model_name)
        return self._tokenizer

    def encode(self, content: str) -> list[int]:
        return self.tokenizer.encode(content)

    def decode(self, tokens: list[int]) -> list[str]:
        return self.tokenizer.decode(tokens)

    def __deepcopy__(self, memo):
        return OmniRAGTokenizer(self.model_name)

class LightRAGService:
    """
    Wrapper for LightRAG Core.
    - Entity/relationship extraction → OpenRouter API (fast, cheap)
    - Embeddings → OpenRouter (text-embedding-3-small, dim=1536)
    """
    
    def __init__(self, bot_id: str = "default_bot"):
        self.bot_id = bot_id
        self.working_dir = f"./rag_storage/lightrag_{bot_id}"
        
        if not os.path.exists(self.working_dir):
            os.makedirs(self.working_dir, exist_ok=True)
            
        logger.info(f"Initializing LightRAG [{LIGHTRAG_LLM_MODEL} via OpenRouter] → {self.working_dir}")

        self.rag = LightRAG(
            working_dir=self.working_dir,

            # ── LLM: OpenRouter (entity extraction) ──────────────────────────
            llm_model_name=LIGHTRAG_LLM_MODEL,
            llm_model_func=openai_complete,
            llm_model_kwargs={
                "base_url": LIGHTRAG_OPENROUTER_BASE_URL,
                "api_key": settings.OPENROUTER_API_KEY,
                "timeout": 120,
            },

            # ── Extraction tuning ─────────────────────────────────────────────
            entity_extract_max_gleaning=0,  # single-pass, saves ~50% calls
            llm_model_max_async=16,         # OpenRouter handles high concurrency
            chunk_token_size=1200,

            # ── Embedding tuning ──────────────────────────────────────────────────────
            embedding_batch_num=32,         # embed 32 entities per call (default=10)
            embedding_func_max_async=16,    # 16 concurrent embed calls (default=8)

            # ── Tokenizer for chunking (independent of inference model) ──────
            tokenizer=OmniRAGTokenizer("gpt-4"),

            # ── Embeddings: keep OpenRouter for dim=1536 consistency ─────────
            embedding_func=EmbeddingFunc(
                embedding_dim=1536,
                max_token_size=8192,
                func=_global_embedding_func
            ),
        )
        logger.info("LightRAG Core initialized successfully.")
            
    async def insert_text(self, text: str) -> Dict[str, Any]:
        """
        Extract Entities and Relationships from a raw text and insert to Graph.
        """
        start_time = asyncio.get_running_loop().time()
        logger.info("Starting LightRAG ingestion (Entity & Relationship Extraction)...")
        
        try:
            await self.rag.initialize_storages()
            await self.rag.ainsert(text)
            
            elapsed = asyncio.get_running_loop().time() - start_time
            logger.info(f"LightRAG ingestion complete in {elapsed:.2f}s.")
            return {
                "status": "success",
                "message": "Graph extracted successfully",
                "time_taken": round(elapsed, 2)
            }
        except Exception as e:
            logger.error(f"LightRAG Insert error: {e}")
            return {"status": "error", "message": str(e)}

    async def query(self, query_text: str, mode: str = "hybrid") -> str:
        """
        Retrieve raw context from the Knowledge Graph — NO LLM synthesis.
        LightRAG traverses the graph and returns relevant entity/relationship
        context which is then passed to OpenRouter for final answer generation.

        Modes: 'naive' (vector only), 'local' (specific nodes),
               'global' (broad ideas), 'hybrid' (local+global)
        """
        logger.info(f"Querying LightRAG Graph (context-only, no Ollama) mode='{mode}': {query_text}")
        try:
            await self.rag.initialize_storages()
            # only_need_context=True → returns raw graph context, skips LLM call
            # Final answer synthesis is handled by OpenRouter (API)
            context = await self.rag.aquery(
                query_text,
                param=QueryParam(mode=mode, only_need_context=True)
            )
            return context
        except Exception as e:
            import traceback
            logger.error(f"LightRAG Query error: {e}\n{traceback.format_exc()}")
            return f"Error querying Knowledge Graph: {str(e)}"

    def get_graph_data_for_ui(self) -> Dict[str, Any]:
        """
        Reads the local graph storage (NetworkX format) and returns standardized JSON nodes/links 
        for the React 3D/2D Force Graph.
        """
        import networkx as nx
        graph_file = os.path.join(self.working_dir, "graph_chunk_entity_relation.graphml")
        
        if not os.path.exists(graph_file):
            return {"nodes": [], "links": []}
            
        try:
            # LightRAG default saves to graphml
            G = nx.read_graphml(graph_file)
            
            nodes = []
            links = []
            
            for node, data in G.nodes(data=True):
                # LightRAG stores entity type as 'entity_type' in the graphml attributes
                raw_type = data.get("entity_type", data.get("type", "entity"))
                entity_type = raw_type.lower().strip().strip('"').strip("'") if raw_type else "entity"
                # description may contain multiple entries joined by <SEP>
                raw_desc = data.get("description", "")
                description = raw_desc.replace("<SEP>", "\n").strip() if raw_desc else ""
                nodes.append({
                    "id": str(node),
                    "name": str(node),
                    "type": entity_type,
                    "description": description,
                    "source_id": data.get("source_id", ""),
                    "file_path": data.get("file_path", ""),
                    "val": 1.5
                })
                
            for source, target, data in G.edges(data=True):
                # 'keywords' = short relation label (e.g. "uses", "extends")
                # 'description' = full sentence — use keywords for display, description for tooltip
                keywords = data.get("keywords", "")
                relation_label = keywords.split(",")[0].strip() if keywords else ""
                raw_edge_desc = data.get("description", "")
                edge_desc = raw_edge_desc.replace("<SEP>", "\n").strip() if raw_edge_desc else ""
                links.append({
                    "source": str(source),
                    "target": str(target),
                    "relation": relation_label,
                    "description": edge_desc,
                    "weight": data.get("weight", 1.0)
                })
                
            return {
                "nodes": nodes,
                "links": links
            }
        except Exception as e:
            logger.error(f"Error parsing graph data for UI: {e}")
            return {"nodes": [], "links": []}

_lightrag_instances: Dict[str, LightRAGService] = {}

def get_lightrag_service(bot_id: str) -> LightRAGService:
    """Get or create a cached LightRAGService instance per bot_id."""
    global _lightrag_instances
    if bot_id not in _lightrag_instances:
        _lightrag_instances[bot_id] = LightRAGService(bot_id=bot_id)
    return _lightrag_instances[bot_id]
