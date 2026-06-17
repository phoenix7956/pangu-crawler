# 盘古自研爬虫能力 W1-2 MVP 开发文档（Hermes 修订版）

> 文档版本 v0.2 · 2026-06-17 · 墨 v0.1 + Hermes 修订  
> 流程: 墨写 → hermes 做 → Claude Code 修 → 墨复核

> **本版本相对 v0.1 的修订**（Hermes 标注）：
> 1. **协议描述修正**：§3 / §4.1 / §12 中 "MCP 走 Anthropic /v1/messages" **实为笔误**。MCP 协议 ≠ Anthropic /v1/messages（详见 §13 协议说明）
> 2. **路径修正**：从 `~/Desktop/pangu-crawler-w1-2/` 改为 `/Users/feng/Applications/pangu-crawler/`（与 4 框架统一）
> 3. **健康检查方案**：§T1.5 改为 MCP SDK 内置 healthCheck 方法（stdio 模式无 HTTP 端口）
> 4. **§12 参考清单**：删掉"必读 MEMORY §8.9.1.3"的误导性引用
> 5. **GitHub repo**：项目归属 `phoenix7956/pangu-crawler`（不是 fengshao——GitHub login 校正）
> 6. **W2 deps 标 optional**：curl_cffi/playwright/tenacity 不进 default，避免 uv sync 卡 5 分钟
> 7. **新增 Pangu 客户端对接 §14**：墨没写，Hermes 补（CEO 在查）

---

## 0. 文档元信息

| 字段 | 值 |
|------|-----|
| 项目代号 | pangu-crawler |
| 当前阶段 | W1 ✅ 完成 → W2 启动 |
| 战略定位 | 盘古的"嘴"——给 agent 喂数据 |
| 依赖 | Pangu（/Users/feng/Applications/pangu/） |
| 后续阶段 | W3-6（Camoufox / 代理池 / 信息库） |
| 触发升级标准 | 盘古 agent 调 W1-2 真省 token |
| GitHub | github.com/phoenix7956/pangu-crawler |
| 许可证 | MIT |

---

## 1. 为什么做（业务背景）

### 1.1 问题
盘古是 CEO 级全域增长 Agent,但**没有"嘴"**——它没法从公网实时抓数据喂自己。
- 第三方爬虫服务（Bright Data、Apify）贵且黑盒
- 开源爬虫（Scrapy、Playwright）要自己写 MCP 桥接
- 抖音"god's perspective"包装的 Scrapling 真信息差 = MCP Server,不是爬虫本身

### 1.2 目标（W1-2 范围）
为盘古 agent 提供**自研可控、可扩展、可降级**的网页抓取能力,标准接口（MCP）,让 agent 像调函数一样调爬虫。

### 1.3 明确不做（W1-2 范围外）
- ❌ 反指纹浏览器（CF、5s盾）— W3+ Camoufox
- ❌ 代理 IP 池 — W4
- ❌ 入信息库结构化解析 — W5-6
- ❌ 用户登录 / cookies 管理
- ❌ 分布式 / 队列
- ❌ Web UI

---

## 2. 战略原则（自研边界 — 必读）

| 圈层 | 是否自研 | 内容 | 理由 |
|------|---------|------|------|
| 业务策略层 | ✅ **自研** | MCP 接口、代理调度、降级策略、信息库摄入 | **盘古核心能力** |
| 工程能力层 | ❌ **用现成** | curl_cffi（TLS 指纹）、Playwright（浏览器）、Camoufox（反指纹） | **跟升级是稳赢策略** |
| 底层协议层 | ❌ **永不碰** | TLS 握手、浏览器内核、Cloudflare 对抗 | **1-2 人/年必输** |

**关键判断**:反爬是猫鼠游戏,CF 每年升 3-4 次指纹。**自己造轮子必输,跟着 Camoufox 升级是稳赢。**

---

## 3. 整体架构

```
┌──────────────┐    MCP (stdio/JSON-RPC)     ┌──────────────────┐
│  Pangu Agent │ <─────────────────────────> │  Crawler MCP     │
│  (盘古/Claude)│                             │  Server          │
└──────────────┘                             │  (Node.js+TS)    │
                                              └──────────────────┘
                                                       │
                                                stdio (pipe)
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
                                               │  内容提取        │
                                               │  readability     │
                                               │  + html2text     │
                                               └──────────────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │  返回 Markdown   │
                                               │  (W5-6 入信息库) │
                                               └──────────────────┘
```

