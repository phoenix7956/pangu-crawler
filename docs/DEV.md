# 盘古自研爬虫能力 开发文档

> 文档版本 v0.3 · 2026-06-17 · 墨 v0.3 整合版（v0.1 + Hermes v0.2 + W2 战略升级）
> 流程: 墨写 → hermes 做 → Claude Code 修 → 墨复核

---

## 0. 文档元信息

| 字段 | 值 |
|------|-----|
| 项目代号 | pangu-crawler |
| 当前阶段 | **W1 ✅ 完成 → W2 🟡 部分完成**(协议层验证过,跨平台改完,uv sync 后台跑,抓 10 站验收待跑)|
| 战略定位 | **Pangu MCP 生态**首个开源爬虫插件 |
| 依赖 | Pangu（/Users/feng/Applications/pangu/） |
| GitHub | github.com/Pangu-MCP/pangu-crawler（待 W3 开源发布）|
| 许可证 | **Apache 2.0** |
| 后续阶段 | W3-6（Camoufox / 代理池 / 信息库）|
| 触发升级标准 | 盘古 agent 调 pangu-crawler 真省 token |

---

## 0.5 战略升级（2026-06-17 老板 11:20 拍板）

### 核心战略: Pangu 内核自研闭源 + MCP 插件开源 = Linux 模式

| 层 | 归属 | 内容 | 路径 |
|------|------|------|------|
| **Pangu 内核** | ✅ 自研闭源,全本地,不上 GitHub | 工具调用框架（mcp_adapter.js）+ 384 爻/六亲/用神 + 业务逻辑 | `/Users/feng/Applications/pangu/` |
| **MCP 插件** | ✅ 开源,GitHub 公开仓库 | 工具实现（爬虫/搜索/数据库/...）| `/Users/feng/Applications/pangu-crawler/` |

**跟"全本地"铁律不冲突** — 铁律指 Pangu 内核,插件不在这条线。

### 3 个战略口径(老板 11:20 拍)

| 口径 | 决策 | 理由 |
|------|------|------|
| GitHub org | **`Pangu-MCP`** | 长期组织名,容纳未来多插件 |
| LICENSE | **Apache 2.0** | 最宽松,商用友好 |
| 代码边界 | **拆干净** | pangu-crawler 独立可移植,未来任何 MCP client 都能用 |

### 未来 3-6 月方向

```
Month 1   pangu-crawler 开源发布(GitHub Pangu-MCP org 公开仓库)
Month 2   pangu-search(Pangu 内置 web_search 抽成插件)
Month 3   pangu-db / pangu-image / pangu-fs...
Month 4+  Pangu-MCP-Plugins 组织,社区贡献工具
```

---

## 1. 为什么做（业务背景）

### 1.1 问题
盘古是 CEO 级全域增长 Agent,但**没有"嘴"**——它没法从公网实时抓数据喂自己。
- 第三方爬虫服务（Bright Data、Apify）贵且黑盒
- 开源爬虫（Scrapy、Playwright）要自己写 MCP 桥接
- 抖音"god's perspective"包装的 Scrapling 真信息差 = MCP Server,不是爬虫本身

### 1.2 目标（W2 范围）
为盘古 agent 提供**自研可控、可扩展、可降级**的网页抓取能力,标准接口（MCP/stdio JSON-RPC）,让 agent 像调函数一样调爬虫。同时成为 Pangu MCP 生态的开源样板。

### 1.3 明确不做（W2 范围外）
- ❌ 反指纹浏览器（CF、5s盾）— W3+ Camoufox
- ❌ 代理 IP 池 — W4
- ❌ 入信息库结构化解析 — W5-6
- ❌ 用户登录 / cookies 管理
- ❌ 分布式 / 队列
- ❌ Web UI（盘古的 UI 已够用,本项目只做 backend）

---

## 2. 战略原则（自研边界 — 必读）

| 圈层 | 是否自研 | 内容 | 理由 |
|------|---------|------|------|
| 业务策略层 | ✅ **自研** | MCP 接口、代理调度、降级策略、信息库摄入 | **盘古核心能力** |
| 工程能力层 | ❌ **用现成** | curl_cffi（TLS 指纹）、Playwright（浏览器）、Camoufox（反指纹）| **跟升级是稳赢策略** |
| 底层协议层 | ❌ **永不碰** | TLS 握手、浏览器内核、Cloudflare 对抗 | **1-2 人/年必输** |

