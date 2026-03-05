"""
Goal Analysis Tool for CrewAI

Wraps FlowBoard's goal analysis functionality to extract structured
information from learning goal descriptions.
"""

import json
import re
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


class GoalAnalysisInput(BaseModel):
    """Input schema for goal analysis."""
    goal_description: str = Field(
        description="The learning goal description to analyze"
    )


class GoalAnalysisOutput(BaseModel):
    """Output schema for goal analysis."""
    title: str = Field(description="Concise title for the learning plan")
    overview: str = Field(description="Brief overview of the goal (100 chars max)")
    skills: list[str] = Field(description="List of skills to be learned")
    difficulty: str = Field(description="Difficulty level: beginner/intermediate/advanced")
    prerequisites: list[str] = Field(description="Required prior knowledge")
    alternatives: list[str] = Field(description="Alternative learning paths")


class GoalAnalysisTool(BaseTool):
    """
    Tool for analyzing learning goals and extracting structured information.
    
    This tool uses pattern matching and keyword extraction to analyze
    a goal description and produce structured output suitable for planning.
    """
    
    name: str = "goal_analysis"
    description: str = (
        "Analyzes a learning goal description and extracts structured information "
        "including title, skills, difficulty level, prerequisites, and alternatives. "
        "Use this when you need to understand and structure a user's learning objective."
    )
    args_schema: Type[BaseModel] = GoalAnalysisInput
    
    def _run(self, goal_description: str) -> str:
        """
        Execute the goal analysis.
        
        Args:
            goal_description: The learning goal to analyze
            
        Returns:
            JSON string with analysis results
        """
        logger.info("goal_analysis_tool.run", goal_len=len(goal_description))
        
        analysis = self._analyze_goal(goal_description)
        
        return json.dumps(analysis, ensure_ascii=False, indent=2)
    
    def _analyze_goal(self, goal_description: str) -> dict:
        """
        Perform rule-based goal analysis.
        
        Args:
            goal_description: The goal text to analyze
            
        Returns:
            Dictionary with analysis results
        """
        goal_lower = goal_description.lower()
        
        # Extract title (first sentence or first 50 chars)
        title = self._extract_title(goal_description)
        
        # Detect difficulty
        difficulty = self._detect_difficulty(goal_lower)
        
        # Extract skills keywords
        skills = self._extract_skills(goal_lower)
        
        # Detect prerequisites
        prerequisites = self._detect_prerequisites(goal_lower)
        
        # Generate alternatives
        alternatives = self._suggest_alternatives(goal_lower, skills)
        
        return {
            "title": title,
            "overview": goal_description[:100] + "..." if len(goal_description) > 100 else goal_description,
            "skills": skills,
            "difficulty": difficulty,
            "prerequisites": prerequisites,
            "alternatives": alternatives,
        }
    
    def _extract_title(self, goal: str) -> str:
        """Extract a concise title from the goal."""
        # Try to get first sentence
        sentences = re.split(r'[。.!！?？]', goal)
        if sentences:
            title = sentences[0].strip()
            if len(title) > 50:
                title = title[:50] + "..."
            return title or "学习计划"
        return "学习计划"
    
    def _detect_difficulty(self, goal_lower: str) -> str:
        """Detect difficulty level from keywords."""
        advanced_keywords = ["高级", "进阶", "深入", "架构", "源码", "advanced", "expert"]
        beginner_keywords = ["入门", "初学", "基础", "零基础", "beginner", "basic"]
        
        for kw in advanced_keywords:
            if kw in goal_lower:
                return "advanced"
        
        for kw in beginner_keywords:
            if kw in goal_lower:
                return "beginner"
        
        return "intermediate"
    
    def _extract_skills(self, goal_lower: str) -> list[str]:
        """Extract skill keywords from the goal."""
        # Common tech skill patterns
        skill_patterns = [
            # Programming languages
            (r'\bpython\b', "Python"),
            (r'\bjava\b', "Java"),
            (r'\bjavascript\b|\bjs\b', "JavaScript"),
            (r'\btypescript\b|\bts\b', "TypeScript"),
            (r'\bgo\b|\bgolang\b', "Go"),
            (r'\brust\b', "Rust"),
            (r'\bc\+\+\b|\bcpp\b', "C++"),
            
            # Frameworks
            (r'\breact\b', "React"),
            (r'\bvue\b', "Vue"),
            (r'\bangular\b', "Angular"),
            (r'\bdjango\b', "Django"),
            (r'\bflask\b', "Flask"),
            (r'\bfastapi\b', "FastAPI"),
            (r'\bspring\b', "Spring"),
            
            # Data/ML
            (r'\b机器学习\b|\bml\b', "机器学习"),
            (r'\b深度学习\b|\bdeep learning\b', "深度学习"),
            (r'\b数据分析\b|\bdata analysis\b', "数据分析"),
            (r'\bpytorch\b', "PyTorch"),
            (r'\btensorflow\b', "TensorFlow"),
            
            # Infrastructure
            (r'\bdocker\b', "Docker"),
            (r'\bkubernetes\b|\bk8s\b', "Kubernetes"),
            (r'\baws\b', "AWS"),
            (r'\b云计算\b|\bcloud\b', "云计算"),
            
            # Databases
            (r'\bmysql\b', "MySQL"),
            (r'\bpostgresql\b|\bpostgres\b', "PostgreSQL"),
            (r'\bmongodb\b', "MongoDB"),
            (r'\bredis\b', "Redis"),
            
            # General
            (r'\b后端\b|\bbackend\b', "后端开发"),
            (r'\b前端\b|\bfrontend\b', "前端开发"),
            (r'\b全栈\b|\bfullstack\b', "全栈开发"),
            (r'\b算法\b|\balgorithm\b', "算法"),
            (r'\b数据结构\b', "数据结构"),
        ]
        
        skills = []
        for pattern, skill_name in skill_patterns:
            if re.search(pattern, goal_lower):
                skills.append(skill_name)
        
        # Limit to top 8 skills
        return skills[:8] if skills else ["编程基础"]
    
    def _detect_prerequisites(self, goal_lower: str) -> list[str]:
        """Detect likely prerequisites based on skills and difficulty."""
        prerequisites = []
        
        # Advanced topics usually require basics
        if "高级" in goal_lower or "进阶" in goal_lower:
            prerequisites.append("相关基础知识")
        
        if "架构" in goal_lower:
            prerequisites.append("编程基础")
            prerequisites.append("项目开发经验")
        
        if "深度学习" in goal_lower or "机器学习" in goal_lower:
            prerequisites.append("Python基础")
            prerequisites.append("数学基础（线性代数、概率论）")
        
        if "kubernetes" in goal_lower or "k8s" in goal_lower:
            prerequisites.append("Docker基础")
            prerequisites.append("Linux基础")
        
        return prerequisites if prerequisites else ["无特殊要求"]
    
    def _suggest_alternatives(self, goal_lower: str, skills: list[str]) -> list[str]:
        """Suggest alternative learning paths."""
        alternatives = []
        
        if "python" in goal_lower:
            alternatives.append("考虑学习Rust作为系统编程替代")
        
        if "react" in goal_lower:
            alternatives.append("可以考虑Vue.js作为替代框架")
        elif "vue" in goal_lower:
            alternatives.append("可以考虑React作为替代框架")
        
        if "后端" in goal_lower:
            alternatives.append("可以选择不同的技术栈：Node.js/Python/Go/Java")
        
        if not alternatives:
            alternatives.append("按照当前路径学习是最佳选择")
        
        return alternatives
