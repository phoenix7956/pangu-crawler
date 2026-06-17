"""
Pangu Crawler - 配置（Python 端）

W1 阶段：基本读取。W2 阶段接 .env / Pydantic Settings。
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class CrawlerSettings:
    default_timeout_ms: int = 30000
    max_retries: int = 3
    use_proxy: bool = False
    python_path: str = "python3"

    @classmethod
    def from_env(cls) -> "CrawlerSettings":
        return cls(
            default_timeout_ms=int(os.environ.get("CRAWLER_DEFAULT_TIMEOUT_MS", 30000)),
            max_retries=int(os.environ.get("CRAWLER_MAX_RETRIES", 3)),
            use_proxy=os.environ.get("CRAWLER_USE_PROXY", "false").lower() == "true",
            python_path=os.environ.get("PANGU_CRAWLER_PYTHON", "python3"),
        )
