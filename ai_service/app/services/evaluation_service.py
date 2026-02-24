"""
检索评估服务
实现检索命中率评测和问答质量评估
"""

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
import statistics

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.config import settings
from app.models.rag import RetrievalLog

logger = get_logger(__name__)


@dataclass
class RetrievalMetrics:
    """检索指标"""
    total_queries: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    
    # 命中率相关
    hit_rate: float  # 有结果返回的比例
    high_confidence_rate: float  # 高置信度比例(>0.9)
    medium_confidence_rate: float  # 中等置信度比例(0.7-0.9)
    low_confidence_rate: float  # 低置信度比例(<0.7)
    
    # 引用相关
    avg_citations_per_query: float
    citation_usage_rate: float  # 回答中使用引用的比例


@dataclass
class EvaluationResult:
    """评估结果"""
    query: str
    expected_answer: str
    actual_answer: str
    retrieved_chunks: List[Dict]
    
    # 自动评估分数
    relevance_score: float  # 检索相关性
    coverage_score: float  # 内容覆盖度
    citation_score: float  # 引用质量
    overall_score: float  # 综合分数
    
    # 人工标注（可选）
    human_rating: Optional[int] = None  # 1-5星
    notes: Optional[str] = None


class RetrievalEvaluator:
    """检索评估器"""
    
    def __init__(self):
        self.model_gateway = None  # 延迟初始化
    
    async def evaluate_retrieval_quality(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        db: AsyncSession,
    ) -> Dict[str, float]:
        """
        评估检索质量
        
        评估维度：
        1. 相关性：检索结果与查询的相关程度
        2. 多样性：结果是否来自不同文档
        3. 覆盖度：是否覆盖查询的多个方面
        """
        if not retrieved_chunks:
            return {
                "relevance": 0.0,
                "diversity": 0.0,
                "coverage": 0.0,
                "overall": 0.0,
            }
        
        # 计算相关性分数
        relevance = self._calculate_relevance(query, retrieved_chunks)
        
        # 计算多样性分数
        diversity = self._calculate_diversity(retrieved_chunks)
        
        # 计算覆盖度分数
        coverage = self._calculate_coverage(query, retrieved_chunks)
        
        # 综合分数
        overall = (relevance * 0.5 + diversity * 0.2 + coverage * 0.3)
        
        return {
            "relevance": round(relevance, 2),
            "diversity": round(diversity, 2),
            "coverage": round(coverage, 2),
            "overall": round(overall, 2),
        }
    
    def _calculate_relevance(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
    ) -> float:
        """计算相关性分数"""
        if not chunks:
            return 0.0
        
        # 使用检索分数的平均值
        scores = [c.get("score", 0) for c in chunks]
        return sum(scores) / len(scores) if scores else 0.0
    
    def _calculate_diversity(self, chunks: List[Dict[str, Any]]) -> float:
        """计算多样性分数"""
        if not chunks:
            return 0.0
        
        # 统计来源文档数量
        sources = set()
        for chunk in chunks:
            source = chunk.get("doc_name") or chunk.get("source")
            if source:
                sources.add(source)
        
        # 多样性 = 不同来源数 / 总结果数
        diversity = len(sources) / len(chunks) if chunks else 0.0
        
        # 归一化到0-1
        return min(1.0, diversity)
    
    def _calculate_coverage(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
    ) -> float:
        """计算覆盖度分数（简化实现）"""
        # 提取查询关键词
        keywords = self._extract_keywords(query)
        
        if not keywords:
            return 1.0
        
        # 检查关键词在结果中的覆盖情况
        covered_keywords = set()
        for chunk in chunks:
            content = chunk.get("content", "").lower()
            for kw in keywords:
                if kw.lower() in content:
                    covered_keywords.add(kw)
        
        coverage = len(covered_keywords) / len(keywords) if keywords else 1.0
        return coverage
    
    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词（简化实现）"""
        # 去除停用词，保留有意义的名词
        stopwords = {"的", "是", "在", "和", "了", "什么", "怎么", "如何", "为什么"}
        
        words = []
        for word in text.split():
            word = word.strip("。？！，.,!?")
            if len(word) > 1 and word not in stopwords:
                words.append(word)
        
        return words[:5]  # 最多取5个关键词
    
    async def generate_evaluation_report(
        self,
        db: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """生成评估报告"""
        # 查询检索日志
        query = select(RetrievalLog)
        
        if start_date:
            query = query.where(RetrievalLog.created_at >= start_date)
        if end_date:
            query = query.where(RetrievalLog.created_at <= end_date)
        
        result = await db.execute(query)
        logs = result.scalars().all()
        
        if not logs:
            return {
                "period": f"{start_date} to {end_date}",
                "total_queries": 0,
                "message": "无数据",
            }
        
        # 计算指标
        latencies = [log.latency_ms for log in logs]
        
        metrics = RetrievalMetrics(
            total_queries=len(logs),
            avg_latency_ms=statistics.mean(latencies),
            p50_latency_ms=statistics.median(latencies),
            p95_latency_ms=self._percentile(latencies, 95),
            p99_latency_ms=self._percentile(latencies, 99),
            hit_rate=self._calculate_hit_rate(logs),
            high_confidence_rate=0.0,  # 需要额外数据
            medium_confidence_rate=0.0,
            low_confidence_rate=0.0,
            avg_citations_per_query=0.0,
            citation_usage_rate=0.0,
        )
        
        return {
            "period": f"{start_date} to {end_date}",
            "metrics": asdict(metrics),
            "recommendations": self._generate_recommendations(metrics),
        }
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """计算百分位数"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def _calculate_hit_rate(self, logs: List[RetrievalLog]) -> float:
        """计算命中率"""
        if not logs:
            return 0.0
        
        hits = sum(1 for log in logs if log.retrieval_results)
        return hits / len(logs)
    
    def _generate_recommendations(self, metrics: RetrievalMetrics) -> List[str]:
        """生成优化建议"""
        recommendations = []
        
        if metrics.avg_latency_ms > 2000:
            recommendations.append("平均延迟较高，建议优化检索性能或增加缓存")
        
        if metrics.hit_rate < 0.8:
            recommendations.append("命中率较低，建议检查索引覆盖或调整检索策略")
        
        if metrics.p95_latency_ms > 5000:
            recommendations.append("P95延迟过高，建议检查慢查询或增加资源")
        
        return recommendations


