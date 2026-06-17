# pangu-crawler (Python core)

盘古自研爬虫能力 - Python 端。W1 阶段提供 mock 抓取 + stdio JSON 协议，W2 阶段接 curl_cffi / Playwright 真抓取。

## 协议

stdin 读一行 JSON → 处理 → stdout 写一行 JSON。

```json
// 输入
{"url": "https://example.com", "format": "markdown", "trace_id": "xxx"}

// 成功
{"ok": true, "trace_id": "xxx", "result": {...}}

// 失败
{"ok": false, "trace_id": "xxx", "error": {...}}
```

## 安装

```bash
uv sync
```

## 测试

```bash
uv run pytest
uv run pytest --cov=pangu_crawler
```

## 运行

```bash
# W1 mock 模式
PANGU_CRAWLER_MOCK=1 uv run python -m pangu_crawler.cli

# W2 真实抓取（不需要 mock env）
echo '{"url": "https://example.com"}' | uv run python -m pangu_crawler.cli
```

## 错误格式

CrawlerError 完整字段透传（绝不吞错）：

```json
{
  "code": "TIMEOUT | HTTP_4XX | HTTP_5XX | CHALLENGE_FAILED | PARSE_ERROR | UNKNOWN",
  "status_code": 200,
  "url": "https://example.com",
  "attempts": 1,
  "fallback_attempted": false,
  "original_error": "..."
}
```