**重要修订**：MCP server ↔ Pangu agent 走 **stdio/JSON-RPC**（Anthropic MCP SDK 默认 transport），**不是** Anthropic /v1/messages（后者是 Pangu → Claude API 用的 LLM endpoint，与爬虫无关）。

---

## 4. 技术栈（**已锁定,不要换**）

### 4.1 MCP Server（Node.js）
| 组件 | 选型 | 备注 |
|------|------|------|
| 运行时 | Node.js 20+ | 与 Pangu 一致 |
| 语言 | TypeScript 5+ | 类型安全 |
| MCP SDK | `@modelcontextprotocol/sdk` v1.x | 官方 |
| **MCP Transport** | **stdio/JSON-RPC** | **SDK 默认** |
| 配置 | `config.json` + `.env` | 标准 |
| 日志 | `pino` | 高性能 |
| 测试 | `vitest` | 现代、快 |

### 4.2 Crawler Core（Python）
| 组件 | 选型 | 备注 |
|------|------|------|
| 运行时 | Python 3.11+ | 现代特性 |
| 包管理 | `uv` | 快、稳 |
| 内容提取 | `readability-lxml` + `html2text` | W1 必需 |
| W2 抓取 | `curl_cffi` (optional dep) | TLS 指纹伪装 |
| W2 浏览器 | `playwright` (optional dep) | JS 渲染 |
| W2 重试 | `tenacity` (optional dep) | 指数退避 |
| 测试 | `pytest` + `pytest-cov` | 主流 |

**W1 阶段**：optional deps 不装，避免 `uv sync` 卡 5 分钟。W2 启动时 `uv sync --extra w2`。

---

## 5. 接口规范（MCP tool）

### 5.1 `web_fetch` — 唯一对外工具

**描述**:抓取一个 URL 并返回结构化内容

**输入参数**:
```typescript
{
  url: string,                          // 必填,目标 URL
  format?: 'markdown' | 'text' | 'html', // 默认 'markdown'
  timeout_ms?: number,                  // 默认 30000
  max_retries?: number,                 // 默认 3
  use_proxy?: boolean,                  // 默认 false（W4 接入,W1-2 stub）
  wait_for_selector?: string,           // Playwright 模式下等待的 CSS 选择器
  extract_main?: boolean,               // 默认 true（用 readability 提取主要内容）
  headers?: Record<string, string>,     // 自定义 headers
}
```

**返回**:
```typescript
{
  content: string,                      // 抓取的内容
  final_url: string,                    // 重定向后的实际 URL
  status_code: number,
  mode: 'http' | 'playwright',          // 实际抓取模式
  duration_ms: number,
  metadata: {
    title?: string,
    description?: string,
    content_type?: string,
    content_length?: number,
    redirected?: boolean,
  }
}
```

**错误**（**必须透传,绝不吞错**）:
```python
class CrawlerError(Exception):
    code: 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CHALLENGE_FAILED' | 'PARSE_ERROR' | 'UNKNOWN'
    status_code: int | None
    url: str
    attempts: int
    fallback_attempted: bool
    original_error: str
```

### 5.2 配置文件

`mcp-server/config.json`:
```json
{
  "server": {
    "name": "pangu-crawler",
    "version": "0.1.0"
  },
  "crawler": {
    "python_path": "python3",
    "crawler_module": "pangu_crawler.cli",
    "stdio_timeout_ms": 60000,
    "default_timeout_ms": 30000,
    "max_retries": 3,
    "use_proxy": false
  },
  "logging": { "level": "info", "pretty": false }
}
```

---

## 6. W1 任务清单 — MCP Server 薄壳

**目标**:跑通 MCP Server 框架,暴露 `web_fetch` tool（mock 抓取）,验证协议层。

| ID | 任务 | 验收 | 状态 |
|----|------|------|------|
| T1.1 | 创建项目结构 | 目录树符合 §10 | ✅ |
| T1.2 | 写 `package.json`（Node 20+, TS 5+, MCP SDK）| `pnpm install` 成功 | ✅ |
| T1.3 | MCP Server 框架 | `list_tools` 调用返回 `web_fetch` | ✅ |
| T1.4 | 暴露 `web_fetch` tool | Pangu agent 能看到 tool | ✅ (协议层) |
| T1.5 | health check 端点 | `server.healthCheck()` 返正常 | ✅ (改为 SDK 方法) |
| T1.6 | 配置加载（`config.json` + `.env`）| 启动日志显示配置 | ✅ |
| T1.7 | 与 crawler-core 的 stdio 通信 | mock 抓取返回假数据 | ✅ |
| T1.8 | 基础日志（pino）| 所有请求有 trace | ✅ |
| T1.9 | 单元测试 | 覆盖率 ≥ 80% | ✅ (81.46%) |
| T1.10 | 端到端测试 | e2e 通过 | ✅ (28/28) |

