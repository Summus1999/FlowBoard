"""
DuckDB database manager for Sirchmunk.

Provides a comprehensive interface for DuckDB operations including
connection management, table operations, data manipulation, and analytics.

Supports two operational modes:
1. Direct mode (default): connects to file-based or pure in-memory DB
2. Persist mode (persist_path): in-memory DB with periodic disk writeback
"""

import os
import atexit
import duckdb
import threading
from typing import Any, Dict, List, Optional, Union, Tuple
from pathlib import Path
import logging
from contextlib import contextmanager
from datetime import datetime

logger = logging.getLogger(__name__)


class DuckDBManager:
    """
    A comprehensive DuckDB database manager providing common operations
    for data storage, retrieval, and analytics in the Sirchmunk system.
    """

    _WRITE_KEYWORDS = frozenset([
        'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'COPY'
    ])

    def __init__(self, db_path: Optional[str] = None, read_only: bool = False,
                 persist_path: Optional[str] = None,
                 sync_interval: int = 60,
                 sync_threshold: int = 100):
        """
        Initialize DuckDB connection.

        Args:
            db_path: Path to database file. If None, creates in-memory database.
            read_only: Whether to open database in read-only mode.
            persist_path: Path to disk file for persistence (in-memory with writeback).
            sync_interval: Seconds between periodic disk syncs.
            sync_threshold: Dirty write count that triggers immediate sync.
        """
        self.db_path = db_path
        self.read_only = read_only
        self.persist_path = persist_path
        self.connection = None

        self._dirty_count = 0
        self._sync_threshold = sync_threshold
        self._sync_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._daemon_thread = None
        self._shutdown_registered = False

        if persist_path:
            Path(persist_path).parent.mkdir(parents=True, exist_ok=True)
            self.connection = duckdb.connect(":memory:")
            logger.info(f"Connected to in-memory DuckDB (persist: {persist_path})")
            self._load_from_disk()
            self._start_sync_daemon(sync_interval)
            self._register_shutdown_hook()
        else:
            self._connect()

    def _connect(self):
        """Establish database connection (direct mode only)."""
        try:
            if self.db_path:
                self.connection = duckdb.connect(self.db_path, read_only=self.read_only)
                logger.info(f"Connected to DuckDB at {self.db_path}")
            else:
                self.connection = duckdb.connect(":memory:")
                logger.info("Connected to in-memory DuckDB")
        except Exception as e:
            logger.error(f"Failed to connect to DuckDB: {e}")
            raise

    def _load_from_disk(self):
        """Load all tables from disk DuckDB file into in-memory database."""
        if not self.persist_path or not Path(self.persist_path).exists():
            logger.info(f"No disk file at {self.persist_path}, starting with empty database")
            return

        try:
            escaped_path = str(self.persist_path).replace("'", "''")
            self.connection.execute(f"ATTACH '{escaped_path}' AS disk_db (READ_ONLY)")

            tables = self.connection.execute(
                "SELECT table_name FROM duckdb_tables() "
                "WHERE database_name = 'disk_db' AND schema_name = 'main'"
            ).fetchall()

            for (table_name,) in tables:
                self.connection.execute(
                    f"CREATE TABLE main.{table_name} AS "
                    f"SELECT * FROM disk_db.{table_name}"
                )

            self.connection.execute("DETACH disk_db")
            logger.info(f"Loaded {len(tables)} tables from {self.persist_path}")

        except Exception as e:
            logger.warning(f"Failed to load from disk {self.persist_path}: {e}")
            try:
                self.connection.execute("DETACH disk_db")
            except Exception:
                pass

    def sync_to_disk(self):
        """Sync in-memory data to disk file atomically."""
        if not self.persist_path:
            return

        with self._sync_lock:
            if self._dirty_count == 0:
                return

            tables = self.list_tables()
            if not tables:
                self._dirty_count = 0
                return

            temp_path = f"{self.persist_path}.{os.getpid()}.tmp"
            try:
                if Path(temp_path).exists():
                    Path(temp_path).unlink()

                escaped_temp = temp_path.replace("'", "''")
                self.connection.execute(f"ATTACH '{escaped_temp}' AS sync_db")

                try:
                    for table in tables:
                        self.connection.execute(
                            f"CREATE TABLE sync_db.{table} AS "
                            f"SELECT * FROM main.{table}"
                        )
                    self.connection.execute("DETACH sync_db")
                except Exception:
                    try:
                        self.connection.execute("DETACH sync_db")
                    except Exception:
                        pass
                    raise

                os.replace(temp_path, self.persist_path)

                synced_ops = self._dirty_count
                self._dirty_count = 0
                logger.info(f"Synced {len(tables)} tables ({synced_ops} dirty ops) to {self.persist_path}")

            except Exception as e:
                logger.error(f"Failed to sync to disk: {e}")
                if Path(temp_path).exists():
                    try:
                        Path(temp_path).unlink()
                    except Exception:
                        pass

    def force_sync(self):
        """Force immediate sync to disk regardless of dirty count."""
        if self.persist_path and self.connection:
            if self._dirty_count == 0:
                self._dirty_count = 1
            self.sync_to_disk()

    def _mark_dirty(self):
        """Increment dirty counter and trigger sync if threshold reached."""
        self._dirty_count += 1
        if self._dirty_count >= self._sync_threshold:
            self.sync_to_disk()

    def _start_sync_daemon(self, interval: int):
        """Start a daemon thread for periodic disk sync."""
        def _sync_loop():
            while not self._stop_event.is_set():
                self._stop_event.wait(interval)
                if not self._stop_event.is_set():
                    try:
                        self.sync_to_disk()
                    except Exception as e:
                        logger.error(f"Daemon sync failed: {e}")

        thread_name = f"duckdb-sync-{Path(self.persist_path).stem}"
        self._daemon_thread = threading.Thread(
            target=_sync_loop, daemon=True, name=thread_name
        )
        self._daemon_thread.start()
        logger.info(f"Started sync daemon '{thread_name}' (interval={interval}s)")

    def _register_shutdown_hook(self):
        """Register atexit handler for graceful shutdown with final sync."""
        if self._shutdown_registered:
            return
        atexit.register(self._shutdown_sync)
        self._shutdown_registered = True

    def _shutdown_sync(self):
        """Stop daemon thread and perform final sync (called by atexit)."""
        self._stop_event.set()
        if self._daemon_thread and self._daemon_thread.is_alive():
            self._daemon_thread.join(timeout=5)

        if self.persist_path and self.connection:
            if self._dirty_count == 0:
                self._dirty_count = 1
            try:
                self.sync_to_disk()
            except Exception as e:
                logger.error(f"Final shutdown sync failed: {e}")

    def close(self):
        """Close database connection."""
        if self.persist_path:
            self._shutdown_sync()
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info("DuckDB connection closed")

    @contextmanager
    def transaction(self):
        """Context manager for database transactions."""
        try:
            self.connection.begin()
            yield self.connection
            self.connection.commit()
        except Exception as e:
            self.connection.rollback()
            logger.error(f"Transaction rolled back: {e}")
            raise

    def execute(self, query: str, parameters: Optional[List] = None):
        """Execute SQL query."""
        try:
            if parameters:
                result = self.connection.execute(query, parameters)
            else:
                result = self.connection.execute(query)

            if self.persist_path:
                first_word = query.strip().split(maxsplit=1)[0].upper() if query.strip() else ""
                if first_word in self._WRITE_KEYWORDS:
                    self._mark_dirty()

            return result
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def fetch_all(self, query: str, parameters: Optional[List] = None) -> List[Tuple]:
        """Execute query and fetch all results."""
        result = self.execute(query, parameters)
        return result.fetchall()

    def fetch_one(self, query: str, parameters: Optional[List] = None) -> Optional[Tuple]:
        """Execute query and fetch one result."""
        result = self.execute(query, parameters)
        return result.fetchone()

    def create_table(self, table_name: str, schema: Dict[str, str], if_not_exists: bool = True):
        """Create table with specified schema."""
        columns = ", ".join([f"{col} {dtype}" for col, dtype in schema.items()])
        if_not_exists_clause = "IF NOT EXISTS" if if_not_exists else ""
        query = f"CREATE TABLE {if_not_exists_clause} {table_name} ({columns})"
        self.execute(query)
        logger.info(f"Table {table_name} created successfully")

    def drop_table(self, table_name: str, if_exists: bool = True):
        """Drop table."""
        if_exists_clause = "IF EXISTS" if if_exists else ""
        query = f"DROP TABLE {if_exists_clause} {table_name}"
        self.execute(query)

    def insert_data(self, table_name: str, data: Union[Dict, List[Dict]]):
        """Insert data into table."""
        if isinstance(data, dict):
            data = [data]

        if not data:
            return

        columns = list(data[0].keys())
        placeholders = ", ".join(["?" for _ in columns])
        column_names = ", ".join(columns)

        query = f"INSERT INTO {table_name} ({column_names}) VALUES ({placeholders})"

        for row in data:
            values = [row.get(col) for col in columns]
            self.execute(query, values)

        logger.info(f"Data inserted into {table_name}")

    def table_exists(self, table_name: str) -> bool:
        """Check if table exists."""
        query = """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_name = ?
        """
        result = self.fetch_one(query, [table_name])
        return result[0] > 0 if result else False

    def get_table_count(self, table_name: str) -> int:
        """Get row count for table."""
        query = f"SELECT COUNT(*) FROM {table_name}"
        result = self.fetch_one(query)
        return result[0] if result else 0

    def list_tables(self) -> List[str]:
        """Get list of all tables in database."""
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
        result = self.fetch_all(query)
        return [row[0] for row in result]

    def export_to_parquet(self, table_name: str, file_path: str):
        """Export table data to Parquet file."""
        query = f"COPY {table_name} TO '{file_path}' (FORMAT PARQUET)"
        self.execute(query)
        logger.info(f"Table {table_name} exported to Parquet: {file_path}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        if hasattr(self, 'connection') and self.connection:
            self.close()
