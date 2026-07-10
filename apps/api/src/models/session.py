from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings


def _normalize_database_url(url: str) -> tuple[str, dict]:
    """Return (sqlalchemy_url, connect_args) for async engines."""
    connect_args: dict = {}
    raw = (url or "").strip()
    if not raw:
        raw = "sqlite:///./dev.db"

    if raw.startswith("sqlite://"):
        raw = raw.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return raw, connect_args

    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)

    # asyncpg: ssl via connect_args (sslmode query is not always honored)
    if raw.startswith("postgresql+asyncpg://"):
        parsed = urlparse(raw)
        qs = parse_qs(parsed.query)
        ssl_keys = ("ssl", "sslmode")
        want_ssl = False
        for k in ssl_keys:
            if k in qs:
                val = (qs[k][0] or "").lower()
                if val in ("1", "true", "require", "verify-full", "verify-ca", "prefer"):
                    want_ssl = True
                # strip driver-specific keys from URL
                del qs[k]
        # Render / managed PG external always needs TLS
        host = (parsed.hostname or "").lower()
        if any(
            x in host
            for x in (
                "render.com",
                "supabase.co",
                "neon.tech",
                "insforge.app",
                "rlwy.net",
                "railway.app",
            )
        ):
            want_ssl = True
        if want_ssl:
            import ssl

            ctx = ssl.create_default_context()
            # Railway TCP proxy (*.proxy.rlwy.net) and some managed PG
            # edges present a proxy cert that fails strict verify.
            if any(
                x in host
                for x in (
                    "rlwy.net",
                    "railway.app",
                    "render.com",
                )
            ):
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ctx
        new_query = urlencode({k: v[0] for k, v in qs.items()})
        raw = urlunparse(parsed._replace(query=new_query))

    return raw, connect_args


DATABASE_URL, _ENGINE_CONNECT_ARGS = _normalize_database_url(settings.database_url)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_ENGINE_CONNECT_ARGS,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from src.models.database import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