**W1 验收结果**：
- ✅ 28/28 测试通过
- ✅ 覆盖率 81.46%（> 80% 目标）
- ✅ e2e 用 MCP SDK `InMemoryTransport`（真协议层）
- ✅ stdio 通信走真 spawn（4 个 spawn 测试，0 假）
- ✅ 错误透传完整（错误格式测试覆盖）

**W1 真实待 CEO 解决**：Pangu agent 客户端对接（详见 §14）

---

## 7. W2 任务清单 — HTTP 抓取 + Playwright 降级

**目标**:实现真实抓取 + 自动降级,记录反爬 baseline。

| ID | 任务 | 验收 |
|----|------|------|
| T2.1 | 装 W2 deps | `uv sync --extra w2` + `playwright install chromium` |
| T2.2 | curl_cffi 集成 | `import curl_cffi` 无错 |
| T2.3 | 基础抓取（带 User-Agent、headers）| 抓 google.com 200 |
| T2.4 | HTML→Markdown（readability + html2text）| 输出可读 markdown |
| T2.5 | 重试逻辑（指数退避,tenacity）| 网络抖动测试过 |
| T2.6 | 失败检测（403/503/JS challenge 识别）| 能识别 CF challenge |
| T2.7 | Playwright 集成 | 启动 headless 浏览器 |
| T2.8 | **降级策略:HTTP 失败 → Playwright** | JS 渲染页能抓 |
| T2.9 | Playwright 等待策略（`wait_for_selector`）| 动态内容等待 OK |
| T2.10 | 内容提取增强（去广告/导航）| readability 提取干净 |
| T2.11 | 错误处理 + 透传 | CrawlerError 信息完整 |
| T2.12 | 性能测试（并发、内存）| 单 URL < 30s,10 并发 < 60s |
| T2.13 | **反爬 baseline 记录** | 裸跑成功率,给 W3-6 用 |

**W2 验收标准**:
- [ ] 抓 10 个公开站成功率 ≥ 70%
- [ ] JS 渲染页（如 twitter.com）能抓
- [ ] CF 挑战页能识别失败（不崩溃,正确报 CHALLENGE_FAILED）
- [ ] 错误信息透传给 Pangu agent
- [ ] 性能达标
- [ ] baseline 数据写进 `docs/BASELINE.md`

---

## 8. 测试策略

### 8.1 单元测试
- 覆盖所有核心函数
- Mock 外部依赖（curl_cffi、Playwright）
- 目标覆盖率 ≥ 80%

### 8.2 集成测试
- 真实 URL 抓取（10 个公开网站列表见 `examples/test_urls.txt`）
- 端到端:Pangu agent → MCP Server → Crawler Core → 真实 URL

### 8.3 性能基准
| 指标 | 目标 |
|------|------|
| 单 URL 抓取 | < 30s |
| 10 并发 | < 60s |
| 内存峰值 | < 500MB |
| CPU 峰值 | < 80% 单核 |

### 8.4 反爬 baseline（W2 必交）
- 裸跑成功率（不加代理、不加反指纹）
- 不期望 100%,记录数据给 W3-6 用
- 输出到 `docs/BASELINE.md`

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 反爬对抗失败 | W1-2 抓取成功率低 | 接受 baseline,W3+ Camoufox |
| Playwright 启动慢 | 单次延迟 +2s | 后续考虑 browser pool 复用 |
| HTML 解析差异 | 不同网站结构不同 | readability + 多策略 fallback |
| 内存泄漏 | 长跑崩溃 | 严格资源管理 + 监控 |
| **Pangu 客户端对接** | W1 验收阻塞 | **CEO 在查 Pangu 的 MCP client 接入方式** |
| **uv sync 卡慢** | W2 装 deps 5+ 分钟 | optional dep 拆分已修 |
| **esbuild build script** | pnpm install 偶尔 fail | 跳过 pnpm install 直接调 vitest |

---

## 10. 文件结构

