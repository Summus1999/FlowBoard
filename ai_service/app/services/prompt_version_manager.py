"""
Prompt version registry with local JSON persistence.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from threading import Lock
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.exceptions import ResourceNotFoundException, VersionConflictException
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class PromptVersion:
    version: str
    content: str
    created_at: str
    metadata: Dict[str, Any]


class PromptVersionManager:
    """Manage prompt versions and active prompt resolution."""

    def __init__(self, registry_path: Optional[str] = None):
        self.registry_path = registry_path or settings.PROMPT_REGISTRY_PATH
        self._lock = Lock()
        self._registry: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.registry_path):
            self._registry = {}
            return
        with open(self.registry_path, "r", encoding="utf-8") as fp:
            self._registry = json.load(fp)

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.registry_path), exist_ok=True)
        with open(self.registry_path, "w", encoding="utf-8") as fp:
            json.dump(self._registry, fp, ensure_ascii=False, indent=2)

    def _next_version(self, prompt_name: str) -> str:
        versions = self._registry.get(prompt_name, {}).get("versions", {})
        if not versions:
            return "v1"
        numbers = []
        for key in versions.keys():
            if key.startswith("v") and key[1:].isdigit():
                numbers.append(int(key[1:]))
        return f"v{(max(numbers) if numbers else 0) + 1}"

    def register_prompt(
        self,
        prompt_name: str,
        content: str,
        version: Optional[str] = None,
        activate: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        with self._lock:
            bucket = self._registry.setdefault(prompt_name, {"active_version": None, "versions": {}})
            next_version = version or self._next_version(prompt_name)
            if next_version in bucket["versions"]:
                raise VersionConflictException(f"prompt version already exists: {prompt_name}:{next_version}")

            prompt_version = PromptVersion(
                version=next_version,
                content=content,
                created_at=datetime.utcnow().isoformat(),
                metadata=metadata or {},
            )
            bucket["versions"][next_version] = asdict(prompt_version)
            if activate:
                bucket["active_version"] = next_version
            self._save()
            logger.info("prompt.version_registered", prompt_name=prompt_name, version=next_version)
            return next_version

    def activate_prompt(self, prompt_name: str, version: str) -> None:
        with self._lock:
            bucket = self._registry.get(prompt_name)
            if not bucket or version not in bucket.get("versions", {}):
                raise ResourceNotFoundException(f"prompt version not found: {prompt_name}:{version}")
            bucket["active_version"] = version
            self._save()
            logger.info("prompt.version_activated", prompt_name=prompt_name, version=version)

    def rollback_prompt(self, prompt_name: str, target_version: str) -> None:
        self.activate_prompt(prompt_name=prompt_name, version=target_version)

    def get_prompt(self, prompt_name: str, default_content: str) -> str:
        bucket = self._registry.get(prompt_name)
        if not bucket:
            return default_content
        active = bucket.get("active_version")
        if not active:
            return default_content
        version_data = bucket.get("versions", {}).get(active)
        if not version_data:
            return default_content
        return version_data.get("content", default_content)

    def get_active_version(self, prompt_name: str) -> Optional[str]:
        bucket = self._registry.get(prompt_name)
        if not bucket:
            return None
        return bucket.get("active_version")

    def list_versions(self, prompt_name: str) -> List[Dict[str, Any]]:
        bucket = self._registry.get(prompt_name, {})
        versions = bucket.get("versions", {})
        return sorted(versions.values(), key=lambda item: item.get("created_at", ""), reverse=True)


_prompt_version_manager: Optional[PromptVersionManager] = None


def get_prompt_version_manager() -> PromptVersionManager:
    global _prompt_version_manager
    if _prompt_version_manager is None:
        _prompt_version_manager = PromptVersionManager()
    return _prompt_version_manager
