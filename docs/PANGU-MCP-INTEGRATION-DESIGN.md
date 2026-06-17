# 盘古 MCP 集成架构设计 v0.1

> 目的: 把 pangu-crawler 注册成 Pangu 第一个真正能调的外部 MCP server,让盘古 agent 像调函数一样调爬虫。
> 范围: Pangu 核心集成 + UI 持久化 + e2e 验证
> 工作量: 2-3 周(分 4 个阶段)
> 状态: v0.1 设计文档,等老板审完再开实施

---

## 1. 现状盘点(基于 2026-06-17 探索)

| 维度 | 现状 | 评价 |
|------|------|------|
| `modules/mcp_adapter.js` | 193 行,支持 stdio/HTTP/SSE/streamable-http | ✅ 写好 |
| `pangu-server.js` 集成 | `createMCPAdapter()` 调用 1 次,赋给全局 `_mcpAdapter` | 🟡 **半成品** — 没 connect 任何 server,没接 tool 系统 |
| `pangu-single.js`(CEO 跑的) | **未引用** mcp_adapter | ❌ 单文件模式无 MCP |
| `config/features.json` | `mcp_adapter.enabled: false, env: ["development"]` | ⚠️ 默认关,且 `isEnabled('mcp_adapter')` 检查在 pangu-server.js 中**未调用** |
| MCP server 配置文件 | **不存在** | ❌ 需要新建 |
| UI `MCP.jsx` | 3 个 FALLBACK_SERVERS 写死,添加按钮 `useState` state-only,无后端 API | ❌ 装饰性 |
| `pangu-mcp.js`(UI 引用) | **文件不存在** | ❌ |
| tool 系统 | `TOOL_WEB_SEARCH` 等 in-process 工具,MCP tools 未集成 | ❌ |

**结论**: Pangu MCP 框架是**架构已完成、但集成未完成**状态。pangu-crawler 那边没问题,卡在 Pangu 这边。

---

## 2. 集成方案(4 阶段)

### Phase 1: 配置文件 + 加载逻辑(2 天)
**改动文件**:
1. `pangu/config/mcp_servers.json`(新建):
```json
{
  "servers": [
    {
      "name": "pangu-crawler",
      "transport": "stdio",
      "command": "bash",
      "args": ["/Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh"],
      "enabled": true,
      "description": "Pangu-MCP 生态开源爬虫"
    }
  ]
}
```
2. `pangu/modules/mcp_loader.js`(新建, 30 行): 读 mcp_servers.json + 按 enabled 过滤
3. `pangu/pangu-server.js`: 在 `_mcpAdapter` 初始化后,遍历 loader 列表 → `mcpAdapter.connect()`
4. `pangu/config/features.json`: `mcp_adapter.enabled: true, env: ["development", "production"]`

### Phase 2: Tool 系统集成(3 天)
**核心问题**: mcpAdapter 暴露的 tools 怎么被 Pangu 的 agent loop 调到?

**方案**:
- 在 `pangu/modules/mcp_adapter.js` 加 `_registerTools()` 方法,把 stdio 握手拿到的 tools 注册到 Pangu 内部 tool registry
- 改 `pangu-single.js` / `pangu-server.js`: 启动后扫描 `_mcpAdapter._tools`,合并到 Pangu tools 列表
- 改 `pangu/pangu-single.js`:`TOOL_WEB_SEARCH` 列表加 `mcp__web_fetch`(MCP 工具前缀 `mcp_` 已在 TOOL_PREFIXES)

### Phase 3: UI 持久化(2 天)
**核心问题**: UI 添加按钮无后端 API,刷新即丢。

**方案**:
- `pangu/pangu-server.js` 加 `GET/POST/DELETE /api/mcp/servers` 端点(读 mcp_servers.json + 热更新)
- `pangu/desktop/src/views/settings/MCP.jsx`:`useState` 改 `useEffect` 拉 API,加 `axios.post()` 调用
- 新增 `+ 添加` 表单: name/transport/command/args/enabled

### Phase 4: e2e 验证(3 天)
1. 重启 Pangu(`pkill node pangu-single.js && node pangu-single.js &`)
2. Pangu UI 添加 pangu-crawler MCP server
3. 盘古 agent 调:`用 pangu-crawler 抓 https://example.com`
4. 验证:返回 mock(W1 模式)或真实 HTML(W2 模式)
5. 抓 10 站 baseline 验证 7/10 验收不破

---

## 3. 数据流(盘古调 pangu-crawler)

```
┌──────────┐      ┌────────────────┐      ┌──────────────────┐
│  老板盘古  │ ──── │ Pangu Agent    │ ──── │ Pangu Tool Loop  │
│  (webchat)│      │ (main session) │      │ (agent_loop)     │
└──────────┘      └────────────────┘      └──────────────────┘
                                                  │
                                                  │ 调用 web_fetch tool
                                                  ▼
                                         ┌──────────────────┐
                                         │ Pangu Tool Reg   │
                                         │ (TOOL_WEB_SEARCH │
                                         │  + MCP tools)    │
                                         └──────────────────┘
                                                  │
                                                  │ 匹配 mcp__pangu_crawler__web_fetch
                                                  ▼
                                         ┌──────────────────┐
                                         │ _mcpAdapter      │
                                         │ .callTool()      │
                                         └──────────────────┘
                                                  │
                                                  │ spawn 子进程
                                                  ▼
                                         ┌──────────────────┐
                                         │ pangu-crawler    │
                                         │ MCP Server       │
                                         │ (stdio/JSON-RPC) │
                                         └──────────────────┘
                                                  │
                                                  │ spawn Python 子进程 (W2+)
                                                  ▼
                                         ┌──────────────────┐
                                         │ crawler-core     │
                                         │ (Python)         │
                                         └──────────────────┘
```

