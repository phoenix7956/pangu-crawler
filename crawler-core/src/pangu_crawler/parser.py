"""
Pangu Crawler - 内容提取（HTML → Markdown/Text）

W1 阶段：基于 readability-lxml + html2text。
W2 阶段：根据实际效果调参。
"""
from __future__ import annotations


def to_markdown(html: str, extract_main: bool = True) -> str:
    """HTML → Markdown"""
    from html2text import html2text  # type: ignore

    cleaned = html
    if extract_main:
        cleaned = _readability_clean(html)

    h = html2text(cleaned, bodywidth=0)
    return h.strip()


def to_text(html: str, extract_main: bool = True) -> str:
    """HTML → 纯文本"""
    from html2text import html2text  # type: ignore

    cleaned = html
    if extract_main:
        cleaned = _readability_clean(html)

    h = html2text(cleaned, bodywidth=0)
    # 去掉 markdown 链接/格式
    import re

    h = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", h)
    h = re.sub(r"[*_`]+", "", h)
    return h.strip()


def _readability_clean(html: str) -> str:
    """用 readability 提取主要内容"""
    try:
        from readability import Document  # type: ignore

        doc = Document(html)
        return doc.summary(html_partial=True)
    except Exception:  # noqa: BLE001
        # readability 失败就用原始 HTML（W2 阶段加更智能 fallback）
        return html
