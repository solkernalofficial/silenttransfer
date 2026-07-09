"""Probe Postgres connectivity using ST_DATABASE_URL env."""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main() -> int:
    raw = os.environ.get("ST_DATABASE_URL", "").strip()
    if not raw:
        print("NO_URL")
        return 1
    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+asyncpg://", 1)
    host = raw.split("@")[-1].split("/")[0]
    print("host", host)
    eng = create_async_engine(raw, pool_pre_ping=True)
    try:
        async with eng.begin() as c:
            print("OK", (await c.execute(text("select 1"))).scalar())
            await c.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS st_pg_probe "
                    "(id serial primary key, t text)"
                )
            )
            await c.execute(text("INSERT INTO st_pg_probe (t) VALUES ('silent')"))
            print(
                "WRITE",
                (await c.execute(text("select count(*) from st_pg_probe"))).scalar(),
            )
        return 0
    except Exception as e:
        print("FAIL", type(e).__name__, str(e)[:400])
        return 1
    finally:
        await eng.dispose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