---

## 4. 文件改动清单(预估)

| 文件 | 改动 | 行数 |
|------|------|------|
| `pangu/config/features.json` | mcp_adapter.enabled true | +1 |
| `pangu/config/mcp_servers.json` | 新建 | ~15 |
| `pangu/modules/mcp_loader.js` | 新建 | ~40 |
| `pangu/modules/mcp_adapter.js` | 加 _registerTools | +20 |
| `pangu/pangu-server.js` | mcp 加载 + tool 集成 + API 端点 | +80 |
| `pangu/pangu-single.js` | mcp 集成(单文件模式) | +40 |
| `pangu/desktop/src/views/settings/MCP.jsx` | useEffect + API 调用 | -10 / +25 |
| `pangu/desktop/.../api.ts` | 新增 mcp API 客户端 | ~30 |
| `pangu-crawler/docs/PANGU-INTEGRATION.md` | 更新 | +20 |
| **总改动** | 9 文件 | ~270 行 |

---

## 5. 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| **改 Pangu 核心影响 CEO 节点运行** | 高 — 盘古主流程可能挂 | 用 pangu-server.js 多文件版做开发,跑通再 backport 到 pangu-single.js |
| **mcpAdapter 单连接 vs 多 server** | 中 — 现在只支持 1 个 server 连接 | Phase 1 解决:`_mcpAdapters` 数组,每个 server 一个 adapter |
| **tool 命名冲突** | 中 — Pangu 已有 web_search, MCP 也可能叫 web_fetch | 用 `TOOL_PREFIXES.mcp_` 前缀隔离 |
| **stdio 子进程管理** | 中 — spawn 多个子进程占资源 | Phase 2 后评估 pool 化 |
| **e2e 验证需要重启 Pangu** | 低 — 老板能容忍 30s 重启窗口 | 选低峰期(晚上 23:00 后) |

---

## 6. 实施步骤(2-3 周,按阶段走)

```
Week 1: Phase 1 (config + loader) + Phase 2 (tool 集成)
  D1-2  mcp_servers.json + mcp_loader.js + features.json 改
  D3-5  mcp_adapter.js _registerTools + Pangu tool registry 集成
Week 2: Phase 3 (UI) + Phase 4 (e2e)
  D1-2  /api/mcp/servers API + UI useEffect
  D3-5  重启 Pangu + e2e 验证 + 抓 10 站回归
Week 3: 收尾 + 文档
  D1-3  边界 case 处理 + 抓 10 站 + W2 baseline 数据不变验证
  D4-5  文档更新 + 同步 + 归档
```

---

## 7. 测试策略

| 测试 | 工具 | 验证标准 |
|------|------|---------|
| 单元测试 mcp_loader | vitest | 加载 mcp_servers.json + 过滤 enabled + 错误处理 |
| 集成测试 tool 注册 | vitest + mock | mcpAdapter.connect() 后,tools 列表包含 mcp__pangu_crawler__web_fetch |
| e2e 测试 | Pangu UI + 盘古对话 | 盘古调"抓 https://example.com"返回 mock 内容 |
| 回归测试 | examples/test_urls.txt | 抓 10 站 baseline 7/10 不破 |
| 异常测试 | 主动 kill pangu-crawler 子进程 | Pangu 报连接失败,不挂 |

---

## 8. 替代方案(老板拍)

### 方案 A: 直接改 Pangu 核心(本设计)
- 工作量: 2-3 周
- 风险: 中(改 Pangu 核心)
- 收益: 真正闭环,Pangu 可以调任何 MCP server

### 方案 B: Pangu 不动,pangu-crawler 暴露 HTTP
- 工作量: 1 天
- 风险: 低(只动 pangu-crawler)
- 收益: Pangu 用 HTTP 调,但**不算"标准 MCP 集成"**,违背 v0.3 战略

### 方案 C: 只做 Phase 1+2,不做 UI
- 工作量: 1 周
- 风险: 中
- 收益: e2e 通,但 UI 还是要手工改 mcp_servers.json

---

## 9. 老板决策点

- [ ] **方案选 A / B / C**?
- [ ] **实施节奏**:一次性 2-3 周 OR 拆 4 个 Phase 各自评审?
- [ ] **风险预算**:老板能容忍 Pangu 重启 30s 的窗口吗?什么时候?
- [ ] **CEO 节点 vs 测试节点**:在 .88(CEO)上直接改 vs 另起 .245(CTO 失联中)作 test bed?

---

## 10. 关联文档

- `pangu-crawler/docs/PANGU-INTEGRATION.md` — pangu-crawler 端使用手册(v0.1)
- `pangu-crawler/docs/DEV.md` — pangu-crawler 总开发文档(v0.4)
- `pangu/modules/mcp_adapter.js` — Pangu MCP 客户端实现
- `pangu/modules/feature_gates.js` — features.json 加载机制

---

## 11. 版本

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-06-17 | 初版,4 阶段集成方案 + 风险评估 | 墨 |
