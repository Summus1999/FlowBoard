"""
Run offline evaluation pipeline as a standalone job.
"""

from __future__ import annotations

import asyncio
import json
import sys

from app.core.database import get_async_db_session
from app.services.evaluation_pipeline import get_offline_evaluation_pipeline


async def _run() -> int:
    async with get_async_db_session() as db:
        pipeline = get_offline_evaluation_pipeline()
        result = await pipeline.run(db=db)
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(_run()))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