**关键判断**: 反爬是猫鼠游戏,CF 每年升 3-4 次指纹。**自己造轮子必输,跟着 Camoufox 升级是稳赢。**

---

## 3. 整体架构（**v0.3 重大修订**）

### 3.1 真实架构（Pangu 已有 mcp_adapter.js）

```
┌────────────────────────────────┐  stdio/JSON-RPC
│       Pangu Agent (盘古)        │  (MCP 协议)
│                                │
│  modules/mcp_adapter.js (193行) │ ◄── Pangu 已有,自研 MCP 客户端
│  (支持 stdio/HTTP/SSE)          │     (不需要 @modelcontextprotocol/sdk)
│                                │
│  desktop/.../MCP.jsx (UI 配置)  │ ◄── Pangu UI 已有,3 个 MCP server 占位
│  (pangu-internal/github/fs)     │
└──────────────┬─────────────────┘
               │ spawn 子进程
               ▼
┌────────────────────────────────┐
│   pangu-crawler MCP Server      │
│   (Node.js + TS)                │
│   stdio/JSON-RPC                │
└──────────────┬─────────────────┘
               │ spawn 子进程(可选,W2 起)
               ▼
┌────────────────────────────────┐
│   crawler-core (Python 3.11+)   │
│   (uv 依赖管理)                 │
└──────────────┬─────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌─────────┐   ┌──────────┐
   │curl_cffi│   │Playwright│
   │(HTTP)   │──失败──>│(JS 渲染)│
   └─────────┘  降级  └──────────┘
        │             │
        └──────┬──────┘
               ▼
       ┌───────────────┐
       │  readability  │
       │  + html2text  │
       └───────────────┘
               │
               ▼
       ┌───────────────┐
       │ 返回 Markdown │
       │(W5-6 入信息库)│
       └───────────────┘
```

### 3.2 关键发现（v0.3 修正 v0.1/v0.2 错误）

**v0.1/v0.2 错误判断**: "Pangu 没有 MCP 客户端,需要 W2 加 @modelcontextprotocol/sdk 客户端"
**v0.3 真实情况**:
- ✅ Pangu `modules/mcp_adapter.js` 已有（193 行,自研 JSON-RPC over stdio/HTTP/SSE）
- ✅ Pangu `desktop/.../settings/MCP.jsx` 已有（UI 配置页,3 个 MCP server 占位）
- ❌ **不需要** `@modelcontextprotocol/sdk`（Pangu 自己实现）

**W2 真实工作量**: 1 周 → **4 天**（节省 2-3 天）

### 3.3 协议层次（消除 v0.1 混淆）

| 协议 | 用途 | 实现 |
|------|------|------|
| **MCP 协议** | Pangu ↔ pangu-crawler（工具调用）| stdio/JSON-RPC（Pangu mcp_adapter.js 自研）|
| **Anthropic /v1/messages** | Pangu → Claude LLM（模型调用）| Pangu 内部 LLM 客户端,跟爬虫无关 |

**两协议层不混**。v0.1 文档中"MCP 走 Anthropic /v1/messages"是**笔误**,已删除。

---

## 4. 技术栈（**已锁定,不要换**）

### 4.1 pangu-crawler MCP Server（Node.js）
| 组件 | 选型 | 备注 |
|------|------|------|
| 运行时 | Node.js 20+ | 与 Pangu 一致 |
| 语言 | TypeScript 5+ | 类型安全 |
| **MCP SDK** | `@modelcontextprotocol/sdk` v1.x | **可选**(W1 用了,W2 考虑去耦合) |
| **MCP Transport** | **stdio/JSON-RPC** | Pangu mcp_adapter.js 默认 |
| 配置 | `config.json` + `.env` | 标准 |
| 日志 | `pino` | 高性能 |
| 测试 | `vitest` | 现代、快 |
| 包管理 | `pnpm` | 与 Pangu 工具链一致 |

