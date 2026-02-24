"""
音频转写服务
实现面试录音的转写和分析
"""

import os
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import get_model_gateway, ModelProfile

logger = get_logger(__name__)


@dataclass
class TranscriptionSegment:
    """转写片段"""
    start_time: float  # 秒
    end_time: float
    text: str
    speaker: Optional[str] = None
    confidence: float = 0.0


@dataclass
class TranscriptionResult:
    """转写结果"""
    full_text: str
    segments: List[TranscriptionSegment]
    language: str
    duration_seconds: float
    processing_time_seconds: float
    metadata: Dict[str, Any]


@dataclass
class InterviewAnalysis:
    """面试分析结果"""
    transcription: TranscriptionResult
    summary: str
    key_points: List[str]
    technical_questions: List[Dict[str, Any]]
    behavioral_questions: List[Dict[str, Any]]
    candidate_performance: Dict[str, Any]
    suggested_improvements: List[str]
    overall_score: float  # 0-100


class BaseTranscriptionProvider(ABC):
    """转写服务提供商基类"""
    
    @abstractmethod
    async def transcribe(
        self,
        audio_path: str,
        language: str = "zh",
    ) -> TranscriptionResult:
        """转写音频"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """健康检查"""
        pass


class MockTranscriptionProvider(BaseTranscriptionProvider):
    """
    Mock转写提供商
    
    用于开发和测试，实际项目应替换为真实ASR服务
    """
    
    async def transcribe(
        self,
        audio_path: str,
        language: str = "zh",
    ) -> TranscriptionResult:
        """模拟转写"""
        logger.info("mock_transcription.start", audio_path=audio_path)
        
        # 模拟处理时间
        import asyncio
        await asyncio.sleep(0.5)
        
        # 生成模拟结果
        segments = [
            TranscriptionSegment(
                start_time=0.0,
                end_time=5.0,
                text="请简单介绍一下你自己。",
                speaker="面试官",
                confidence=0.95,
            ),
            TranscriptionSegment(
                start_time=6.0,
                end_time=30.0,
                text="您好，我是张三，有5年后端开发经验...",
                speaker="候选人",
                confidence=0.92,
            ),
            TranscriptionSegment(
                start_time=31.0,
                end_time=36.0,
                text="好的，请介绍一下你最近的一个项目。",
                speaker="面试官",
                confidence=0.94,
            ),
        ]
        
        full_text = "\n".join([f"[{s.speaker}]: {s.text}" for s in segments])
        
        return TranscriptionResult(
            full_text=full_text,
            segments=segments,
            language=language,
            duration_seconds=120.0,
            processing_time_seconds=0.5,
            metadata={
                "provider": "mock",
                "audio_path": audio_path,
            },
        )
    
    async def health_check(self) -> bool:
        return True


class OpenAIWhisperProvider(BaseTranscriptionProvider):
    """
    OpenAI Whisper转写提供商
    
    使用OpenAI Whisper API进行转写
    """
    
    def __init__(self):
        self.api_key = None  # 从配置获取
    
    async def transcribe(
        self,
        audio_path: str,
        language: str = "zh",
    ) -> TranscriptionResult:
        """使用Whisper API转写"""
        # TODO: 实现真实的Whisper API调用
        logger.warning("whisper.not_implemented")
        raise NotImplementedError("Whisper API调用待实现")
    
    async def health_check(self) -> bool:
        return self.api_key is not None


class AudioTranscriptionService:
    """
    音频转写服务
    
    管理音频文件转写流程
    """
    
    SUPPORTED_FORMATS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm']
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(self):
        self.provider = MockTranscriptionProvider()  # 默认使用Mock
        self.model_gateway = get_model_gateway()
    
    def set_provider(self, provider: BaseTranscriptionProvider):
        """设置转写提供商"""
        self.provider = provider
    
    async def transcribe_audio(
        self,
        audio_path: str,
        language: str = "zh",
    ) -> TranscriptionResult:
        """
        转写音频文件
        
        Args:
            audio_path: 音频文件路径
            language: 语言代码 (zh/en等)
        
        Returns:
            转写结果
        """
        # 验证文件
        self._validate_audio_file(audio_path)
        
        logger.info("transcription.start", audio_path=audio_path, language=language)
        
        try:
            result = await self.provider.transcribe(audio_path, language)
            
            logger.info(
                "transcription.complete",
                duration=result.duration_seconds,
                segments=len(result.segments),
            )
            
            return result
            
        except Exception as e:
            logger.error("transcription.failed", error=str(e))
            raise
    
    def _validate_audio_file(self, audio_path: str):
        """验证音频文件"""
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"音频文件不存在: {audio_path}")
        
        # 检查格式
        ext = Path(audio_path).suffix.lower()
        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的音频格式: {ext}")
        
        # 检查大小
        size = os.path.getsize(audio_path)
        if size > self.MAX_FILE_SIZE:
            raise ValueError(f"文件大小超过限制: {size} bytes")
    
    async def analyze_interview(
        self,
        transcription: TranscriptionResult,
    ) -> InterviewAnalysis:
        """
        分析面试录音
        
        使用LLM分析面试内容，提取关键信息
        """
        logger.info("interview_analysis.start")
        
        # 1. 生成摘要
        summary = await self._generate_summary(transcription)
        
        # 2. 提取关键点
        key_points = await self._extract_key_points(transcription)
        
        # 3. 分析问题
        technical_questions, behavioral_questions = await self._analyze_questions(
            transcription
        )
        
        # 4. 评估表现
        performance = await self._evaluate_performance(transcription)
        
        # 5. 改进建议
        improvements = await self._suggest_improvements(transcription, performance)
        
        # 6. 计算总分
        overall_score = self._calculate_overall_score(performance)
        
        return InterviewAnalysis(
            transcription=transcription,
            summary=summary,
            key_points=key_points,
            technical_questions=technical_questions,
            behavioral_questions=behavioral_questions,
            candidate_performance=performance,
            suggested_improvements=improvements,
            overall_score=overall_score,
        )
    
    async def _generate_summary(self, transcription: TranscriptionResult) -> str:
        """生成面试摘要"""
        prompt = f"""请为以下面试对话生成简要摘要（200字以内）：

