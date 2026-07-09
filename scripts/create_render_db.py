"""Create isolated silenttransfer database on existing Render Postgres free tier."""
from __future__ import annotations

import os
import sys

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def main() -> int:
    url = os.environ.get("PG_URL")
    if not url:
        print("PG_URL missing", file=sys.stderr)
        return 1

    # Render requires SSL on external connections
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"

    conn = psycopg2.connect(url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("silenttransfer",))
    if cur.fetchone():
        print("DB_EXISTS")
    else:
        cur.execute("CREATE DATABASE silenttransfer")
        print("DB_CREATED")
    cur.close()
    conn.close()
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
