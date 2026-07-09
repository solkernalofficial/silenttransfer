"""Create SilentTransfer tables on Postgres (st_* isolation)."""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))

# Set before importing session
if "DATABASE_URL" not in os.environ and "ST_DATABASE_URL" in os.environ:
    os.environ["DATABASE_URL"] = os.environ["ST_DATABASE_URL"]


async def main() -> int:
    from src.models.session import init_db, engine
    from sqlalchemy import text

    await init_db()
    async with engine.begin() as conn:
        rows = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name LIKE 'st_%' "
                "ORDER BY table_name"
            )
        )
        tables = [r[0] for r in rows.fetchall()]
        print("TABLES", tables)
    await engine.dispose()
    return 0 if tables else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
