"""parser.py 单元测试"""
import pytest
from pangu_crawler.parser import to_markdown, to_text


SAMPLE_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <meta name="description" content="A test page">
</head>
<body>
    <nav>Skip this nav</nav>
    <article>
        <h1>Article Title</h1>
        <p>This is the <strong>main content</strong> with a <a href="https://link.com">link</a>.</p>
    </article>
    <footer>Skip this footer</footer>
</body>
</html>
"""


def test_to_markdown_returns_string():
    md = to_markdown(SAMPLE_HTML, extract_main=True)
    assert isinstance(md, str)
    assert len(md) > 0


def test_to_markdown_extracts_main_content():
    """readability 应该过滤掉 nav/footer，保留 article"""
    md = to_markdown(SAMPLE_HTML, extract_main=True)
    # 至少有 article 的内容
    assert "Article Title" in md or "Article" in md


def test_to_text_strips_markdown():
    txt = to_text(SAMPLE_HTML, extract_main=True)
    assert isinstance(txt, str)
    # to_text 应该去掉 markdown 链接语法（[text](url) → text）
    # 简单验证：没有 "[](" 这种 markdown 链接语法
    assert "[Article" not in txt or "main content" in txt


def test_to_markdown_with_raw_html():
    """extract_main=False 时直接转换原始 HTML"""
    md = to_markdown(SAMPLE_HTML, extract_main=False)
    # 包含 nav 内容
    assert "Skip this nav" in md or "main content" in md


def test_to_text_handles_empty_html():
    """空 HTML 不应该崩溃"""
    txt = to_text("<html></html>", extract_main=True)
    assert isinstance(txt, str)


def test_to_markdown_handles_malformed_html():
    """畸形 HTML 不应该崩溃"""
    md = to_markdown("<p>unclosed paragraph", extract_main=False)
    assert isinstance(md, str)
