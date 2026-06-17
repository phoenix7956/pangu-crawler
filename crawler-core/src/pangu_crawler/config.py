"""
Pangu Crawler - 配置（Python 端）

W1 阶段：基本读取。W2 阶段接 .env / Pydantic Settings。
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass


def _default_python_path() -> str:
    """跨平台 python 命令名: Mac/Linux 是 python3, Windows 是 python."""
    return "python" if sys.platform == "win32" else "python3"


@dataclass
class CrawlerSettings:
    default_timeout_ms: int = 30000
    max_retries: int = 3
    use_proxy: bool = False
    python_path: str = _default_python_path()

    @classmethod
    def from_env(cls) -> "CrawlerSettings":
        return cls(
            default_timeout_ms=int(os.environ.get("CRAWLER_DEFAULT_TIMEOUT_MS", 30000)),
            max_retries=int(os.environ.get("CRAWLER_MAX_RETRIES", 3)),
            use_proxy=os.environ.get("CRAWLER_USE_PROXY", "false").lower() == "true",
            python_path=os.environ.get("PANGU_CRAWLER_PYTHON") or _default_python_path(),
        )