### 4.2 crawler-core（Python）
| 组件 | 选型 | 备注 |
|------|------|------|
| 运行时 | Python 3.11+ | 现代特性 |
| 包管理 | `uv` | 快、稳 |
| 内容提取 | `readability-lxml` + `html2text` | W1 必需 |
| W2 抓取 | `curl_cffi` (optional dep) | TLS 指纹伪装 |
| W2 浏览器 | `playwright` (optional dep) | JS 渲染 |
| W2 重试 | `tenacity` (optional dep) | 指数退避 |
| 测试 | `pytest` + `pytest-cov` | 主流 |

**W1 阶段**: optional deps 不装,避免 `uv sync` 卡 5 分钟。W2 启动时 `uv sync --extra w2`。

### 4.3 Pangu 端（**已有,不用自研**）
| 组件 | 路径 | 行数 | 状态 |
|------|------|------|------|
| MCP 适配器 | `/Users/feng/Applications/pangu/modules/mcp_adapter.js` | 193 | ✅ 已有 |
| MCP UI | `/Users/feng/Applications/pangu/desktop/src/views/settings/MCP.jsx` | - | ✅ 已有 |

---

## 5. 接口规范（MCP tool）

### 5.1 `web_fetch` — 唯一对外工具

**描述**: 抓取一个 URL 并返回结构化内容

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

### 5.3 Pangu UI 注册配置（**W2 新增**）

在 Pangu `desktop/.../settings/MCP.jsx` 添加 pangu-crawler:

```json
{
  "name": "pangu-crawler",
  "transport": "stdio",
  "command": "node",
  "args": ["/Users/feng/Applications/pangu-crawler/mcp-server/dist/index.js"],
  "env": {
    "PANGU_CRAWLER_MODE": "real"
  },
  "enabled": true,
  "description": "Pangu-MCP 生态首个开源爬虫插件,Apache 2.0"
}
```

---

## 6. W1 任务清单 — MCP Server 薄壳（**✅ 已完成**）

**目标**: 跑通 MCP Server 框架,暴露 `web_fetch` tool（mock 抓取）,验证协议层。

| ID | 任务 | 验收 | 状态 |
|----|------|------|------|
| T1.1 | 创建项目结构 | 目录树符合 §10 | ✅ |
| T1.2 | 写 `package.json`（Node 20+, TS 5+, MCP SDK）| `pnpm install` 成功 | ✅ |
| T1.3 | MCP Server 框架 | `list_tools` 调用返回 `web_fetch` | ✅ |
| T1.4 | 暴露 `web_fetch` tool | 协议层验证通过 | ✅ (InMemoryTransport) |
| T1.5 | health check | SDK `server.healthCheck()` 返正常 | ✅ |
| T1.6 | 配置加载 | 启动日志显示配置 | ✅ |
| T1.7 | 与 crawler-core 的 stdio 通信 | mock 抓取返回假数据 | ✅ |
| T1.8 | 基础日志（pino）| 所有请求有 trace_id | ✅ |
| T1.9 | 单元测试 | 覆盖率 ≥ 80% | ✅ (81.46%) |
| T1.10 | 端到端测试 | e2e 通过 | ✅ (28/28) |

**W1 验收结果**:
- ✅ 28/28 测试通过
- ✅ 覆盖率 81.46%（> 80% 目标）
- ✅ e2e 用 MCP SDK `InMemoryTransport`（真协议层）
- ✅ stdio 通信走真 spawn（4 个 spawn 测试,0 假）
- ✅ 错误透传完整（错误格式测试覆盖）

**W1 真实对接**: 详见 §14 — Pangu mcp_adapter.js 集成方案

---

## 7. W2 任务清单 — 真实抓取 + Pangu 集成（**🟡 部分完成, 4 天路径**）

**目标**: 实现真实抓取 + Pangu 集成 + 跨平台适配 + 抓 10 站验收

**W2 路径对比**:

| 原计划(v0.2) | 真实需要(v0.3) | 节省 |
|------|------|------|
| D1-2 Pangu 加 @modelcontextprotocol/sdk 客户端 | ❌ 不需要(Pangu 已有 mcp_adapter.js) | **-2 天** |
| D3-4 pangu-crawler 开源化 | D1 (sub-agent 已完成) | - |
| D5-7 集成 + 抓 10 站 | D2-3 集成 + D3 抓 10 站 | **-2 天** |

**W2 实际进度(v0.4)**:

