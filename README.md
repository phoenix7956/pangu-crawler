> 📦 **本项目是 [Pangu-MCP](https://github.com/Pangu-MCP) 生态的爬虫插件** · Apache 2.0 开源 · 独立可移植,不绑死 Pangu 内核

# 🕷️ pangu-crawler

**MCP (Model Context Protocol) 网页抓取插件,给 Pangu Agent / Claude / Cursor / 任何 MCP client 用。**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![MCP](https://img.shields.io/badge/MCP-stdio%2FJSON--RPC-blue)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://python.org)
[![Tests](https://img.shields.io/badge/tests-28%2F28-brightgreen)](./docs/DEV.md)
[![W2 Baseline](https://img.shields.io/badge/W2_baseline-7%2F10-orange)](./docs/BASELINE.md)

---

## ✨ 特性

- ✅ **MCP 标准协议** — 走 stdio/JSON-RPC,任何 MCP client 都能调
- ✅ **零外部依赖** — 不绑死 Pangu 内核,独立可移植
- ✅ **反爬降级** — curl_cffi HTTP 抓取失败 → 自动降级到 Playwright JS 渲染
- ✅ **跨平台** — macOS / Linux / Windows (Python 自动检测 + `.bat` / `.ps1` 启动脚本)
- ✅ **Apache 2.0** — 商用友好,跟闭源内核解耦
- ✅ **错误透传** — 完整结构化错误信息,不吞错

## 🏗️ 架构

```
┌──────────────┐    MCP (stdio/JSON-RPC)     ┌──────────────────┐
│  Pangu Agent │ <─────────────────────────> │  Crawler MCP     │
│  (盘古/Claude)│                             │  Server          │
└──────────────┘                             │  (Node.js+TS)    │
                                              └──────────────────┘
                                                       │
                                                spawn 子进程
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Crawler Core    │
                                              │  (Python 3.11+)  │
                                              └──────────────────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          ▼                          ▼
                                 ┌──────────────┐         ┌──────────────┐
                                 │  curl_cffi   │         │  Playwright  │
                                 │  (HTTP 抓取) │ ──失败──>│  (JS 渲染)   │
                                 └──────────────┘  降级   └──────────────┘
                                          │                          │
                                          └─────────────┬────────────┘
                                                        ▼
                                               ┌──────────────────┐
                                               │  readability     │
                                               │  + html2text     │
                                               └──────────────────┘
                                                        │
                                                        ▼
                                               返回 Markdown
```

## 📦 安装

### 前置要求
- Node.js 20+
- Python 3.11+
- (可选) Playwright `chromium` 浏览器 — 仅 W2 真实抓取需要

### 从源码安装

```bash
git clone https://github.com/Pangu-MCP/pangu-crawler.git
cd pangu-crawler
```

#### 1. 装 MCP server 依赖 + build

```bash
cd mcp-server
pnpm install --frozen-lockfile
pnpm build
```

#### 2. 装 Python deps

```bash
cd ../crawler-core
uv sync --extra parser --extra w2 --extra dev  # 装所有 extra
# 或仅 mock 测试 (W1 阶段):
uv sync --extra dev
```

#### 3. (可选) 装 Playwright 浏览器

```bash
uv run playwright install chromium
```

## 🚀 快速开始

### 跑 MCP server (stdio 模式)

```bash
# 方式 1: 用我们的启动脚本 (推荐)
bash /path/to/pangu-crawler/scripts/start-mcp.sh

# 方式 2: 直接 node
cd mcp-server
node dist/index.js

# 方式 3: Windows
.\scripts\start.bat
# 或 PowerShell
.\scripts\start.ps1
```

### 接到 Pangu MCP server 列表

```json
{
  "name": "pangu-crawler",
  "transport": "stdio",
  "command": "bash",
  "args": ["/path/to/pangu-crawler/scripts/start-mcp.sh"],
  "env": {
    "PANGU_CRAWLER_MOCK": "0"
  },
  "enabled": true
}
```

详见 `docs/PANGU-INTEGRATION.md`。

### 测试抓取 (抓 10 个公开站)

```bash
cd crawler-core
uv run python examples/test_fetch.py --update-md
```

输出: 控制台表格 + 自动更新 `docs/BASELINE.md`。

## 📚 文档

| 文档 | 用途 |
|------|------|
| [DEV.md](./docs/DEV.md) | 完整开发文档 (架构 / W1-W2 任务清单 / 验收) |
| [API.md](./docs/API.md) | `web_fetch` tool 接口规范 |
| [TESTING.md](./docs/TESTING.md) | 测试策略 |
| [BASELINE.md](./docs/BASELINE.md) | W2 反爬 baseline 数据 |
| [PANGU-INTEGRATION.md](./docs/PANGU-INTEGRATION.md) | Pangu MCP server 注册步骤 |
| [PANGU-MCP-INTEGRATION-DESIGN.md](./docs/PANGU-MCP-INTEGRATION-DESIGN.md) | Pangu 核心 MCP 集成架构设计 |

## 🛠️ 工具规范

### `web_fetch` — 唯一对外工具

抓取一个 URL 并返回结构化内容。

**参数**:
```typescript
{
  url: string,                          // 必填,目标 URL
  format?: 'markdown' | 'text' | 'html', // 默认 markdown
  timeout_ms?: number,                  // 默认 30000
  max_retries?: number,                 // 默认 3
  use_proxy?: boolean,                  // 默认 false (W4 接入代理池)
  wait_for_selector?: string,           // Playwright 模式 CSS 选择器
  extract_main?: boolean,               // 默认 true (readability 提取)
  headers?: Record<string, string>,     // 自定义 headers
}
```

**返回**:
```typescript
{
  content: string,                      // 抓取内容
  final_url: string,                    // 重定向后 URL
  status_code: number,
  mode: 'http' | 'playwright',          // 实际抓取模式
  duration_ms: number,
  metadata: { title?, description?, content_type?, content_length?, redirected? }
}
```

详见 [API.md](./docs/API.md)。

## 🧪 开发

### 跑测试

```bash
# Node.js 测试 (MCP server)
cd mcp-server
pnpm test                  # 28/28 tests
pnpm test:coverage         # 81.46% coverage

# Python 测试 (crawler-core)
cd crawler-core
uv run pytest              # 待 W2 跑通
```

### 项目结构

```
pangu-crawler/
├── mcp-server/           # MCP server (Node.js + TypeScript)
│   ├── src/              # server, crawler_client, tools/web_fetch
│   └── tests/            # 28/28 tests + 81.46% coverage
├── crawler-core/         # 抓取引擎 (Python 3.11+)
│   ├── src/pangu_crawler/  # cli, fetcher, parser, errors
│   └── examples/         # test_fetch.py
├── docs/                 # 文档
├── scripts/              # 启动脚本 (start-mcp.sh / start.bat / start.ps1)
├── examples/test_urls.txt  # 10 个公开站
├── LICENSE               # Apache 2.0
└── README.md             # 你正在看
```

### 提交 PR

1. Fork + 创建分支 (`git checkout -b feature/xxx`)
2. 改代码 + 加测试 (`pnpm test` + `pytest`)
3. 更新文档 (`docs/DEV.md` v0.x)
4. 提交 (`git commit -m "feat: ..."`)
5. 推 PR (`gh pr create` 或 web UI)

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📊 性能

| 指标 | 当前 | 目标 |
|------|------|------|
| 单 URL 抓取 | 1-2s (静态) / 10s (大页) | < 30s ✅ |
| 10 站成功率 (W2 baseline) | **7/10 (70%)** | ≥ 70% ✅ |
| 平均耗时 | 2.3s (成功站) | - |
| 测试覆盖 | 28/28 + 81.46% | ≥ 80% ✅ |
| 内存峰值 | < 200MB | < 500MB ✅ |

详见 [BASELINE.md](./docs/BASELINE.md)。

## 🛡️ 自研边界（重要）

我们**自研**:
- MCP 协议适配层
- 抓取降级策略
- 内容提取逻辑
- 错误透传 + 监控

我们**用现成**:
- `curl_cffi` (TLS 指纹伪装)
- `Playwright` (JS 渲染)
- `readability-lxml` (内容提取)
- 后续 `Camoufox` (反指纹)

我们**永不碰**:
- TLS 握手细节
- 浏览器内核
- Cloudflare 对抗

> 反爬是猫鼠游戏,CF 每年升 3-4 次指纹。**跟着 Camoufox 升级是稳赢,自己造轮子必输。**

## 🤝 贡献

我们欢迎所有形式的贡献!详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📜 License

[Apache 2.0](./LICENSE) — 商用友好。

## 🙏 致谢

- [Scrapling](https://github.com/D4Vinci/Scrapling) — 给我们 MCP 集成的灵感
- [Model Context Protocol](https://modelcontextprotocol.io) — 标准协议
- [Pangu-MCP](https://github.com/Pangu-MCP) — 母公司

---

**Made with ❤️ by the Pangu-MCP team**
