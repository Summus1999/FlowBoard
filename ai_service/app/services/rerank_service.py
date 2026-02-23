"""
Rerank服务
实现基于Cross-Encoder和LLM的重排序
"""

import asyncio
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import json

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import get_model_gateway, ModelProfile

logger = get_logger(__name__)


@dataclass
class RankedDocument:
    """排序后的文档"""
    doc_id: str
    content: str
    score: float  # 重排序分数
    original_rank: int
    metadata: Dict[str, Any]


class CrossEncoderReranker:
    """
    Cross-Encoder重排序器
    
    使用LLM作为Cross-Encoder计算查询-文档相关性分数
    """
    
    def __init__(self, batch_size: int = 8):
        self.batch_size = batch_size
        self.model_gateway = get_model_gateway()
    
    async def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[RankedDocument]:
        """
        重排序文档
        
        Args:
            query: 查询文本
            documents: 候选文档列表，每项包含id, content, metadata
            top_k: 返回Top-K结果
        
        Returns:
            重排序后的文档列表
        """
        if not documents:
            return []
        
        logger.info("rerank.start", query=query[:50], doc_count=len(documents))
        
        # 批量计算相关性分数
        scores = await self._compute_scores_batch(query, documents)
        
        # 构建排序结果
        ranked = []
        for i, (doc, score) in enumerate(zip(documents, scores)):
            ranked.append(RankedDocument(
                doc_id=doc["id"],
                content=doc["content"],
                score=score,
                original_rank=i,
                metadata=doc.get("metadata", {}),
            ))
        
        # 按分数排序
        ranked.sort(key=lambda x: x.score, reverse=True)
        
        logger.info("rerank.complete", top_score=ranked[0].score if ranked else 0)
        
        return ranked[:top_k]
    
    async def _compute_scores_batch(
        self,
        query: str,
        documents: List[Dict[str, Any]],
    ) -> List[float]:
        """批量计算相关性分数"""
        # 分批处理
        batches = [
            documents[i:i+self.batch_size]
            for i in range(0, len(documents), self.batch_size)
        ]
        
        all_scores = []
        
        for batch in batches:
            batch_scores = await self._compute_scores(query, batch)
            all_scores.extend(batch_scores)
        
        return all_scores
    
    async def _compute_scores(
        self,
        query: str,
        documents: List[Dict[str, Any]],
    ) -> List[float]:
        """
        使用LLM计算相关性分数
        
        返回0-1之间的相关性分数
        """
        scores = []
        
        for doc in documents:
            # 构建prompt
            prompt = f"""评估以下查询和文档的相关性。

查询：{query}

文档：{doc['content'][:500]}...

请输出JSON格式：{{"relevance": 0.0-1.0, "reason": "简要说明"}}

其中relevance表示相关性分数：
- 1.0: 完全相关，直接回答查询
- 0.7-0.9: 高度相关，包含关键信息
- 0.4-0.6: 部分相关，有一定关联
- 0.1-0.3: 低度相关，关联较弱
- 0.0: 不相关"""
            
            try:
                from langchain_core.messages import HumanMessage
                
                response = await self.model_gateway.generate(
                    messages=[HumanMessage(content=prompt)],
                    model_profile=ModelProfile.COST_EFFECTIVE,
                    temperature=0.1,
                )
                
                # 解析分数
                score = self._parse_score(response.content)
                scores.append(score)
                
            except Exception as e:
                logger.warning("rerank.score_compute_failed", error=str(e))
                # 失败时返回中等分数
                scores.append(0.5)
        
        return scores
    
    def _parse_score(self, text: str) -> float:
        """从响应中解析分数"""
        import re
        
        try:
            # 尝试提取JSON
            json_match = re.search(r'\{[^}]+\}', text)
            if json_match:
                data = json.loads(json_match.group())
                score = data.get("relevance", 0.5)
                return max(0.0, min(1.0, float(score)))
        except Exception:
            pass
        
        # 尝试直接提取数字
        numbers = re.findall(r'0\.\d+', text)
        if numbers:
            return max(0.0, min(1.0, float(numbers[0])))
        
        return 0.5


class LLMReranker:
    """
    LLM Pointwise重排序器
    
    使用LLM判断每个文档是否相关
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[RankedDocument]:
        """重排序"""
        logger.info("llm_rerank.start", doc_count=len(documents))
        
        # 并行处理所有文档
        tasks = [
            self._judge_relevance(query, doc, i)
            for i, doc in enumerate(documents)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤异常并排序
        ranked = []
        for result in results:
            if isinstance(result, RankedDocument):
                ranked.append(result)
        
        ranked.sort(key=lambda x: x.score, reverse=True)
        
        logger.info("llm_rerank.complete", result_count=len(ranked))
        
        return ranked[:top_k]
    
    async def _judge_relevance(
        self,
        query: str,
        doc: Dict[str, Any],
        original_rank: int,
    ) -> RankedDocument:
        """判断单个文档的相关性"""
        prompt = f"""判断以下文档是否与查询相关。

查询：{query}

文档：{doc['content'][:400]}...

请回答：是/否/部分

并简要说明原因。"""
        
        try:
            from langchain_core.messages import HumanMessage
            
            response = await self.model_gateway.generate(
                messages=[HumanMessage(content=prompt)],
                model_profile=ModelProfile.COST_EFFECTIVE,
                temperature=0.1,
            )
            
            content = response.content.lower()
            
            # 映射到分数
            if "是" in content or "yes" in content or "相关" in content:
                score = 0.9
            elif "部分" in content or "partial" in content:
                score = 0.6
            else:
                score = 0.2
            
            return RankedDocument(
                doc_id=doc["id"],
                content=doc["content"],
                score=score,
                original_rank=original_rank,
                metadata=doc.get("metadata", {}),
            )
            
        except Exception as e:
            logger.warning("llm_rerank.judge_failed", error=str(e))
            return RankedDocument(
                doc_id=doc["id"],
                content=doc["content"],
                score=0.5,
                original_rank=original_rank,
                metadata=doc.get("metadata", {}),
            )


class RerankService:
    """
    重排序服务
    
    根据配置选择合适的rerank策略
    """
    
    def __init__(self):
        self.cross_encoder = CrossEncoderReranker()
        self.llm_reranker = LLMReranker()
        self.strategy = "cross_encoder"  # cross_encoder, llm, none
    
    async def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5,
        strategy: str = None,
    ) -> List[RankedDocument]:
        """
        重排序文档
        
        Args:
            query: 查询文本
            documents: 候选文档
            top_k: 返回数量
            strategy: 重排序策略
        
        Returns:
            排序后的文档
        """
        strategy = strategy or self.strategy
        
        if strategy == "none" or not documents:
            # 不重排，只取top_k
            return [
                RankedDocument(
                    doc_id=d["id"],
                    content=d["content"],
                    score=d.get("score", 0.5),
                    original_rank=i,
                    metadata=d.get("metadata", {}),
                )
                for i, d in enumerate(documents[:top_k])
            ]
        
        elif strategy == "cross_encoder":
            return await self.cross_encoder.rerank(query, documents, top_k)
        
        elif strategy == "llm":
            return await self.llm_reranker.rerank(query, documents, top_k)
        
        else:
            raise ValueError(f"Unknown rerank strategy: {strategy}")


# 全局服务实例
_rerank_service: Optional[RerankService] = None


def get_rerank_service() -> RerankService:
    """获取重排序服务单例"""
    global _rerank_service
    if _rerank_service is None:
        _rerank_service = RerankService()
    return _rerank_service
