"""
Template Matching Tool for CrewAI

Wraps FlowBoard's PlanTemplateLibrary to match learning goals
with predefined plan templates.
"""

import json
from typing import Any, Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


class TemplateMatchingInput(BaseModel):
    """Input schema for template matching."""
    goal_description: str = Field(
        description="The learning goal description to match against templates"
    )


class PlanTemplate(BaseModel):
    """Schema for a plan template."""
    key: str = Field(description="Template identifier")
    title: str = Field(description="Template title")
    milestones: list[dict] = Field(description="List of milestone definitions")
    match_score: float = Field(description="Match confidence score (0-1)")


class TemplateMatchingTool(BaseTool):
    """
    Tool for matching learning goals against predefined plan templates.
    
    This tool searches through FlowBoard's template library to find
    the best matching template for a given learning goal.
    """
    
    name: str = "template_matching"
    description: str = (
        "Matches a learning goal against predefined plan templates. "
        "Returns the best matching template with milestones and a confidence score. "
        "Use this to leverage existing proven learning paths."
    )
    args_schema: Type[BaseModel] = TemplateMatchingInput
    
    # Built-in templates (mirroring PlanTemplateLibrary)
    TEMPLATES = {
        "backend_development": {
            "title": "后端开发学习计划",
            "keywords": ["后端", "backend", "服务器", "api", "数据库", "微服务"],
            "milestones": [
                {"title": "编程基础", "duration": 21, "skills": ["Python/Java", "数据结构", "算法"]},
                {"title": "Web开发", "duration": 28, "skills": ["HTTP", "REST API", "数据库"]},
                {"title": "框架学习", "duration": 21, "skills": ["Django/Spring", "ORM", "中间件"]},
                {"title": "系统架构", "duration": 21, "skills": ["微服务", "消息队列", "缓存"]},
            ]
        },
        "frontend_development": {
            "title": "前端开发学习计划",
            "keywords": ["前端", "frontend", "react", "vue", "css", "界面", "ui"],
            "milestones": [
                {"title": "HTML/CSS基础", "duration": 14, "skills": ["HTML5", "CSS3", "响应式"]},
                {"title": "JavaScript核心", "duration": 21, "skills": ["ES6+", "DOM", "异步编程"]},
                {"title": "框架学习", "duration": 28, "skills": ["React/Vue", "状态管理", "路由"]},
                {"title": "工程化", "duration": 14, "skills": ["Webpack", "测试", "CI/CD"]},
            ]
        },
        "data_science": {
            "title": "数据科学学习计划",
            "keywords": ["数据", "data", "机器学习", "ml", "ai", "算法", "分析", "python"],
            "milestones": [
                {"title": "数学基础", "duration": 21, "skills": ["线性代数", "概率论", "统计"]},
                {"title": "Python数据分析", "duration": 21, "skills": ["NumPy", "Pandas", "可视化"]},
                {"title": "机器学习", "duration": 35, "skills": ["监督学习", "无监督学习", "模型评估"]},
                {"title": "深度学习", "duration": 28, "skills": ["神经网络", "PyTorch", "CNN/RNN"]},
            ]
        },
        "devops": {
            "title": "DevOps工程师学习计划",
            "keywords": ["devops", "运维", "docker", "kubernetes", "k8s", "ci/cd", "云"],
            "milestones": [
                {"title": "Linux基础", "duration": 14, "skills": ["Shell", "网络", "系统管理"]},
                {"title": "容器化", "duration": 21, "skills": ["Docker", "镜像构建", "编排"]},
                {"title": "Kubernetes", "duration": 28, "skills": ["K8s核心", "部署", "监控"]},
                {"title": "CI/CD流水线", "duration": 14, "skills": ["Jenkins/GitLab CI", "自动化", "测试"]},
            ]
        },
        "fullstack": {
            "title": "全栈开发学习计划",
            "keywords": ["全栈", "fullstack", "full-stack", "web开发"],
            "milestones": [
                {"title": "前端基础", "duration": 21, "skills": ["HTML/CSS", "JavaScript", "React/Vue"]},
                {"title": "后端基础", "duration": 21, "skills": ["Node.js/Python", "数据库", "API"]},
                {"title": "项目实战", "duration": 28, "skills": ["前后端联调", "部署", "优化"]},
                {"title": "进阶技能", "duration": 21, "skills": ["微服务", "容器化", "监控"]},
            ]
        },
    }
    
    def _run(self, goal_description: str) -> str:
        """
        Execute template matching.
        
        Args:
            goal_description: The learning goal to match
            
        Returns:
            JSON string with matched template or None if no match
        """
        logger.info("template_matching_tool.run", goal_len=len(goal_description))
        
        result = self._match_template(goal_description)
        
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    def _match_template(self, goal_description: str) -> dict:
        """
        Match goal against templates and return best match.
        
        Args:
            goal_description: The goal text to match
            
        Returns:
            Dictionary with matched template info or empty if no match
        """
        goal_lower = goal_description.lower()
        
        best_match = None
        best_score = 0.0
        
        for key, template in self.TEMPLATES.items():
            score = self._calculate_match_score(goal_lower, template["keywords"])
            
            if score > best_score:
                best_score = score
                best_match = {
                    "key": key,
                    "title": template["title"],
                    "milestones": template["milestones"],
                    "match_score": score,
                }
        
        # Return match only if score exceeds threshold
        if best_match and best_score >= 0.3:
            logger.info(
                "template_matching_tool.matched",
                template=best_match["key"],
                score=best_score,
            )
            return {
                "matched": True,
                "template": best_match,
            }
        
        logger.info("template_matching_tool.no_match")
        return {
            "matched": False,
            "template": None,
            "suggestion": "没有找到匹配的模板，建议创建自定义学习计划",
        }
    
    def _calculate_match_score(self, goal_lower: str, keywords: list[str]) -> float:
        """
        Calculate match score based on keyword overlap.
        
        Args:
            goal_lower: Lowercase goal description
            keywords: Template keywords to match
            
        Returns:
            Match score between 0 and 1
        """
        if not keywords:
            return 0.0
        
        matches = sum(1 for kw in keywords if kw.lower() in goal_lower)
        return matches / len(keywords)
