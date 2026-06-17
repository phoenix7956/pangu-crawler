# Pangu Crawler API 规范

## MCP 协议

**Transport**: stdio（JSON-RPC）  
**W2 备选**: HTTP+SSE（如果 Pangu 端需要）

---

## Tools

### `web_fetch`

抓取一个 URL 并返回结构化内容。**W1 阶段：mock；W2 阶段：真实抓取。**

#### 输入

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `url` | string (URL) | ✅ | - | 目标 URL |
| `format` | enum | ❌ | `markdown` | `markdown` / `text` / `html` |
| `timeout_ms` | int | ❌ | 30000 | 单次超时（ms） |
| `max_retries` | int | ❌ | 3 | 重试次数 |
| `use_proxy` | bool | ❌ | false | 是否走代理（W1 stub） |
| `wait_for_selector` | string | ❌ | null | Playwright 模式下等待的 CSS 选择器 |
| `extract_main` | bool | ❌ | true | 是否用 readability 提取主要内容 |
| `headers` | object | ❌ | null | 自定义 headers |

#### 输出（成功）

```json
{
  "ok": true,
  "trace_id": "uuid-xxx",
  "result": {
    "content": "# Markdown content...",
    "final_url": "https://example.com",
    "status_code": 200,
    "mode": "http",
    "duration_ms": 1234,
    "metadata": {
      "title": "Page Title",
      "description": "...",
      "content_type": "text/html",
      "content_length": 12345,
      "redirected": false
    }
  }
}
```

#### 输出（错误）

```json
{
  "ok": false,
  "trace_id": "uuid-xxx",
  "error": {
    "code": "TIMEOUT | HTTP_4XX | HTTP_5XX | CHALLENGE_FAILED | PARSE_ERROR | UNKNOWN",
    "status_code": 200,
    "url": "https://example.com",
    "attempts": 1,
    "fallback_attempted": false,
    "original_error": "..."
  }
}
```

#### MCP 协议层

成功响应：
```json
{
  "content": [{"type": "text", "text": "{...上面的 JSON...}"}]
}
```

错误响应（`isError: true`）：
```json
{
  "content": [{"type": "text", "text": "{...error JSON...}"}],
  "isError": true
}
```

---

## 错误码

| code | 触发条件 |
|------|----------|
| `TIMEOUT` | 抓取超时（> timeout_ms） |
| `HTTP_4XX` | 4xx 响应（不含 403 CF challenge） |
| `HTTP_5XX` | 5xx 响应 |
| `CHALLENGE_FAILED` | Cloudflare/anti-bot challenge 拦截 |
| `PARSE_ERROR` | HTML 解析失败 |
| `UNKNOWN` | 其他未分类错误（含参数错误） |

**W1 阶段**：CrawlerError 全部定义但只触发 `UNKNOWN`（mock 不真抓）。  
**W2 阶段**：接 curl_cffi 后全链路触发。

---

## 健康检查

**W1 阶段**：stdio 模式下没有 HTTP 端点。健康检查通过 `healthCheck()` 方法（W1.5）。

```typescript
import { PanguCrawlerServer } from './server.js';
const server = new PanguCrawlerServer();
console.log(server.healthCheck());
// {
//   ok: true,
//   server: { name: 'pangu-crawler', version: '0.1.0' },
//   crawler_config: { python_path: 'python3', crawler_module: 'pangu_crawler.cli' },
//   ts: '2026-06-17T...'
// }
```

**W2 阶段**（可选）：起一个独立 HTTP 端口 `/health` 用于 k8s 探针。

---

## stdio 协议（MCP server ↔ Python）

**MCP server 启 Python 子进程**：
```json
{"url": "https://example.com", "format": "markdown", "trace_id": "xxx"}
```

**Python 返**：
```json
{"ok": true, "trace_id": "xxx", "result": {...}}
```
或
```json
{"ok": false, "trace_id": "xxx", "error": {...}}
```

每行一个 JSON，UTF-8。

---

## 版本

- v0.1.0 (W1) — MCP server 框架 + mock
- v0.2.0 (W2) — 真实抓取 + Playwright 降级
