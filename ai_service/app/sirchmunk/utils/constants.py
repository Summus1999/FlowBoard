"""
Constants for Sirchmunk search system.
"""

import os
from pathlib import Path

# Default work path for Sirchmunk data
DEFAULT_WORK_PATH = os.path.expanduser("~/.flowboard/sirchmunk")

# Concurrent limit for ripgrep-all processes
GREP_CONCURRENT_LIMIT = 4

# Embedding vector dimension (sentence-transformers default)
EMBEDDING_DIM = 384

# Storage structure
class StorageStructure:
    """Directory structure constants."""
    CACHE_DIR = ".cache"
    GREP_DIR = "rga"
    KNOWLEDGE_DIR = "knowledge"
    MODELS_DIR = "models"
    SPEC_DIR = "spec"

# Search mode options
class SearchMode:
    """Search mode constants."""
    FILENAME_ONLY = "FILENAME_ONLY"
    FAST = "FAST"
    DEEP = "DEEP"

# Default search configuration
DEFAULT_TOP_K_FILES = 5
DEFAULT_TOP_K_SNIPPETS = 10
DEFAULT_MAX_TOKEN_BUDGET = 64000
DEFAULT_MAX_LOOPS = 10
DEFAULT_CLUSTER_SIM_THRESHOLD = 0.85
DEFAULT_CLUSTER_SIM_TOP_K = 3
