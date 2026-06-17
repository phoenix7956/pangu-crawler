"""
Pangu Crawler - CLI 入口

W1 阶段：从 stdin 读一行 JSON，返一行 JSON。W2 阶段接真实抓取。
W2 阶段：接 curl_cffi + Playwright + readability。

协议：
    输入（stdin，每行一个 JSON）：
        {
            "url": "https://example.com",
            "format": "markdown",   # 可选
            "trace_id": "uuid-xxx"  # 可选，透传给日志
        }

    输出（stdout，每行一个 JSON）：
        成功: {"ok": true, "trace_id": "xxx", "result": {...}}
        失败: {"ok": false, "trace_id": "xxx", "error": {...}}
"""
from __future__ import annotations

import json
import sys
import time
from typing import Any, Optional

from .errors import CrawlerError, parse_error
from .fetcher import fetch_url
from .parser import to_markdown, to_text


def _read_request() -> dict[str, Any]:
    """从 stdin 读一行 JSON 请求"""
    line = sys.stdin.readline()
    if not line:
        raise EOFError("empty stdin")
    return json.loads(line)


def _emit(payload: dict[str, Any]) -> None:
    """写一行 JSON 到 stdout。末尾带换行。"""
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _handle(req: dict[str, Any]) -> dict[str, Any]:
    """处理一次抓取请求。W1 阶段：mock；W2 阶段：真实抓取。"""
    trace_id: Optional[str] = req.get("trace_id")
    url: str = req.get("url", "")
    fmt: str = req.get("format", "markdown")
    timeout_ms: int = int(req.get("timeout_ms", 30000))
    extract_main: bool = bool(req.get("extract_main", True))
    wait_for_selector: Optional[str] = req.get("wait_for_selector")
    use_proxy: bool = bool(req.get("use_proxy", False))
    headers: Optional[dict[str, str]] = req.get("headers")

    if not url:
        err = CrawlerError(
            code="UNKNOWN",
            status_code=None,
            url="",
            original_error="missing required field: url",
        )
        return {"ok": False, "trace_id": trace_id, "error": err.to_dict()}

    started = time.time()
    try:
        # 调 fetcher
        html, final_url, status_code, mode, metadata = fetch_url(
            url=url,
            timeout_ms=timeout_ms,
            wait_for_selector=wait_for_selector,
            use_proxy=use_proxy,
            headers=headers,
        )
    except CrawlerError as e:
        return {"ok": False, "trace_id": trace_id, "error": e.to_dict()}
    except Exception as e:  # noqa: BLE001
        return {
            "ok": False,
            "trace_id": trace_id,
            "error": parse_error(url, str(e)).to_dict(),
        }

    # 内容提取
    try:
        if fmt == "markdown":
            content = to_markdown(html, extract_main=extract_main)
        elif fmt == "text":
            content = to_text(html, extract_main=extract_main)
        else:  # html
            content = html
    except Exception as e:  # noqa: BLE001
        return {
            "ok": False,
            "trace_id": trace_id,
            "error": parse_error(url, f"content extraction failed: {e}").to_dict(),
        }

    duration_ms = int((time.time() - started) * 1000)
    return {
        "ok": True,
        "trace_id": trace_id,
        "result": {
            "content": content,
            "final_url": final_url,
            "status_code": status_code,
            "mode": mode,
            "duration_ms": duration_ms,
            "metadata": {
                **metadata,
                "content_length": len(content),
            },
        },
    }


def main() -> int:
    """CLI 主入口。读一行 JSON，处理，输出一行 JSON。"""
    try:
        req = _read_request()
    except EOFError:
        return 0
    except json.JSONDecodeError as e:
        _emit({"ok": False, "error": {"code": "PARSE_ERROR", "original_error": str(e)}})
        return 1

    resp = _handle(req)
    _emit(resp)
    return 0 if resp.get("ok") else 2


if __name__ == "__main__":
    sys.exit(main())