| Day | 工作 | 状态 |
|-----|------|------|
| **D1** | ✅ pangu-crawler 开源化（Apache 2.0 + README + DEV.md）| sub-agent 完成 |
| **D1** | ✅ 写 stdio 启动入口 `scripts/start-mcp.sh` | 完成 |
| **D1** | ✅ 写 `docs/PANGU-INTEGRATION.md` (Pangu UI 注册步骤) | 完成 |
| **D1** | ✅ MCP server 协议层验证(mock + handshake + web_fetch 全过) | 完成 |
| **D1** | ✅ 跨平台代码改(`python3` 自动检测 + `start.bat/ps1`) | 完成 |
| **D1** | 🟡 `uv sync --extra w2` 装 deps（后台跑, lxml/playwright 下载中）| in_progress |
| **D2** | ⏸ Pangu spawn pangu-crawler 子进程 + 集成测试 | 待 uv sync |
| **D2** | ⏸ 写 `examples/test_urls.txt` (10 站) | ✅ 已写 |
| **D3** | ⏸ 抓 10 站 ≥ 70% 验收 + 填 `docs/BASELINE.md` | 待 uv sync |
| **D4** | ⏸ 跨平台实测(CFO 节点恢复后跑 Windows) | 等 CFO |
| **D5** | ⏸ 复核 + 文档定稿 | 墨 |

**W2 详细任务**:

| ID | 任务 | 验收 |
|----|------|------|
| T2.1 | 装 W2 deps | `uv sync --extra w2` + `playwright install chromium` |
| T2.2 | curl_cffi 集成 | `import curl_cffi` 无错 |
| T2.3 | 基础抓取（带 User-Agent、headers）| 抓 google.com 200 |
| T2.4 | HTML→Markdown（readability + html2text）| 输出可读 markdown |
| T2.5 | 重试逻辑（指数退避,tenacity）| 网络抖动测试过 |
| T2.6 | 失败检测（403/503/JS challenge 识别）| 能识别 CF challenge |
| T2.7 | Playwright 集成 | 启动 headless 浏览器 |
| T2.8 | **降级策略: HTTP 失败 → Playwright** | JS 渲染页能抓 |
| T2.9 | Playwright 等待策略（`wait_for_selector`）| 动态内容等待 OK |
| T2.10 | 内容提取增强（去广告/导航）| readability 提取干净 |
| T2.11 | 错误处理 + 透传 | CrawlerError 信息完整 |
| T2.12 | 性能测试（并发、内存）| 单 URL < 30s,10 并发 < 60s |
| T2.13 | **反爬 baseline 记录** | 裸跑成功率,给 W3-6 用 |
| T2.14 | **Pangu mcp_adapter 集成** | Pangu UI 添加 pangu-crawler + spawn 跑通 |
| T2.15 | **跨平台代码改** | `python3` 自动检测 + `start.bat/ps1` + lxml/selectolax 二选一 |

**W2 验收标准**:
- [ ] Pangu UI 添加 pangu-crawler MCP server,显示「已连接」
- [ ] Pangu agent 调 `web_fetch` 真实抓取成功
- [ ] 抓 10 个公开站成功率 ≥ 70%
- [ ] JS 渲染页（如 twitter.com）能抓
- [ ] CF 挑战页能识别失败（不崩溃,正确报 CHALLENGE_FAILED）
- [ ] 错误信息透传给 Pangu agent
- [ ] 性能达标
- [ ] baseline 数据写进 `docs/BASELINE.md`
- [ ] **Windows 兼容**（代码改完即可,CFO 恢复后跑实测）

---

## 8. 测试策略

### 8.1 单元测试
- 覆盖所有核心函数
- Mock 外部依赖（curl_cffi、Playwright）
- 目标覆盖率 ≥ 80%

### 8.2 集成测试
- 真实 URL 抓取（10 个公开网站列表见 `examples/test_urls.txt`）
- 端到端: Pangu agent → MCP Server → Crawler Core → 真实 URL

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
| **Pangu spawn 兼容性** | Pangu mcp_adapter.js spawn pangu-crawler 子进程失败 | 严格按 stdio/JSON-RPC 实现,跑 InMemoryTransport e2e |
| **uv sync 卡慢** | W2 装 deps 5+ 分钟 | optional dep 拆分（`uv sync --extra w2`）|
| **lxml Windows 编译** | Windows 装 lxml 卡 30+ 分钟 | 备选 `selectolax`（纯 Python,跨平台友好）|

