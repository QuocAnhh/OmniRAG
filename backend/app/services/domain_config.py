"""
Domain Profile Registry — defines specialized RAG configurations per domain.
Each profile controls chunking strategy, retrieval parameters, LightRAG usage,
and a system-prompt suffix injected at chat time.
"""
from dataclasses import dataclass
from typing import Literal


@dataclass
class DomainProfile:
    name: str
    chunk_strategy: Literal["recursive", "article", "sentence", "parent_child"]
    chunk_size: int
    chunk_overlap: int
    retrieval_k: int       # number of chunks to retrieve
    rerank_top_n: int
    use_lightrag: bool
    system_prompt_suffix: str
    lightrag_mode: Literal["local", "global", "hybrid", "naive"]


DOMAIN_PROFILES: dict[str, DomainProfile] = {
    "general": DomainProfile(
        name="General",
        chunk_strategy="recursive",
        chunk_size=512,
        chunk_overlap=64,
        retrieval_k=10,
        rerank_top_n=5,
        use_lightrag=False,
        system_prompt_suffix=(
            "\n\nAnswer in a clear, concise manner. "
            "Cite your sources using [[n]] notation when referencing retrieved segments."
        ),
        lightrag_mode="naive",
    ),
    "education": DomainProfile(
        name="Education",
        chunk_strategy="sentence",
        chunk_size=384,
        chunk_overlap=32,
        retrieval_k=12,
        rerank_top_n=6,
        use_lightrag=True,
        system_prompt_suffix=(
            "\n\nYou are an educational assistant. Explain concepts clearly and thoroughly. "
            "Use examples to illustrate complex ideas. Reference specific sections using [[n]] notation. "
            "Break down multi-step problems step by step."
        ),
        lightrag_mode="local",
    ),
    "legal": DomainProfile(
        name="Legal",
        chunk_strategy="article",
        chunk_size=1024,
        chunk_overlap=128,
        retrieval_k=8,
        rerank_top_n=4,
        use_lightrag=True,
        system_prompt_suffix=(
            "\n\nYou are a legal information assistant. "
            "Always cite the specific article or clause using [[n]] notation. "
            "Use precise legal language. When referencing Vietnamese law, cite the article number (Điều) explicitly. "
            "Do NOT provide legal advice — only factual information from the provided documents."
        ),
        lightrag_mode="hybrid",
    ),
    "sales": DomainProfile(
        name="Sales",
        chunk_strategy="recursive",
        chunk_size=256,
        chunk_overlap=32,
        retrieval_k=15,
        rerank_top_n=7,
        use_lightrag=False,
        system_prompt_suffix=(
            "\n\nYou are a knowledgeable sales assistant. "
            "Focus on product benefits, pricing, and solutions to customer needs. "
            "Be persuasive yet honest. Highlight key features and value propositions from the retrieved context. "
            "Always suggest a clear next step or call to action."
        ),
        lightrag_mode="naive",
    ),
}


def get_domain_profile(domain: str) -> DomainProfile:
    """Return the DomainProfile for the given domain key, falling back to 'general'."""
    return DOMAIN_PROFILES.get(domain, DOMAIN_PROFILES["general"])
