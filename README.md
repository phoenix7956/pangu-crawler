# pangu-crawler (W1 MVP)

盘古自研爬虫能力的 W1-2 MVP。给盘古 agent 提供**自研可控、可扩展、可降级**的网页抓取能力。

> **W1 阶段**：MCP server 框架 + mock 抓取 + stdio 通信管道  
> **W2 阶段**：真实抓取（curl_cffi + Playwright 降级）+ 反爬 baseline 记录

---

## 架构（一图流）

```
Pangu Agent  ──(MCP/stdio/JSON-RPC)──>  pangu-crawler-mcp (Node.js+TS)
                                              │
                                              ├── list_tools → web_fetch
                                              │
                                              └── spawn (Python 子进程)
                                                       │
                                                       ▼
                                                 pangu_crawler.cli (Python 3.11+)
                                                       │
                                                  ┌────┴────┐
                                                  ▼         ▼
                                             curl_cffi  Playwright
                                              (HTTP)   (JS 渲染)
                                                  │         │
                                                  └────┬────┘
                                                       ▼
                                                 readability + html2text
                                                       │
                                                       ▼
                                                 Markdown
```

**关键设计**：
- 业务策略层（MCP 接口 / 降级策略 / 信息库摄入）✅ **自研**
- 工程能力层（curl_cffi / Playwright / Camoufox）❌ **用现成，跟升级是稳赢**
- 底层协议层（TLS / 浏览器内核 / CF 对抗）❌ **永不碰**

---

## 项目结构

```
pangu-crawler/
├── README.md                          # 本文件
├── docs/
│   ├── DEV.md                         # 开发文档（墨 v0.1 + Hermes 修订）
│   ├── API.md                         # 接口规范
│   ├── TESTING.md                     # 测试策略
│   └── BASELINE.md                    # W2 反爬 baseline（待 W2 写）
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── config.json                    # MCP server 配置
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts                   # 入口
│   │   ├── server.ts                  # MCP server 实现
│   │   ├── crawler_client.ts          # stdio → Python 通信
│   │   ├── config.ts                  # 配置加载
│   │   ├── logger.ts                  # pino logger
│   │   └── tools/
│   │       └── web_fetch.ts           # web_fetch tool
│   └── tests/
│       ├── config.test.ts
│       ├── web_fetch.test.ts
│       ├── crawler_client.test.ts
│       ├── server.test.ts
│       └── e2e.test.ts
├── crawler-core/
│   ├── pyproject.toml                 # uv 管理
│   ├── .env.example
│   ├── src/pangu_crawler/
│   │   ├── __init__.py
│   │   ├── __main__.py
│   │   ├── cli.py                     # stdio JSON-RPC 入口
│   │   ├── fetcher.py                 # HTTP 抓取（curl_cffi）
│   │   ├── browser.py                 # Playwright 降级（W2）
│   │   ├── parser.py                  # readability + html2text
│   │   ├── errors.py                  # CrawlerError
│   │   └── config.py
│   └── tests/
│       ├── test_errors.py
│       ├── test_fetcher.py
│       ├── test_parser.py
│       └── test_cli.py
├── examples/
│   ├── test_urls.txt                  # 10 个测试 URL
│   └── test_outputs/                  # 抓取结果
└── scripts/
    ├── start.sh                       # 启动 MCP server
    └── test.sh                        # 跑测试
```

---

## 快速开始

### 安装

```bash
# MCP server
cd mcp-server
pnpm install  # 或 npm install

# Crawler core
cd ../crawler-core
uv sync
```

### 跑 W1 测试

```bash
# MCP server 测试
cd mcp-server
pnpm test                    # 单元 + e2e
pnpm test:coverage           # 覆盖率（目标 ≥ 80%）

# Crawler core 测试
cd ../crawler-core
uv run pytest                # 单元 + e2e
uv run pytest --cov=pangu_crawler  # 覆盖率
```

### 启动 MCP server（W1 mock 模式）

```bash
cd mcp-server
PANGU_CRAWLER_MOCK=1 node dist/index.js
```

### Pangu agent 接入

待 CEO 查 Pangu 的 MCP client 接入方式（W1 验收前必解决）。

---

## 协议说明（修订自墨 v0.1）

**重要**：墨文档 §3 §4.1 §12 提到的 "Anthropic /v1/messages 协议" 实为笔误。

- **MCP 协议** = MCP server ↔ MCP client 通信（**stdio/JSON-RPC** 或 HTTP+SSE）— 由 `@modelcontextprotocol/sdk` 实现
- **Anthropic /v1/messages** = Pangu → Claude API 的 LLM 调用端点 — 与爬虫无关

**本项目用的是 MCP 协议**（stdio transport，W1 阶段；W2 阶段可考虑 HTTP+SSE）。

详细协议规范见 [docs/API.md](docs/API.md)。

---

## 贡献者

- 墨 v0.1（战略 / 文档）
- Hermes Agent（实现 / 测试 / 修订）

## 许可证

MIT
