"""
Knowledge cluster schema for Sirchmunk search system.

Defines the core data structures for knowledge representation,
including clusters, evidence units, and constraints.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union


class Lifecycle(Enum):
    """Lifecycle status of the knowledge cluster."""

    STABLE = "stable"
    EMERGING = "emerging"
    CONTESTED = "contested"
    DEPRECATED = "deprecated"


class AbstractionLevel(Enum):
    """Abstraction tier for cognitive mapping."""

    TECHNIQUE = 1
    PRINCIPLE = 2
    PARADIGM = 3
    FOUNDATION = 4
    PHILOSOPHY = 5


@dataclass
class EvidenceUnit:
    """
    Lightweight reference to an evidence unit.
    Enables traceability and dynamic validation without storing full content.
    """

    doc_id: str
    file_or_url: Union[str, Path]
    summary: str
    is_found: bool
    snippets: List[Dict[str, Any]]
    extracted_at: datetime
    conflict_group: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "file_or_url": str(self.file_or_url),
            "summary": self.summary,
            "is_found": self.is_found,
            "snippets": self.snippets,
            "extracted_at": self.extracted_at.isoformat(),
            "conflict_group": self.conflict_group,
        }


@dataclass
class Constraint:
    """Boundary condition for safe application of cluster conclusions."""

    condition: str
    severity: str  # "low", "medium", "high"
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "condition": self.condition,
            "severity": self.severity,
            "description": self.description,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "Constraint":
        return Constraint(
            condition=data["condition"],
            severity=data["severity"],
            description=data["description"],
        )


@dataclass
class WeakSemanticEdge:
    """A lightweight probabilistic association to another cluster."""

    target_cluster_id: str
    weight: float  # [0.0, 1.0]
    source: str  # e.g., "co_occur", "query_seq", "embed_sim"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_cluster_id": self.target_cluster_id,
            "weight": self.weight,
            "source": self.source,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "WeakSemanticEdge":
        return WeakSemanticEdge(
            target_cluster_id=data["target_cluster_id"],
            weight=data["weight"],
            source=data["source"],
        )


@dataclass
class KnowledgeCluster:
    """
    A high-level, dynamic knowledge unit distilled from multiple evidence sources.
    Serves as the bridge between raw evidence and cognitive navigation.
    """

    id: str
    name: str
    description: Union[str, List[str]]
    content: Union[str, List[str]]
    scripts: Optional[List[str]] = None
    resources: Optional[List[Dict[str, Any]]] = None
    evidences: List[EvidenceUnit] = field(default_factory=list)
    patterns: List[str] = field(default_factory=list)
    constraints: List[Constraint] = field(default_factory=list)
    confidence: Optional[float] = None
    abstraction_level: Optional[AbstractionLevel] = None
    landmark_potential: Optional[float] = None
    hotness: Optional[float] = None
    lifecycle: Lifecycle = Lifecycle.EMERGING
    create_time: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    version: Optional[int] = None
    related_clusters: List[WeakSemanticEdge] = None
    search_results: List[str] = None
    queries: List[str] = None

    def __post_init__(self):
        if self.related_clusters is None:
            self.related_clusters = []
        if self.search_results is None:
            self.search_results = []
        if self.queries is None:
            self.queries = []
        if self.create_time is None:
            self.create_time = datetime.now(timezone.utc)
        if self.last_modified is None:
            self.last_modified = datetime.now(timezone.utc)
        if self.version is None:
            self.version = 0

    def __repr__(self) -> str:
        content_len = 0
        if isinstance(self.content, str):
            content_len = len(self.content)
        elif isinstance(self.content, list):
            content_len = sum(len(c) for c in self.content)
        
        return (
            f"KnowledgeCluster(id={self.id!r}, name={self.name!r}, "
            f"version={self.version}, lifecycle={self.lifecycle.value}, "
            f"evidences={len(self.evidences)}, queries={len(self.queries)}, "
            f"content_len={content_len})"
        )

    @property
    def primary_evidence_files(self) -> Set[str]:
        """Return set of unique file IDs backing this cluster."""
        return {ref.doc_id for ref in self.evidences}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "content": self.content,
            "scripts": self.scripts,
            "resources": self.resources,
            "patterns": self.patterns,
            "constraints": [c.to_dict() for c in self.constraints],
            "evidences": [er.to_dict() for er in self.evidences],
            "confidence": self.confidence,
            "abstraction_level": self.abstraction_level.name if self.abstraction_level else None,
            "landmark_potential": self.landmark_potential,
            "hotness": self.hotness,
            "lifecycle": self.lifecycle.name,
            "create_time": self.create_time.isoformat() if self.create_time else None,
            "last_modified": self.last_modified.isoformat() if self.last_modified else None,
            "version": self.version,
            "related_clusters": [rc.to_dict() for rc in self.related_clusters],
            "search_results": self.search_results,
            "queries": self.queries,
        }
