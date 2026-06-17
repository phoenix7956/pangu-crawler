"""
Pangu Crawler - HTTP 抓取层

W1 阶段：占位实现（接 curl_cffi 但不真抓，返 mock HTML）。
W2 阶段：实抓 + 失败检测 + 降级到 Playwright。

降级策略（W2 任务 T2.8）：
    1. curl_cffi 抓 → 成功 → 返
    2. 失败/被 CF 拦 → Playwright headless 重试
    3. 都失败 → 抛 CrawlerError
"""
from __future__ import annotations

from typing import Optional, Tuple

from .errors import CrawlerError, http_error, challenge_error


def fetch_url(
    url: str,
    timeout_ms: int = 30000,
    wait_for_selector: Optional[str] = None,
    use_proxy: bool = False,
    headers: Optional[dict[str, str]] = None,
) -> Tuple[str, str, int, str, dict]:
    """
    抓取 URL 返 (html, final_url, status_code, mode, metadata)

    mode: 'http' or 'playwright'
    metadata: {title, description, content_type, redirected}
    """
    # W1 阶段：先检查环境变量走 mock
    import os
    if os.environ.get("PANGU_CRAWLER_MOCK") == "1":
        return _mock_fetch(url)

    # W2 阶段：实抓
    try:
        from curl_cffi import requests as cffi_requests  # type: ignore
    except ImportError:
        raise CrawlerError(
            code="UNKNOWN",
            status_code=None,
            url=url,
            original_error="curl_cffi not installed. run: uv sync",
        )

    timeout_s = timeout_ms / 1000.0
    try:
        resp = cffi_requests.get(
            url,
            timeout=timeout_s,
            impersonate="chrome",
            headers=headers or {},
        )
    except Exception as e:  # noqa: BLE001
        raise CrawlerError(
            code="TIMEOUT",
            status_code=None,
            url=url,
            original_error=f"curl_cffi request failed: {e}",
        )

    # CF challenge 检测
    if _is_cf_challenge(resp.text):
        raise challenge_error(url, resp.text[:500])

    # 4xx/5xx
    if resp.status_code >= 400:
        raise http_error(url, resp.status_code, resp.text[:500])

    metadata = _extract_metadata(resp.text, resp.headers)
    return resp.text, str(resp.url), resp.status_code, "http", metadata


def _mock_fetch(url: str) -> Tuple[str, str, int, str, dict]:
    """W1 mock：返一个简单的 HTML 让 parser 能跑通"""
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Mock page for {url}</title>
    <meta name="description" content="This is a W1 mock response">
    <meta property="og:description" content="OpenGraph description for {url}">
</head>
<body>
    <h1>Mock content for {url}</h1>
    <p>This is a W1 mock response. W2 will use real crawler.</p>
    <article>
        <h2>Article heading</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    </article>
    <nav>Navigation (to be filtered by readability)</nav>
    <footer>Footer (to be filtered by readability)</footer>
</body>
</html>
"""
    metadata = {
        "title": f"Mock page for {url}",
        "description": "This is a W1 mock response",
        "content_type": "text/html; charset=utf-8",
        "redirected": False,
    }
    return html, url, 200, "http", metadata


def _is_cf_challenge(body: str) -> bool:
    """检测是否是 Cloudflare 挑战页"""
    markers = [
        "cf-challenge",
        "cf_chl_opt",
        "checking your browser",
        "just a moment",
        "attention required! | cloudflare",
    ]
    body_lower = body.lower()
    return any(m in body_lower for m in markers)


def _extract_metadata(html: str, headers: dict) -> dict:
    """从 HTML 提取 title/description/content_type"""
    import re

    title = None
    title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    if title_match:
        title = title_match.group(1).strip()

    description = None
    desc_match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if desc_match:
        description = desc_match.group(1).strip()

    return {
        "title": title,
        "description": description,
        "content_type": headers.get("content-type") or headers.get("Content-Type"),
        "redirected": False,  # TODO W2: track redirect chain
    }
