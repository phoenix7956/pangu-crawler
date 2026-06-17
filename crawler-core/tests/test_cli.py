"""cli.py 端到端测试（stdin/stdout JSON 协议）"""
import json
import subprocess
import sys
import os
from pathlib import Path


# 找到 cli.py 路径
CRAWLER_ROOT = Path(__file__).parent.parent
SRC_PATH = CRAWLER_ROOT / "src"
PYTHON = sys.executable


def _run_cli(request: dict, mock: bool = True) -> dict:
    """通过 subprocess 跑一次 cli，返解析后的 JSON"""
    env = os.environ.copy()
    if mock:
        env["PANGU_CRAWLER_MOCK"] = "1"
    else:
        env["PANGU_CRAWLER_MOCK"] = "0"

    proc = subprocess.run(
        [PYTHON, "-m", "pangu_crawler.cli"],
        input=json.dumps(request) + "\n",
        capture_output=True,
        text=True,
        timeout=10,
        env=env,
        cwd=str(CRAWLER_ROOT),
    )
    assert proc.returncode in (0, 2), f"unexpected returncode: {proc.returncode}, stderr: {proc.stderr}"
    return json.loads(proc.stdout.strip())


def test_cli_basic_web_fetch():
    resp = _run_cli({"url": "https://example.com", "trace_id": "test-1"})
    assert resp["ok"] is True
    assert resp["trace_id"] == "test-1"
    assert resp["result"]["status_code"] == 200
    assert "Mock content" in resp["result"]["content"]


def test_cli_format_markdown_default():
    resp = _run_cli({"url": "https://example.com"})
    assert resp["ok"] is True
    assert isinstance(resp["result"]["content"], str)
    assert len(resp["result"]["content"]) > 0


def test_cli_format_html():
    resp = _run_cli({"url": "https://example.com", "format": "html"})
    assert resp["ok"] is True
    assert "<html" in resp["result"]["content"].lower()


def test_cli_format_text():
    resp = _run_cli({"url": "https://example.com", "format": "text"})
    assert resp["ok"] is True


def test_cli_missing_url_returns_error():
    resp = _run_cli({})
    assert resp["ok"] is False
    assert resp["error"]["code"] == "UNKNOWN"
    assert "url" in resp["error"]["original_error"].lower()


def test_cli_error_response_includes_all_fields():
    resp = _run_cli({})
    err = resp["error"]
    assert "code" in err
    assert "status_code" in err
    assert "url" in err
    assert "attempts" in err
    assert "fallback_attempted" in err
    assert "original_error" in err


def test_cli_duration_ms_is_positive():
    resp = _run_cli({"url": "https://example.com"})
    assert resp["result"]["duration_ms"] >= 0


def test_cli_metadata_has_title():
    resp = _run_cli({"url": "https://example.com"})
    assert "title" in resp["result"]["metadata"]
    assert resp["result"]["metadata"]["title"]
