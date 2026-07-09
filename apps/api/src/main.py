from __future__ import annotations

import uvicorn

from src.core.app import create_app
from src.core.config import settings
from src.core.logging import setup_logging

app = create_app()

if __name__ == "__main__":
    setup_logging(settings.log_level)
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment != "mainnet",
        log_level=settings.log_level.lower(),
    )
