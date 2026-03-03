"""
FlowBoard Retrieval Service Tests
"""

import pytest
from unittest.mock import Mock, AsyncMock


class TestRetrievalService:
    """Test Retrieval Service"""

    @pytest.fixture
    def retrieval_service(self):
        """Create mock retrieval service"""
        class MockRetrievalService:
            def __init__(self):
                self.vector_store = Mock()
                self.keyword_store = Mock()
            
            async def hybrid_search(self, query, top_k=5, doc_ids=None):
                # Simulate hybrid search
                vector_results = await self.vector_search(query, top_k * 2, doc_ids)
                keyword_results = await self.keyword_search(query, top_k * 2, doc_ids)
                
                # RRF fusion
                fused = self._rrf_fusion(vector_results, keyword_results)
                return fused[:top_k]
            
            async def vector_search(self, query, top_k, doc_ids=None):
                return [
                    {"id": f"doc_{i}", "score": 0.9 - i * 0.1, "type": "vector"}
                    for i in range(min(top_k, 3))
                ]
            
            async def keyword_search(self, query, top_k, doc_ids=None):
                return [
                    {"id": f"doc_{i}", "score": 0.85 - i * 0.1, "type": "keyword"}
                    for i in range(min(top_k, 3))
                ]
            
            def _rrf_fusion(self, vector_results, keyword_results, k=60):
                scores = {}
                for rank, result in enumerate(vector_results):
                    doc_id = result["id"]
                    scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
                
                for rank, result in enumerate(keyword_results):
                    doc_id = result["id"]
                    scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
                
                sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
                return [{"id": doc_id, "score": score} for doc_id, score in sorted_results]
            
            async def rerank(self, query, results, top_n=5):
                # Simple rerank by score
                return sorted(results, key=lambda x: x.get("score", 0), reverse=True)[:top_n]
            
            async def retrieve_with_fallback(self, query, doc_ids=None, top_k=5):
                try:
                    return await self.hybrid_search(query, top_k, doc_ids)
                except Exception:
                    # Fallback to keyword only
                    return await self.keyword_search(query, top_k, doc_ids)
        
        return MockRetrievalService()

    # ============================================
    # Hybrid Search Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_rs_001_hybrid_search(self, retrieval_service):
        """Test hybrid search returns fused results"""
        results = await retrieval_service.hybrid_search("javascript closure", top_k=5)
        assert len(results) <= 5
        assert all("id" in r for r in results)
        assert all("score" in r for r in results)

    @pytest.mark.asyncio
    async def test_rs_002_hybrid_search_doc_filter(self, retrieval_service):
        """Test hybrid search with doc filter"""
        doc_ids = ["doc_1", "doc_2"]
        results = await retrieval_service.hybrid_search("test", top_k=3, doc_ids=doc_ids)
        # Should not fail with doc_ids parameter
        assert isinstance(results, list)

    # ============================================
    # Vector Search Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_rs_003_vector_search(self, retrieval_service):
        """Test vector search"""
        results = await retrieval_service.vector_search("test query", top_k=3)
        assert len(results) <= 3
        assert all(r["type"] == "vector" for r in results)

    # ============================================
    # Keyword Search Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_rs_004_keyword_search(self, retrieval_service):
        """Test keyword search"""
        results = await retrieval_service.keyword_search("test query", top_k=3)
        assert len(results) <= 3
        assert all(r["type"] == "keyword" for r in results)

    # ============================================
    # RRF Fusion Tests
    # ============================================
    
    def test_rs_005_rrf_fusion(self, retrieval_service):
        """Test RRF fusion algorithm"""
        vector_results = [
            {"id": "doc_1", "score": 0.9},
            {"id": "doc_2", "score": 0.8}
        ]
        keyword_results = [
            {"id": "doc_2", "score": 0.85},
            {"id": "doc_3", "score": 0.75}
        ]
        fused = retrieval_service._rrf_fusion(vector_results, keyword_results)
        assert len(fused) == 3
        # doc_2 appears in both, should have higher score
        doc_2_score = next(r["score"] for r in fused if r["id"] == "doc_2")
        doc_1_score = next(r["score"] for r in fused if r["id"] == "doc_1")
        assert doc_2_score > doc_1_score

    def test_rs_006_rrf_fusion_empty(self, retrieval_service):
        """Test RRF fusion with empty inputs"""
        fused = retrieval_service._rrf_fusion([], [])
        assert len(fused) == 0

    # ============================================
    # Rerank Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_rs_007_rerank_results(self, retrieval_service):
        """Test rerank results"""
        results = [
            {"id": "doc_2", "score": 0.7},
            {"id": "doc_1", "score": 0.9},
            {"id": "doc_3", "score": 0.5}
        ]
        reranked = await retrieval_service.rerank("query", results, top_n=2)
        assert len(reranked) == 2
        assert reranked[0]["id"] == "doc_1"  # Highest score

    @pytest.mark.asyncio
    async def test_rs_008_rerank_empty(self, retrieval_service):
        """Test rerank with empty results"""
        reranked = await retrieval_service.rerank("query", [], top_n=5)
        assert len(reranked) == 0

    # ============================================
    # Fallback Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_rs_009_retrieve_with_fallback_success(self, retrieval_service):
        """Test retrieve with fallback - success case"""
        results = await retrieval_service.retrieve_with_fallback("query", top_k=5)
        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_rs_010_retrieve_with_fallback_fail(self, retrieval_service):
        """Test retrieve with fallback - failure case"""
        # Make hybrid_search fail
        retrieval_service.hybrid_search = AsyncMock(side_effect=Exception("Vector DB down"))
        
        results = await retrieval_service.retrieve_with_fallback("query", top_k=5)
        # Should fallback to keyword search
        assert len(results) > 0
