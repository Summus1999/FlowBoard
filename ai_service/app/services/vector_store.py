"""
Embedded vector store backed by ChromaDB.
Replaces pgvector — no server required.
"""

from typing import List, Optional, Tuple

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: Optional[chromadb.ClientAPI] = None
_COLLECTION_NAME = "rag_chunks"


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        persist_dir = settings.get_chroma_persist_dir()
        _client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        logger.info("vector_store.initialized", path=persist_dir)
    return _client


def get_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def upsert_embeddings(
    ids: List[str],
    embeddings: List[List[float]],
    documents: List[str],
    metadatas: Optional[List[dict]] = None,
):
    """Upsert chunk embeddings into ChromaDB."""
    col = get_collection()
    col.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


def delete_embeddings(ids: List[str]):
    """Delete embeddings by chunk IDs."""
    if not ids:
        return
    col = get_collection()
    col.delete(ids=ids)


def query_similar(
    query_embedding: List[float],
    top_k: int = 10,
    where: Optional[dict] = None,
) -> List[Tuple[str, float]]:
    """
    Query similar chunks by embedding vector.
    
    Returns:
        List of (chunk_id, similarity_score) sorted by relevance.
        Score is 1 - cosine_distance (higher = more similar).
    """
    col = get_collection()
    n_items = col.count()
    if n_items == 0:
        return []

    effective_k = min(top_k, n_items)
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=effective_k,
        where=where,
        include=["distances"],
    )

    ids = results["ids"][0] if results["ids"] else []
    distances = results["distances"][0] if results["distances"] else []

    # ChromaDB cosine distance = 1 - similarity; convert to similarity score
    scored = [(cid, 1.0 - dist) for cid, dist in zip(ids, distances)]
    return scored


def get_collection_count() -> int:
    col = get_collection()
    return col.count()