---

## 10. 文件结构

```
/Users/feng/Applications/pangu-crawler/
├── README.md                          # 项目入口(含 Pangu-MCP 生态 banner)
├── LICENSE                            # Apache 2.0 ✅
├── .gitignore
├── docs/
│   ├── DEV.md                         # 本文档 v0.4
│   ├── PANGU-INTEGRATION.md           # ✅ W2 新增: Pangu UI 注册指南
│   ├── API.md
│   ├── TESTING.md
│   ├── BASELINE.md                    # W2 反爬 baseline stub,待抓 10 站后填
│   └── C-integration-design.md        # W2 早期对接设计
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json                  # ✅ 已改 NodeNext (W2 修复)
│   ├── vitest.config.ts
│   ├── config.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts                   # 入口
│   │   ├── server.ts                  # MCP server (✅ W2 修 i: z.ZodIssue)
│   │   ├── tools/
│   │   │   └── web_fetch.ts           # ✅ W2 修 z.record(z.string(), z.string())
│   │   ├── crawler_client.ts          # spawn Python 子进程
│   │   ├── config.ts                  # ✅ W2 加 python_path 跨平台检测
│   │   └── logger.ts                  # ✅ W2 删 prettyPrint (pino v9 API)
│   └── tests/                         # ✅ 28/28 通过
│       ├── config.test.ts             (5)
│       ├── web_fetch.test.ts          (8)
│       ├── crawler_client.test.ts     (4 mock)
│       ├── crawler_client_spawn.test.ts (4 real spawn)
│       ├── server.test.ts             (1)
│       ├── index.test.ts              (2)
│       └── e2e.test.ts                (4 InMemoryTransport)
├── crawler-core/
│   ├── pyproject.toml                 # W2 deps = optional ✅ uv sync 中
│   ├── README.md
│   ├── .env.example
│   ├── src/pangu_crawler/
│   │   ├── __init__.py
│   │   ├── cli.py                     # stdio JSON-RPC 入口
│   │   ├── fetcher.py                 # HTTP 抓取（curl_cffi）
│   │   ├── parser.py                  # readability + html2text
│   │   ├── errors.py                  # CrawlerError
│   │   └── config.py                  # ✅ W2 加 _default_python_path() 跨平台
│   └── tests/
│       ├── test_errors.py
│       ├── test_fetcher.py
│       ├── test_parser.py
│       └── test_cli.py
├── examples/
│   ├── test_urls.txt                  # ✅ W2 新增: 10 个公开站
│   └── test_outputs/
└── scripts/
    ├── start.sh                       # 原 Mac/Linux 启动 (mock)
    ├── start-mcp.sh                   # ✅ W2 新增: Pangu spawn 入口 (1.5KB)
    ├── start.bat                      # ✅ W2 新增: Windows cmd 启动 (1.3KB)
    ├── start.ps1                      # ✅ W2 新增: Windows PS 启动 (1.5KB)
    └── test.sh
```

---

## 11. 验收清单（**墨复核用**）

### W1 复核 checklist（**✅ 已通过**）
- [x] 项目结构严格符合 §10
- [x] MCP agent 能列 `web_fetch` tool（**协议层验证,真实 agent 对接见 §14**）
- [x] 端到端 mock 通过（InMemoryTransport）
- [x] health check 返正常
- [x] 单元测试 81.46% 覆盖（> 80%）
- [x] 配置文件加载无错
- [x] 日志完整（每个请求有 trace_id）
- [x] README + API.md + TESTING.md 齐全
- [x] LICENSE (Apache 2.0) ✅

### W2 复核 checklist（**🟡 部分通过**）
- [x] pangu-crawler 开源化（Apache 2.0 + README banner + DEV.md 开源策略）
- [x] `scripts/start-mcp.sh` 写好 + 语法 OK
- [x] `docs/PANGU-INTEGRATION.md` 写好
- [x] MCP server 协议层验证（handshake + list_tools + web_fetch call 全过）
- [x] 跨平台代码改：`python_path` 自动检测 + `start.bat` + `start.ps1`
- [x] vitest 28/28 仍通过
- [x] `examples/test_urls.txt` 10 个公开站
- [x] `docs/BASELINE.md` stub
- [🟡] `uv sync --extra w2` 后台跑（curl_cffi 已装, lxml/playwright 下载中）
- [ ] Pangu spawn pangu-crawler 子进程验证（待 Pangu 启动）
- [ ] Pangu agent 调 `web_fetch` 真实抓取成功
- [ ] 抓 10 个公开站 ≥ 70% 成功（待 uv sync 完）
- [ ] JS 渲染页能抓（Playwright 装后验证）
- [ ] CF challenge 不崩溃
- [ ] 降级策略（HTTP 失败 → Playwright）
- [ ] 错误信息透传
- [ ] 性能达标（单 URL < 30s）
- [ ] `docs/BASELINE.md` 填真实数据

