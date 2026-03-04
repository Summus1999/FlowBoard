"""
Knowledge Storage using DuckDB and Parquet.

Manages KnowledgeCluster objects with persistence.
Architecture:
- In-memory DuckDB for all read/write operations
- Parquet file for durable persistence
- Daemon thread syncs dirty data periodically
"""

import os
import json
import atexit
import threading
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
from loguru import logger

from .duckdb import DuckDBManager
from ..schema.knowledge import (
    KnowledgeCluster,
    EvidenceUnit,
    Constraint,
    WeakSemanticEdge,
    Lifecycle,
    AbstractionLevel
)


DEFAULT_WORK_PATH = "~/.flowboard/sirchmunk"


class KnowledgeStorage:
    """
    Manages persistent storage of KnowledgeCluster objects using DuckDB and Parquet.
    """

    def __init__(self, work_path: Optional[str] = None,
                 sync_interval: int = 60,
                 sync_threshold: int = 100):
        """
        Initialize Knowledge Storage.

        Args:
            work_path: Base work path for storage.
            sync_interval: Seconds between periodic Parquet syncs.
            sync_threshold: Dirty write count that triggers immediate sync.
        """
        if work_path is None:
            work_path = os.getenv("SIRCHMUNK_WORK_PATH", DEFAULT_WORK_PATH)

        self.knowledge_path = Path(work_path).expanduser().resolve() / ".cache" / "knowledge"
        self.knowledge_path.mkdir(parents=True, exist_ok=True)

        self.parquet_file = str(self.knowledge_path / "knowledge_clusters.parquet")
        self.db = DuckDBManager(db_path=None)
        self.table_name = "knowledge_clusters"

        self._parquet_loaded_mtime: float = 0.0
        self._load_from_parquet()

        self._parquet_dirty_count = 0
        self._parquet_sync_threshold = sync_threshold
        self._parquet_sync_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._daemon_thread = None
        self._shutdown_registered = False

        self._start_parquet_sync_daemon(sync_interval)
        self._register_shutdown_hook()

        logger.info(f"Knowledge Storage initialized at: {self.knowledge_path}")

    def _load_from_parquet(self):
        """Load knowledge clusters from parquet file into DuckDB."""
        try:
            pq = Path(self.parquet_file)
            if pq.exists():
                self.db.drop_table(self.table_name, if_exists=True)
                self._create_table()
                self.db.execute(
                    f"INSERT INTO {self.table_name} "
                    f"SELECT * FROM read_parquet('{self.parquet_file}')"
                )
                count = self.db.get_table_count(self.table_name)
                self._parquet_loaded_mtime = pq.stat().st_mtime
                logger.info(f"Loaded {count} knowledge clusters from {self.parquet_file}")
            else:
                self._create_table()
                self._parquet_loaded_mtime = 0.0
                logger.info("Created new knowledge clusters table")
        except Exception as e:
            logger.error(f"Failed to load from parquet: {e}")
            self.db.drop_table(self.table_name, if_exists=True)
            self._create_table()
            self._parquet_loaded_mtime = 0.0

    def _create_table(self):
        """Create knowledge clusters table with schema."""
        schema = {
            "id": "VARCHAR PRIMARY KEY",
            "name": "VARCHAR NOT NULL",
            "description": "VARCHAR",
            "content": "VARCHAR",
            "scripts": "VARCHAR",
            "resources": "VARCHAR",
            "evidences": "VARCHAR",
            "patterns": "VARCHAR",
            "constraints": "VARCHAR",
            "confidence": "DOUBLE",
            "abstraction_level": "VARCHAR",
            "landmark_potential": "DOUBLE",
            "hotness": "DOUBLE",
            "lifecycle": "VARCHAR",
            "create_time": "TIMESTAMP",
            "last_modified": "TIMESTAMP",
            "version": "INTEGER",
            "related_clusters": "VARCHAR",
            "search_results": "VARCHAR",
            "queries": "VARCHAR",
            "embedding_vector": "FLOAT[384]",
            "embedding_model": "VARCHAR",
            "embedding_timestamp": "TIMESTAMP",
            "embedding_text_hash": "VARCHAR",
        }
        self.db.create_table(self.table_name, schema, if_not_exists=True)

    def _sync_to_parquet(self):
        """Sync in-memory knowledge clusters to parquet file."""
        with self._parquet_sync_lock:
            if self._parquet_dirty_count == 0:
                return

            temp_file = None
            try:
                temp_file = f"{self.parquet_file}.{os.getpid()}.tmp"
                self.db.export_to_parquet(self.table_name, temp_file)

                if not Path(temp_file).exists():
                    raise IOError(f"Temporary file not created: {temp_file}")

                os.replace(temp_file, self.parquet_file)

                synced_ops = self._parquet_dirty_count
                self._parquet_dirty_count = 0
                logger.debug(f"Synced knowledge clusters ({synced_ops} dirty ops)")

            except Exception as e:
                logger.error(f"Failed to sync to parquet: {e}")
                if temp_file and Path(temp_file).exists():
                    try:
                        Path(temp_file).unlink()
                    except Exception:
                        pass

    def _mark_parquet_dirty(self):
        """Increment dirty counter and trigger sync if threshold reached."""
        self._parquet_dirty_count += 1
        if self._parquet_dirty_count >= self._parquet_sync_threshold:
            self._sync_to_parquet()

    def _start_parquet_sync_daemon(self, interval: int):
        """Start a daemon thread for periodic parquet sync."""
        def _sync_loop():
            while not self._stop_event.is_set():
                self._stop_event.wait(interval)
                if not self._stop_event.is_set():
                    try:
                        self._sync_to_parquet()
                    except Exception as e:
                        logger.error(f"Daemon parquet sync failed: {e}")

        self._daemon_thread = threading.Thread(
            target=_sync_loop, daemon=True, name="knowledge-parquet-sync"
        )
        self._daemon_thread.start()

    def _register_shutdown_hook(self):
        """Register atexit handler for graceful shutdown."""
        if self._shutdown_registered:
            return
        atexit.register(self._shutdown_parquet_sync)
        self._shutdown_registered = True

    def _shutdown_parquet_sync(self):
        """Stop daemon thread and perform final parquet sync."""
        self._stop_event.set()
        if self._daemon_thread and self._daemon_thread.is_alive():
            self._daemon_thread.join(timeout=5)

        if self._parquet_dirty_count == 0:
            self._parquet_dirty_count = 1
        try:
            self._sync_to_parquet()
        except Exception as e:
            logger.error(f"Final parquet shutdown sync failed: {e}")

    def force_sync(self):
        """Force immediate parquet sync."""
        if self._parquet_dirty_count == 0:
            self._parquet_dirty_count = 1
        self._sync_to_parquet()

    def _cluster_to_row(self, cluster: KnowledgeCluster) -> Dict[str, Any]:
        """Convert KnowledgeCluster to database row."""
        description_str = (
            json.dumps(cluster.description)
            if isinstance(cluster.description, list)
            else cluster.description
        )
        content_str = (
            json.dumps(cluster.content)
            if isinstance(cluster.content, list)
            else cluster.content
        )

        return {
            "id": cluster.id,
            "name": cluster.name,
            "description": description_str,
            "content": content_str,
            "scripts": json.dumps(cluster.scripts) if cluster.scripts else None,
            "resources": json.dumps(cluster.resources) if cluster.resources else None,
            "evidences": json.dumps([e.to_dict() for e in cluster.evidences]),
            "patterns": json.dumps(cluster.patterns),
            "constraints": json.dumps([c.to_dict() for c in cluster.constraints]),
            "confidence": cluster.confidence,
            "abstraction_level": cluster.abstraction_level.name if cluster.abstraction_level else None,
            "landmark_potential": cluster.landmark_potential,
            "hotness": cluster.hotness,
            "lifecycle": cluster.lifecycle.name,
            "create_time": cluster.create_time.isoformat() if cluster.create_time else None,
            "last_modified": cluster.last_modified.isoformat() if cluster.last_modified else None,
            "version": cluster.version,
            "related_clusters": json.dumps([rc.to_dict() for rc in cluster.related_clusters]),
            "search_results": json.dumps(cluster.search_results) if cluster.search_results else None,
            "queries": json.dumps(cluster.queries) if cluster.queries else None,
        }

    def _row_to_cluster(self, row: tuple) -> KnowledgeCluster:
        """Convert database row to KnowledgeCluster."""
        if len(row) < 20:
            raise ValueError(f"Expected at least 20 columns, got {len(row)}")

        (id, name, description, content, scripts, resources, evidences, patterns,
         constraints, confidence, abstraction_level, landmark_potential, hotness,
         lifecycle, create_time, last_modified, version, related_clusters, 
         search_results, queries) = row[:20]

        # Parse JSON fields
        try:
            description_parsed = json.loads(description) if description and description.startswith('[') else description
        except:
            description_parsed = description

        try:
            content_parsed = json.loads(content) if content and content.startswith('[') else content
        except:
            content_parsed = content

        scripts_parsed = json.loads(scripts) if scripts else None
        resources_parsed = json.loads(resources) if resources else None
        patterns_parsed = json.loads(patterns) if patterns else []

        # Parse evidences
        evidences_parsed = []
        if evidences:
            evidences_data = json.loads(evidences)
            for ev_dict in evidences_data:
                extracted_at_raw = ev_dict.get("extracted_at")
                extracted_at_parsed = None
                if extracted_at_raw:
                    if isinstance(extracted_at_raw, str):
                        extracted_at_parsed = datetime.fromisoformat(extracted_at_raw)
                    elif isinstance(extracted_at_raw, datetime):
                        extracted_at_parsed = extracted_at_raw

                evidences_parsed.append(EvidenceUnit(
                    doc_id=ev_dict["doc_id"],
                    file_or_url=Path(ev_dict["file_or_url"]),
                    summary=ev_dict["summary"],
                    is_found=ev_dict["is_found"],
                    snippets=ev_dict["snippets"],
                    extracted_at=extracted_at_parsed or datetime.now(),
                    conflict_group=ev_dict.get("conflict_group")
                ))

        # Parse constraints
        constraints_parsed = []
        if constraints:
            constraints_data = json.loads(constraints)
            for c_dict in constraints_data:
                constraints_parsed.append(Constraint.from_dict(c_dict))

        # Parse related clusters
        related_clusters_parsed = []
        if related_clusters:
            related_data = json.loads(related_clusters)
            for rc_dict in related_data:
                related_clusters_parsed.append(WeakSemanticEdge.from_dict(rc_dict))

        search_results_parsed = json.loads(search_results) if search_results else []
        queries_parsed = json.loads(queries) if queries else []

        # Parse datetime fields
        create_time_parsed = None
        if create_time:
            if isinstance(create_time, str):
                create_time_parsed = datetime.fromisoformat(create_time)
            elif isinstance(create_time, datetime):
                create_time_parsed = create_time

        last_modified_parsed = None
        if last_modified:
            if isinstance(last_modified, str):
                last_modified_parsed = datetime.fromisoformat(last_modified)
            elif isinstance(last_modified, datetime):
                last_modified_parsed = last_modified

        return KnowledgeCluster(
            id=id,
            name=name,
            description=description_parsed,
            content=content_parsed,
            scripts=scripts_parsed,
            resources=resources_parsed,
            evidences=evidences_parsed,
            patterns=patterns_parsed,
            constraints=constraints_parsed,
            confidence=confidence,
            abstraction_level=AbstractionLevel[abstraction_level] if abstraction_level else None,
            landmark_potential=landmark_potential,
            hotness=hotness,
            lifecycle=Lifecycle[lifecycle],
            create_time=create_time_parsed,
            last_modified=last_modified_parsed,
            version=version,
            related_clusters=related_clusters_parsed,
            search_results=search_results_parsed,
            queries=queries_parsed,
        )

    async def get(self, cluster_id: str) -> Optional[KnowledgeCluster]:
        """Get a knowledge cluster by ID."""
        try:
            row = self.db.fetch_one(
                f"SELECT * FROM {self.table_name} WHERE id = ?",
                [cluster_id]
            )
            if row:
                return self._row_to_cluster(row)
            return None
        except Exception as e:
            logger.error(f"Failed to get cluster {cluster_id}: {e}")
            return None

    async def insert(self, cluster: KnowledgeCluster) -> bool:
        """Insert a new knowledge cluster."""
        try:
            row = self._cluster_to_row(cluster)
            columns = list(row.keys())
            placeholders = ", ".join(["?" for _ in columns])
            column_names = ", ".join(columns)

            self.db.execute(
                f"INSERT INTO {self.table_name} ({column_names}) VALUES ({placeholders})",
                list(row.values())
            )
            self._mark_parquet_dirty()
            logger.info(f"Inserted cluster: {cluster.id}")
            return True
        except Exception as e:
            logger.error(f"Failed to insert cluster: {e}")
            return False

    async def update(self, cluster: KnowledgeCluster) -> bool:
        """Update an existing knowledge cluster."""
        try:
            row = self._cluster_to_row(cluster)
            set_clause = ", ".join([f"{col} = ?" for col in row.keys() if col != "id"])
            values = [v for k, v in row.items() if k != "id"]
            values.append(cluster.id)

            self.db.execute(
                f"UPDATE {self.table_name} SET {set_clause} WHERE id = ?",
                values
            )
            self._mark_parquet_dirty()
            logger.info(f"Updated cluster: {cluster.id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update cluster: {e}")
            return False

    async def delete(self, cluster_id: str) -> bool:
        """Delete a knowledge cluster."""
        try:
            self.db.execute(
                f"DELETE FROM {self.table_name} WHERE id = ?",
                [cluster_id]
            )
            self._mark_parquet_dirty()
            logger.info(f"Deleted cluster: {cluster_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete cluster: {e}")
            return False

    async def list_all(self) -> List[KnowledgeCluster]:
        """List all knowledge clusters."""
        try:
            rows = self.db.fetch_all(f"SELECT * FROM {self.table_name}")
            return [self._row_to_cluster(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to list clusters: {e}")
            return []

    async def search_by_name(self, name_pattern: str) -> List[KnowledgeCluster]:
        """Search clusters by name pattern."""
        try:
            rows = self.db.fetch_all(
                f"SELECT * FROM {self.table_name} WHERE name ILIKE ?",
                [f"%{name_pattern}%"]
            )
            return [self._row_to_cluster(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to search clusters: {e}")
            return []

    async def search_similar_clusters(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        similarity_threshold: float = 0.7,
    ) -> List[Dict[str, Any]]:
        """Search for similar clusters using embedding similarity."""
        try:
            # Query using DuckDB's list_cosine_similarity function
            rows = self.db.fetch_all(
                f"""
                SELECT id, name, 
                       list_cosine_similarity(embedding_vector, ?) as similarity
                FROM {self.table_name}
                WHERE embedding_vector IS NOT NULL
                ORDER BY similarity DESC
                LIMIT ?
                """,
                [query_embedding, top_k]
            )
            
            results = []
            for row in rows:
                if row[2] >= similarity_threshold:
                    results.append({
                        "id": row[0],
                        "name": row[1],
                        "similarity": row[2],
                    })
            return results
        except Exception as e:
            logger.error(f"Failed to search similar clusters: {e}")
            return []
