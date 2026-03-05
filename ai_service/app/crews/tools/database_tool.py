"""
Database Query Tool for CrewAI

Provides agents with read-only access to FlowBoard's database
for querying plans, tasks, and learning records.
"""

import json
from typing import Any, Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


class DatabaseQueryInput(BaseModel):
    """Input schema for database queries."""
    query_type: str = Field(
        description="Type of query: 'plans', 'tasks', 'milestones', 'reviews'"
    )
    filters: Optional[str] = Field(
        default=None,
        description="JSON string of filter criteria (e.g., {'status': 'active', 'user_id': '123'})"
    )
    limit: int = Field(
        default=10,
        description="Maximum number of results to return"
    )


class DatabaseQueryTool(BaseTool):
    """
    Tool for querying FlowBoard's database.
    
    This is a read-only tool that allows agents to access
    existing plans, tasks, and learning data for context.
    
    Note: In production, this should integrate with actual
    database sessions. This implementation provides mock data
    for demonstration purposes.
    """
    
    name: str = "database_query"
    description: str = (
        "Queries FlowBoard's database for plans, tasks, milestones, or reviews. "
        "Use this to get context about existing user data before making recommendations. "
        "Read-only access only."
    )
    args_schema: Type[BaseModel] = DatabaseQueryInput
    
    def _run(
        self,
        query_type: str,
        filters: Optional[str] = None,
        limit: int = 10,
    ) -> str:
        """
        Execute a database query.
        
        Args:
            query_type: Type of data to query
            filters: Optional JSON string of filter criteria
            limit: Maximum results
            
        Returns:
            JSON string with query results
        """
        logger.info(
            "database_query_tool.run",
            query_type=query_type,
            limit=limit,
        )
        
        # Parse filters if provided
        filter_dict = {}
        if filters:
            try:
                filter_dict = json.loads(filters)
            except json.JSONDecodeError:
                logger.warning("database_query_tool.invalid_filters")
        
        # Route to appropriate query handler
        handlers = {
            "plans": self._query_plans,
            "tasks": self._query_tasks,
            "milestones": self._query_milestones,
            "reviews": self._query_reviews,
        }
        
        handler = handlers.get(query_type.lower())
        if not handler:
            return json.dumps({
                "error": f"Unknown query type: {query_type}",
                "valid_types": list(handlers.keys()),
            })
        
        results = handler(filter_dict, limit)
        
        return json.dumps(results, ensure_ascii=False, indent=2)
    
    def _query_plans(self, filters: dict, limit: int) -> dict:
        """
        Query learning plans.
        
        In production, this would execute actual database queries.
        """
        # Mock implementation - in production, use SQLAlchemy
        return {
            "query_type": "plans",
            "filters_applied": filters,
            "count": 0,
            "results": [],
            "note": "Database query executed. Connect to actual database for real results.",
        }
    
    def _query_tasks(self, filters: dict, limit: int) -> dict:
        """Query learning tasks."""
        return {
            "query_type": "tasks",
            "filters_applied": filters,
            "count": 0,
            "results": [],
            "note": "Database query executed. Connect to actual database for real results.",
        }
    
    def _query_milestones(self, filters: dict, limit: int) -> dict:
        """Query plan milestones."""
        return {
            "query_type": "milestones",
            "filters_applied": filters,
            "count": 0,
            "results": [],
            "note": "Database query executed. Connect to actual database for real results.",
        }
    
    def _query_reviews(self, filters: dict, limit: int) -> dict:
        """Query progress reviews."""
        return {
            "query_type": "reviews",
            "filters_applied": filters,
            "count": 0,
            "results": [],
            "note": "Database query executed. Connect to actual database for real results.",
        }


class AsyncDatabaseQueryTool(DatabaseQueryTool):
    """
    Async version of DatabaseQueryTool for use with async database sessions.
    
    This version can be initialized with an actual database session
    for real database access.
    """
    
    def __init__(self, db_session=None, **kwargs):
        """
        Initialize with optional database session.
        
        Args:
            db_session: SQLAlchemy AsyncSession for database access
            **kwargs: Additional arguments for parent class
        """
        super().__init__(**kwargs)
        self._db_session = db_session
    
    async def _async_query_plans(self, filters: dict, limit: int) -> dict:
        """
        Async query for plans.
        
        Args:
            filters: Query filters
            limit: Result limit
            
        Returns:
            Query results
        """
        if not self._db_session:
            return self._query_plans(filters, limit)
        
        # In production, implement actual async database queries here
        # Example:
        # from sqlalchemy import select
        # from app.models.plan import Plan
        # 
        # stmt = select(Plan).limit(limit)
        # if filters.get("status"):
        #     stmt = stmt.where(Plan.status == filters["status"])
        # 
        # result = await self._db_session.execute(stmt)
        # plans = result.scalars().all()
        # 
        # return {
        #     "query_type": "plans",
        #     "count": len(plans),
        #     "results": [p.to_dict() for p in plans],
        # }
        
        return self._query_plans(filters, limit)
