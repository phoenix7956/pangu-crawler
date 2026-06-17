"""
Pangu Crawler - 错误定义

设计原则（墨的硬要求）：
    错误信息必须完整透传给 MCP server，绝不吞。
    错误必须包含：code / status_code / url / attempts / fallback_attempted / original_error
"""
from dataclasses import dataclass, field
from typing import Literal, Optional


CrawlerErrorCode = Literal[
    "TIMEOUT",
    "HTTP_4XX",
    "HTTP_5XX",
    "CHALLENGE_FAILED",
    "PARSE_ERROR",
    "UNKNOWN",
]


@dataclass
class CrawlerError(Exception):
    """爬虫错误基类。W1 阶段定义，W2 阶段所有抓取异常都包成这个。"""

    code: CrawlerErrorCode
    status_code: Optional[int]
    url: str
    attempts: int = 1
    fallback_attempted: bool = False
    original_error: str = ""
    message: str = field(default="", init=False)

    def __post_init__(self) -> None:
        self.message = (
            f"[{self.code}] {self.url} "
            f"(status={self.status_code}, attempts={self.attempts}, "
            f"fallback={self.fallback_attempted}): {self.original_error}"
        )
        super().__init__(self.message)

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "status_code": self.status_code,
            "url": self.url,
            "attempts": self.attempts,
            "fallback_attempted": self.fallback_attempted,
            "original_error": self.original_error,
        }


# 便捷构造函数
def timeout_error(url: str, timeout_ms: int, stderr: str = "") -> CrawlerError:
    return CrawlerError(
        code="TIMEOUT",
        status_code=None,
        url=url,
        attempts=1,
        original_error=f"timeout after {timeout_ms}ms. stderr={stderr[:500]}",
    )


def http_error(
    url: str, status: int, body_excerpt: str = ""
) -> CrawlerError:
    code: CrawlerErrorCode = "HTTP_4XX" if 400 <= status < 500 else "HTTP_5XX"
    if 500 <= status < 600:
        code = "HTTP_5XX"
    elif 400 <= status < 500:
        code = "HTTP_4XX"
    return CrawlerError(
        code=code,
        status_code=status,
        url=url,
        original_error=f"HTTP {status}. body={body_excerpt[:500]}",
    )


def challenge_error(url: str, body_excerpt: str = "") -> CrawlerError:
    return CrawlerError(
        code="CHALLENGE_FAILED",
        status_code=403,
        url=url,
        original_error=f"Cloudflare/anti-bot challenge detected. body={body_excerpt[:500]}",
    )


def parse_error(url: str, err: str) -> CrawlerError:
    return CrawlerError(
        code="PARSE_ERROR",
        status_code=None,
        url=url,
        original_error=f"parse error: {err}",
    )