{transcription.full_text}

摘要要求：
1. 面试岗位和候选人背景
2. 主要讨论的技术话题
3. 候选人的整体表现
"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            return response.content
        except Exception as e:
            logger.error("summary_generation.failed", error=str(e))
            return "摘要生成失败"
    
    async def _extract_key_points(self, transcription: TranscriptionResult) -> List[str]:
        """提取关键点"""
        prompt = f"""请从以下面试对话中提取5-8个关键点：

{transcription.full_text}

关键点可以包括：
- 重要的技术问题或答案
- 候选人的亮点或不足
- 特殊的项目经验

请用简洁的 bullet points 格式输出。"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            # 解析 bullet points
            points = [
                line.strip().lstrip('-').strip()
                for line in response.content.split('\n')
                if line.strip().startswith('-')
            ]
            
            return points[:8]  # 最多8个
            
        except Exception as e:
            logger.error("key_points_extraction.failed", error=str(e))
            return []
    
    async def _analyze_questions(
        self,
        transcription: TranscriptionResult,
    ) -> tuple:
        """分析问题"""
        prompt = f"""请分析以下面试对话中的问题，分为技术问题和行为问题：

{transcription.full_text}

请输出JSON格式：
{{
    "technical": [
        {{
            "question": "问题内容",
            "answer": "候选人回答摘要",
            "difficulty": "easy/medium/hard",
            "evaluation": "good/fair/poor"
        }}
    ],
    "behavioral": [
        {{
            "question": "问题内容",
            "answer": "候选人回答摘要",
            "evaluation": "good/fair/poor"
        }}
    ]
}}"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            import json
            import re
            
            # 提取JSON
            json_match = re.search(r'\{[^}]+\}', response.content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data.get("technical", []), data.get("behavioral", [])
            
        except Exception as e:
            logger.error("question_analysis.failed", error=str(e))
        
        return [], []
    
    async def _evaluate_performance(self, transcription: TranscriptionResult) -> Dict:
        """评估候选人表现"""
        prompt = f"""请评估候选人在以下面试中的表现：

{transcription.full_text}

请从以下维度评估（1-10分），并给出简要说明：
1. 技术能力
2. 沟通能力
3. 问题解决能力
4. 项目经验
5. 文化匹配度

输出JSON格式：
{{
    "technical": {{"score": 8, "comment": "..."}},
    "communication": {{"score": 7, "comment": "..."}},
    "problem_solving": {{"score": 8, "comment": "..."}},
    "experience": {{"score": 9, "comment": "..."}},
    "culture_fit": {{"score": 7, "comment": "..."}}
}}"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            import json
            import re
            
            json_match = re.search(r'\{[^}]+\}', response.content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
        except Exception as e:
            logger.error("performance_evaluation.failed", error=str(e))
        
        return {}
    
    async def _suggest_improvements(
        self,
        transcription: TranscriptionResult,
        performance: Dict,
    ) -> List[str]:
        """建议改进"""
        prompt = f"""基于面试表现，请给出3-5条具体的改进建议：

面试内容：
{transcription.full_text[:1000]}...

表现评估：{str(performance)}

请针对薄弱环节给出可执行的建议。"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            # 解析建议
            suggestions = [
                line.strip().lstrip('-').strip()
                for line in response.content.split('\n')
                if line.strip().startswith('-')
            ]
            
            return suggestions[:5]
            
        except Exception as e:
            logger.error("improvement_suggestions.failed", error=str(e))
            return []
    
    def _calculate_overall_score(self, performance: Dict) -> float:
        """计算总分"""
        if not performance:
            return 0.0
        
        scores = []
        for key in ["technical", "communication", "problem_solving", "experience", "culture_fit"]:
            if key in performance and isinstance(performance[key], dict):
                scores.append(performance[key].get("score", 0))
        
        if scores:
            return sum(scores) / len(scores) * 10  # 转换为百分制
        
        return 0.0


# 全局服务实例
_transcription_service: Optional[AudioTranscriptionService] = None


def get_transcription_service() -> AudioTranscriptionService:
    """获取转写服务单例"""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = AudioTranscriptionService()
    return _transcription_service
