"""errors.py 单元测试"""
import pytest
from pangu_crawler.errors import (
    CrawlerError,
    timeout_error,
    http_error,
    challenge_error,
    parse_error,
)


def test_crawler_error_basic():
    e = CrawlerError(
        code="TIMEOUT",
        status_code=None,
        url="https://example.com",
        original_error="test error",
    )
    assert e.code == "TIMEOUT"
    assert e.url == "https://example.com"
    assert "TIMEOUT" in str(e)
    assert "https://example.com" in str(e)


def test_crawler_error_to_dict_has_all_fields():
    e = CrawlerError(
        code="HTTP_4XX",
        status_code=404,
        url="https://example.com",
        attempts=2,
        fallback_attempted=True,
        original_error="not found",
    )
    d = e.to_dict()
    assert d["code"] == "HTTP_4XX"
    assert d["status_code"] == 404
    assert d["url"] == "https://example.com"
    assert d["attempts"] == 2
    assert d["fallback_attempted"] is True
    assert d["original_error"] == "not found"


def test_timeout_error_helper():
    e = timeout_error("https://x.com", 5000, "stderr text")
    assert e.code == "TIMEOUT"
    assert e.status_code is None
    assert "5000ms" in e.original_error
    assert "stderr text" in e.original_error


def test_http_error_4xx():
    e = http_error("https://x.com", 403, "<html>denied</html>")
    assert e.code == "HTTP_4XX"
    assert e.status_code == 403
    assert "denied" in e.original_error


def test_http_error_5xx():
    e = http_error("https://x.com", 503, "service unavailable")
    assert e.code == "HTTP_5XX"
    assert e.status_code == 503


def test_challenge_error():
    e = challenge_error("https://x.com", "cf-challenge page")
    assert e.code == "CHALLENGE_FAILED"
    assert e.status_code == 403
    assert "cf-challenge" in e.original_error


def test_parse_error():
    e = parse_error("https://x.com", "unexpected token")
    assert e.code == "PARSE_ERROR"
    assert "unexpected token" in e.original_error


def test_crawler_error_message_contains_all_fields():
    e = CrawlerError(
        code="HTTP_5XX",
        status_code=500,
        url="https://x.com",
        attempts=3,
        fallback_attempted=True,
        original_error="internal error",
    )
    msg = str(e)
    assert "HTTP_5XX" in msg
    assert "500" in msg
    assert "https://x.com" in msg
    assert "attempts=3" in msg
    assert "fallback=True" in msg
    assert "internal error" in msg


def test_crawler_error_can_be_raised_and_caught():
    with pytest.raises(CrawlerError) as exc_info:
        raise CrawlerError(
            code="UNKNOWN",
            status_code=None,
            url="https://x.com",
            original_error="test",
        )
    assert exc_info.value.code == "UNKNOWN"
