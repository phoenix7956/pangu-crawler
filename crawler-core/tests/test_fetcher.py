"""fetcher.py 单元测试（W1 阶段：mock 模式）"""
import os
import pytest

# 必须先设环境变量再 import
os.environ["PANGU_CRAWLER_MOCK"] = "1"

from pangu_crawler.fetcher import fetch_url, _is_cf_challenge  # noqa: E402


def test_mock_fetch_returns_200():
    html, final_url, status, mode, metadata = fetch_url("https://example.com")
    assert status == 200
    assert mode == "http"
    assert final_url == "https://example.com"
    assert "<html" in html.lower()
    assert metadata["title"] == "Mock page for https://example.com"


def test_mock_fetch_metadata_has_title():
    _, _, _, _, metadata = fetch_url("https://test.com")
    assert metadata["title"]
    assert "Mock page" in metadata["title"]


def test_mock_fetch_metadata_has_description():
    _, _, _, _, metadata = fetch_url("https://test.com")
    assert metadata["description"]


def test_mock_fetch_content_type():
    _, _, _, _, metadata = fetch_url("https://test.com")
    assert "html" in metadata["content_type"].lower()


def test_cf_challenge_detection_positive():
    body = "<html><body>cf-challenge-running</body></html>"
    assert _is_cf_challenge(body) is True


def test_cf_challenge_detection_just_a_moment():
    body = "<html><body>Just a moment...</body></html>"
    assert _is_cf_challenge(body) is True


def test_cf_challenge_detection_negative():
    body = "<html><body>Normal page content</body></html>"
    assert _is_cf_challenge(body) is False


def test_fetch_respects_timeout_param():
    """timeout_ms 参数不会让 mock 失败"""
    html, final_url, status, mode, metadata = fetch_url("https://test.com", timeout_ms=5000)
    assert status == 200


def test_fetch_passes_wait_for_selector():
    """W1 mock 不真用 selector，但不报错"""
    html, final_url, status, mode, metadata = fetch_url(
        "https://test.com", wait_for_selector=".content"
    )
    assert status == 200


def test_fetch_passes_use_proxy():
    """W1 mock 不真用 proxy，但不报错"""
    html, final_url, status, mode, metadata = fetch_url(
        "https://test.com", use_proxy=True
    )
    assert status == 200