```
/Users/feng/Applications/pangu-crawler/   ← 路径修订
├── README.md
├── docs/
│   ├── DEV.md                         # 本文档
│   ├── API.md
│   ├── TESTING.md
│   └── BASELINE.md
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── config.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts                  # MCP server 实现
│   │   ├── tools/
│   │   │   └── web_fetch.ts
│   │   ├── crawler_client.ts          # stdio → Python 通信
│   │   ├── config.ts
│   │   └── logger.ts
│   └── tests/
│       ├── config.test.ts             (5)
│       ├── web_fetch.test.ts          (8)
│       ├── crawler_client.test.ts     (4 mock)
│       ├── crawler_client_spawn.test.ts (4 real spawn)
│       ├── server.test.ts             (1)
│       ├── index.test.ts              (2)
│       └── e2e.test.ts                (4 InMemoryTransport)
├── crawler-core/
│   ├── pyproject.toml                 # W2 deps = optional
│   ├── README.md
│   ├── .env.example
│   ├── src/pangu_crawler/
│   │   ├── __init__.py
│   │   ├── cli.py                     # stdio JSON-RPC 入口
│   │   ├── fetcher.py                 # HTTP 抓取（curl_cffi）
│   │   ├── parser.py                  # readability + html2text
│   │   ├── errors.py                  # CrawlerError
│   │   └── config.py
│   └── tests/
│       ├── test_errors.py
│       ├── test_fetcher.py
│       ├── test_parser.py
│       └── test_cli.py
├── examples/
│   ├── test_urls.txt
│   └── test_outputs/
└── scripts/
    ├── start.sh
    └── test.sh
```

---

## 11. 验收清单（**墨复核用**）

### W1 复核 checklist
- [x] 项目结构严格符合 §10
- [x] MCP agent 能列 `web_fetch` tool（**协议层验证，真实 agent 待 CEO 接入**）
- [x] 端到端 mock 通过（InMemoryTransport）
- [x] health check 返正常
- [x] 单元测试 81.46% 覆盖（> 80%）
- [x] 配置文件加载无错
- [x] 日志完整（每个请求有 trace_id）
- [x] README + API.md + TESTING.md 齐全
- [x] GitHub repo `phoenix7956/pangu-crawler` 已建

### W2 复核 checklist（待 W2 跑）
- [ ] 抓 10 个公开站 ≥ 70% 成功
- [ ] JS 渲染页能抓
- [ ] 失败检测准确
- [ ] 降级策略正确触发
- [ ] 错误信息完整透传
- [ ] 性能达标
- [ ] `docs/BASELINE.md` 数据真实

---

## 12. 关键参考

1. **Pangu 代码** — `/Users/feng/Applications/pangu/` 看 `pangu-single.js` 的 LLM 协议实现
2. **MCP 协议官方** — modelcontextprotocol.io
3. **Scrapling 调研** — github.com/D4Vinci/Scrapling（**不集成**，看它的 MCP Server 实现思路）

> ~~必读 MEMORY §8.9.1.3 — Pangu 后端 Anthropic 协议实现参考（MCP 必须走 Anthropic 协议）~~ **删除：误导性引用，详见 §13**

---

## 13. 协议说明（Hermes 修订补）

**墨文档原描述有误**：
> §3 §4.1 §12 多次提到 "MCP 走 Anthropic /v1/messages 协议"

**正确理解**：

| 协议 | 用途 | 实现 |
|------|------|------|
| **MCP 协议** | Pangu agent ↔ pangu-crawler MCP server | `@modelcontextprotocol/sdk`（stdio/JSON-RPC） |
| **Anthropic /v1/messages** | Pangu → Claude LLM API | Pangu 内部 LLM 客户端，与爬虫无关 |

**两个完全不同的协议层**。MCP 是工具调用协议，Anthropic /v1/messages 是 LLM API 端点。

---

## 14. Pangu 客户端对接（Hermes 补）

**W1 验收的最后一个卡点**——Pangu 当前**没有 MCP 客户端**（pangu-single.js 搜 0 匹配）。

CEO 正在查 Pangu 的 MCP 接入方式。在 CEO 出结论前，MCP server 端**先按 stdio/JSON-RPC 实现完，**支持未来 Pangu 用任意一种方式接入。

**MCP server 端已经支持的接入模式**：
- ✅ **stdio/JSON-RPC**（默认，Pangu 拉起子进程）
- ✅ **InMemoryTransport**（测试用，单进程嵌入）
- ⏳ **HTTP+SSE**（W2 阶段考虑，Pangu 用 HTTP 调用时启用）

CEO 拍板后补 W1.4 Pangu 真实接入验收。

---

## 15. 版本

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-06-17 | 初版 | 墨 |
| v0.2 | 2026-06-17 | 修订 7 处 + W1 实现完成 | Hermes |
