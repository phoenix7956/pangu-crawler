#!/usr/bin/env python3
"""
W2 反爬 baseline 测试 — 抓 examples/test_urls.txt 里的 10 个公开站

用法: uv run python examples/test_fetch.py
输出: 控制台表格 + docs/BASELINE.md (如加 --update-md)

设计:
- 用 fetcher.fetch_url() 直接抓 (绕过 MCP server)
- 每站最多 15s 超时
- 记录: 状态码, 模式(http/playwright), 耗时(ms), 错误码, 是否 CF challenge
- 汇总: 成功率, 平均耗时, 失败原因分类
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Optional

# 允许从项目根跑
# examples/test_fetch.py → crawler-core/ → pangu-crawler/ (项目根)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CRAWLER_CORE_ROOT = PROJECT_ROOT / "crawler-core"
sys.path.insert(0, str(CRAWLER_CORE_ROOT / "src"))

from pangu_crawler.fetcher import fetch_url  # noqa: E402
from pangu_crawler.errors import CrawlerError  # noqa: E402

TEST_URLS_FILE = PROJECT_ROOT / "examples" / "test_urls.txt"
TIMEOUT_S = 15


def parse_urls(path: Path) -> list[str]:
    """从 test_urls.txt 解析 URL 列表"""
    urls = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("---") or line.startswith("==="):
            continue
        urls.append(line)
    return urls


def fetch_one(url: str) -> dict:
    """抓一个 URL, 返结果 dict"""
    started = time.time()
    try:
        html, final_url, status, mode, metadata = fetch_url(
            url, timeout_ms=TIMEOUT_S * 1000
        )
        duration_ms = int((time.time() - started) * 1000)
        return {
            "url": url,
            "status": status,
            "mode": mode,
            "duration_ms": duration_ms,
            "error": None,
            "title": metadata.get("title"),
            "content_length": len(html),
        }
    except CrawlerError as e:
        duration_ms = int((time.time() - started) * 1000)
        return {
            "url": url,
            "status": e.status_code or 0,
            "mode": "failed",
            "duration_ms": duration_ms,
            "error": e.code,
            "error_msg": e.original_error[:200],
            "title": None,
            "content_length": 0,
        }
    except Exception as e:  # noqa: BLE001
        duration_ms = int((time.time() - started) * 1000)
        return {
            "url": url,
            "status": 0,
            "mode": "failed",
            "duration_ms": duration_ms,
            "error": "EXCEPTION",
            "error_msg": str(e)[:200],
            "title": None,
            "content_length": 0,
        }


def print_table(results: list[dict]) -> None:
    """打印汇总表格"""
    print()
    print(f"{'#':<3} {'URL':<50} {'状态':<6} {'模式':<10} {'耗时':<8} {'错误':<20}")
    print("-" * 100)
    for i, r in enumerate(results, 1):
        url_short = r["url"][:48] + ".." if len(r["url"]) > 50 else r["url"]
        err = (r.get("error") or "OK")[:18]
        print(f"{i:<3} {url_short:<50} {r['status']:<6} {r['mode']:<10} {r['duration_ms']:>5}ms {err:<20}")
    print("-" * 100)


def summarize(results: list[dict]) -> dict:
    """汇总统计"""
    total = len(results)
    ok = sum(1 for r in results if r["error"] is None)
    failed = total - ok
    durations = [r["duration_ms"] for r in results if r["error"] is None]
    avg_ms = sum(durations) // len(durations) if durations else 0

    # 失败原因分类
    by_error: dict[str, int] = {}
    for r in results:
        if r["error"]:
            by_error[r["error"]] = by_error.get(r["error"], 0) + 1

    return {
        "total": total,
        "ok": ok,
        "failed": failed,
        "success_rate": f"{ok / total * 100:.0f}%" if total else "0%",
        "avg_duration_ms": avg_ms,
        "errors": by_error,
    }


def main() -> int:
    if not TEST_URLS_FILE.exists():
        print(f"❌ Test URLs 文件不存在: {TEST_URLS_FILE}")
        return 1

    urls = parse_urls(TEST_URLS_FILE)
    print(f"📋 抓 {len(urls)} 个公开站 (单 URL 超时 {TIMEOUT_S}s)\n")

    results = []
    for i, url in enumerate(urls, 1):
        print(f"  [{i}/{len(urls)}] 抓 {url} ...", end=" ", flush=True)
        r = fetch_one(url)
        results.append(r)
        status_emoji = "✅" if r["error"] is None else "❌"
        print(f"{status_emoji} {r['status']} ({r['duration_ms']}ms)")

    print_table(results)
    summary = summarize(results)
    print()
    print(f"📊 汇总: 成功 {summary['ok']}/{summary['total']} ({summary['success_rate']}), "
          f"失败 {summary['failed']}, 平均耗时 {summary['avg_duration_ms']}ms")
    if summary["errors"]:
        print(f"   失败原因: {summary['errors']}")

    # 如果加 --update-md,自动填 BASELINE.md
    if "--update-md" in sys.argv:
        update_baseline_md(results, summary)
        print()
        print(f"✅ docs/BASELINE.md 已更新")

    return 0 if summary["ok"] >= summary["total"] * 0.7 else 1


def update_baseline_md(results: list[dict], summary: dict) -> None:
    """填 docs/BASELINE.md 的 W2 测试结果表"""
    md_path = PROJECT_ROOT / "docs" / "BASELINE.md"
    if not md_path.exists():
        print(f"⚠️ {md_path} 不存在,跳过更新")
        return

    content = md_path.read_text()

    # 填 W2 测试结果表
    table_lines = [
        "| # | URL | 状态 | 模式 | 耗时(ms) | 错误码 | 备注 |",
        "|---|-----|------|------|----------|--------|------|",
    ]
    for i, r in enumerate(results, 1):
        url_short = r["url"].replace("https://", "").rstrip("/")
        url_short = url_short[:40] + ".." if len(url_short) > 40 else url_short
        title = (r.get("title") or "")[:30]
        table_lines.append(
            f"| {i} | {url_short} | {r['status']} | {r['mode']} | {r['duration_ms']} | "
            f"{r.get('error') or 'OK'} | {title} |"
        )

    err_breakdown = ", ".join(f"{k}: {v}" for k, v in summary["errors"].items()) or "无"
    summary_block = f"""**汇总**:
- 总测试: {summary['total']}
- 成功: {summary['ok']}
- 失败: {summary['failed']}
- 成功率: {summary['success_rate']}
- 平均耗时: {summary['avg_duration_ms']}ms
- 失败原因: {err_breakdown}"""

    # 用正则替换 W2 测试结果表
    new_table = "\n".join(table_lines)
    content = re.sub(
        r"\| # \| URL \| 状态 \| 模式 \| 耗时\(ms\) \| 错误码 \| 备注 \|\n\|---.*?\n(\|.*?\n)+",
        new_table + "\n",
        content,
        count=1,
    )
    content = re.sub(
        r"\*\*汇总\*\*:.*?(?=\n\n|\n#)",
        summary_block,
        content,
        count=1,
        flags=re.DOTALL,
    )
    md_path.write_text(content)


if __name__ == "__main__":
    sys.exit(main())