class QAEvaluator:
    """问答质量评估器"""
    
    def __init__(self):
        self.model_gateway = None
    
    async def evaluate_answer(
        self,
        query: str,
        answer: str,
        reference_chunks: List[Dict[str, Any]],
    ) -> Dict[str, float]:
        """
        评估回答质量
        
        评估维度：
        1. 忠实度：回答是否基于参考资料
        2. 完整性：是否回答了问题的各个方面
        3. 简洁性：是否简洁明了
        """
        # 忠实度评估
        faithfulness = await self._evaluate_faithfulness(answer, reference_chunks)
        
        # 完整性评估（简化）
        completeness = self._evaluate_completeness(query, answer)
        
        # 简洁性评估
        conciseness = self._evaluate_conciseness(answer)
        
        overall = (faithfulness * 0.5 + completeness * 0.3 + conciseness * 0.2)
        
        return {
            "faithfulness": round(faithfulness, 2),
            "completeness": round(completeness, 2),
            "conciseness": round(conciseness, 2),
            "overall": round(overall, 2),
        }
    
    async def _evaluate_faithfulness(
        self,
        answer: str,
        reference_chunks: List[Dict[str, Any]],
    ) -> float:
        """评估忠实度"""
        # 简化实现：检查回答中的关键信息是否在参考资料中
        reference_text = " ".join([c.get("content", "") for c in reference_chunks])
        
        # 提取回答中的关键句子
        sentences = [s.strip() for s in answer.split("。") if len(s.strip()) > 10]
        
        if not sentences:
            return 1.0
        
        # 检查每个句子的信息是否可在参考资料中找到
        supported_count = 0
        for sentence in sentences[:5]:  # 最多检查5句
            # 简化检查：如果有关键词匹配，认为支持
            keywords = set(sentence.split())
            ref_words = set(reference_text.split())
            overlap = keywords & ref_words
            
            if len(overlap) / len(keywords) > 0.3 if keywords else True:
                supported_count += 1
        
        return supported_count / len(sentences) if sentences else 1.0
    
    def _evaluate_completeness(self, query: str, answer: str) -> float:
        """评估完整性"""
        # 简化：检查回答长度是否合适
        answer_length = len(answer)
        
        # 太短可能不完整
        if answer_length < 50:
            return 0.5
        
        # 太长可能包含无关信息
        if answer_length > 2000:
            return 0.8
        
        return 1.0
    
    def _evaluate_conciseness(self, answer: str) -> float:
        """评估简洁性"""
        # 检查重复内容
        sentences = answer.split("。")
        unique_sentences = set(s.strip() for s in sentences)
        
        if len(sentences) > 0:
            repetition_ratio = 1 - len(unique_sentences) / len(sentences)
            return 1.0 - repetition_ratio
        
        return 1.0


class EvaluationDataset:
    """评测数据集管理"""
    
    def __init__(self, file_path: Optional[str] = None):
        self.file_path = file_path or "data/evaluation_dataset.json"
        self.examples: List[Dict] = []
    
    def load(self):
        """加载数据集"""
        import os
        
        if os.path.exists(self.file_path):
            with open(self.file_path, 'r', encoding='utf-8') as f:
                self.examples = json.load(f)
        else:
            self.examples = []
    
    def save(self):
        """保存数据集"""
        import os
        
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(self.examples, f, ensure_ascii=False, indent=2)
    
    def add_example(
        self,
        query: str,
        expected_answer: str,
        category: str = "general",
        tags: List[str] = None,
    ):
        """添加评测样例"""
        self.examples.append({
            "id": f"eval_{len(self.examples) + 1}",
            "query": query,
            "expected_answer": expected_answer,
            "category": category,
            "tags": tags or [],
            "created_at": datetime.now().isoformat(),
        })
    
    def get_examples_by_category(self, category: str) -> List[Dict]:
        """按类别获取样例"""
        return [e for e in self.examples if e.get("category") == category]


# 全局服务实例
_retrieval_evaluator: Optional[RetrievalEvaluator] = None
_qa_evaluator: Optional[QAEvaluator] = None


def get_retrieval_evaluator() -> RetrievalEvaluator:
    """获取检索评估器"""
    global _retrieval_evaluator
    if _retrieval_evaluator is None:
        _retrieval_evaluator = RetrievalEvaluator()
    return _retrieval_evaluator


def get_qa_evaluator() -> QAEvaluator:
    """获取问答评估器"""
    global _qa_evaluator
    if _qa_evaluator is None:
        _qa_evaluator = QAEvaluator()
    return _qa_evaluator