### 任何阶段不通过的处理
1. Claude Code 修代码 → 重跑测试
2. 复核不通过 → 返工
3. **2 次复核不过** → 升级给老板拍板

---

## 12. 关键参考

1. **Pangu MCP 框架（**v0.3 关键发现**）**:
   - `/Users/feng/Applications/pangu/modules/mcp_adapter.js` — Pangu 自研 MCP 客户端
   - `/Users/feng/Applications/pangu/desktop/src/views/settings/MCP.jsx` — Pangu UI MCP 配置
2. **MCP 协议官方** — modelcontextprotocol.io
3. **Scrapling 调研** — github.com/D4Vinci/Scrapling（**不集成**,看它的 MCP Server 实现思路）
4. **MEMORY §2** — Pangu MCP 生态最新战略

> ~~必读 MEMORY §8.9.1.3 — Pangu 后端 Anthropic 协议实现参考（MCP 必须走 Anthropic 协议）~~ **v0.3 删除**: 误导性引用,详见 §3.3 协议层次

---

## 13. 协议说明（**v0.3 删除,合并到 §3.3**）

> v0.1/v0.2 有独立 §13 解释 MCP 与 Anthropic /v1/messages 的区别。
> v0.3 把这部分合并到 §3.3 协议层次,这里不再重复。

---

## 14. Pangu 集成方案（**v0.3 重大修订**）

### 14.1 真实情况（v0.3 修正 v0.2）

**v0.2 错误判断**: "Pangu 没有 MCP 客户端,CEO 在查"
**v0.3 真实情况**:
- ✅ Pangu 已有 `modules/mcp_adapter.js`（193 行,自研 MCP 客户端）
- ✅ Pangu 已有 `desktop/.../settings/MCP.jsx`（UI 配置页）
- ✅ 3 个 MCP server 占位: `pangu-internal` / `github-mcp` / `filesystem-mcp`

### 14.2 W2 集成步骤

1. **D1**: 在 Pangu UI 设置页 `+ 添加` pangu-crawler MCP server
   ```json
   {
     "name": "pangu-crawler",
     "transport": "stdio",
     "command": "node",
     "args": ["/Users/feng/Applications/pangu-crawler/mcp-server/dist/index.js"]
   }
   ```
2. **D1**: 写 `scripts/start-mcp.sh` — Pangu spawn 时的入口
3. **D2**: Pangu 启动 → spawn pangu-crawler 子进程 → mcp_adapter.js 完成握手 → 工具可用
4. **D2**: 集成测试 — Pangu agent 调 `web_fetch` 真实抓取

### 14.3 协议握手

Pangu mcp_adapter.js 会向 pangu-crawler 发送 `initialize` 请求,带:
- `protocolVersion: "2024-11-05"`
- `capabilities: { tools: {} }`
- `serverInfo: { name: "pangu", version: "1.0" }`

pangu-crawler 必须**原样响应**(代码已就绪)。

---

## 15. 版本

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-06-17 | 初版 | 墨 |
| v0.2 | 2026-06-17 | 修订 7 处 + W1 实现完成 | Hermes |
| v0.3 | 2026-06-17 | 战略升级整合(Pangu-MCP org + Apache 2.0 + Pangu MCP 框架发现 + W2 4 天路径) | 墨 |
| v0.4 | 2026-06-17 | W2 进展: scripts/start-mcp.sh + PANGU-INTEGRATION.md + 跨平台代码改 (python3 自动检测 + start.bat/ps1) + tsconfig NodeNext + W2 4 个 TS bug 修复 + 协议层验证全过 + test_urls.txt + BASELINE.md stub | 墨 |
