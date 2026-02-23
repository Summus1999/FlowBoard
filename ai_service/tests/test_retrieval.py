"""
检索服务测试
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.retrieval_service import RetrievalService, RetrievalResult
from app.services.retrieval_service_v2 import RetrievalServiceV2


class TestRetrievalService:
    """检索服务测试"""
    
    @pytest.mark.asyncio
    async def test_retrieve_empty_query(self):
        """测试空查询"""
        service = RetrievalService()
        
        # Mock数据库
        mock_db = AsyncMock()
        
        # 执行检索
        results = await service.retrieve("", mock_db)
        
        # 空查询应该返回空结果或处理异常
        assert isinstance(results, list)
    
    def test_rrf_fusion(self):
        """测试RRF融合"""
        service = RetrievalService()
        
        sparse = [("id1", 0.9), ("id2", 0.8), ("id3", 0.7)]
        dense = [("id2", 0.95), ("id1", 0.85), ("id4", 0.75)]
        
        fused = service._rrf_fusion(sparse, dense, k=60)
        
        # 应该返回4个结果
        assert len(fused) == 4
        
        # id1和id2应该排在前面（在两种检索中都出现）
        top_ids = [f[0] for f in fused[:2]]
        assert "id1" in top_ids or "id2" in top_ids
    
    def test_evaluate_confidence(self):
        """测试置信度评估"""
        service = RetrievalService()
        
        # 高分数结果
        high_results = [
            RetrievalResult("id1", "content", 0.95, "doc", None, None, "path", 1),
            RetrievalResult("id2", "content", 0.90, "doc", None, None, "path", 2),
        ]
        confidence = service.evaluate_confidence("query", high_results)
        assert confidence > 0.8
        
        # 低分数结果
        low_results = [
            RetrievalResult("id1", "content", 0.3, "doc", None, None, "path", 1),
        ]
        confidence = service.evaluate_confidence("query", low_results)
        assert confidence < 0.6
        
        # 空结果
        empty_results = []
        confidence = service.evaluate_confidence("query", empty_results)
        assert confidence == 0.0


class TestRetrievalServiceV2:
    """检索服务V2测试"""
    
    def test_normalize_query(self):
        """测试查询归一化"""
        service = RetrievalServiceV2()
        
        # 测试多余空白
        query = "  这是   一个   查询  "
        normalized = service._normalize_query(query)
        assert normalized == "这是 一个 查询"
        
        # 测试换行符
        query = "查询\n\n内容"
        normalized = service._normalize_query(query)
        assert "\n" not in normalized


class TestRRFFusion:
    """RRF融合测试"""
    
    def test_single_source(self):
        """测试单来源"""
        service = RetrievalService()
        
        sparse = [("id1", 0.9), ("id2", 0.8)]
        dense = []
        
        fused = service._rrf_fusion(sparse, dense)
        
        assert len(fused) == 2
        assert fused[0][0] == "id1"
    
    def test_equal_rank_boost(self):
        """测试相同排名的提升效果"""
        service = RetrievalService()
        
        # id1在两个列表中都是第1名
        sparse = [("id1", 0.9), ("id2", 0.8)]
        dense = [("id1", 0.85), ("id3", 0.75)]
        
        fused = service._rrf_fusion(sparse, dense)
        
        # id1应该排第一
        assert fused[0][0] == "id1"
        
        # 计算分数：id1 = 1/61 + 1/61 = 0.0328
        # id2 = 1/62 = 0.0161
        # id3 = 1/62 = 0.0161
        assert fused[0][1] > fused[1][1]
