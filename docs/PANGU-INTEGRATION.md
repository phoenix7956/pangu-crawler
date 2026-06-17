# Pangu 集成指南

> 目的: 把 pangu-crawler 注册到 Pangu 的 MCP server 列表,让盘古 agent 像调函数一样调爬虫。
> 适用: Pangu 0.1+ (含 `modules/mcp_adapter.js` + `desktop/.../settings/MCP.jsx`)

---

## 1. 前提

- ✅ Pangu 已安装 (`/Users/feng/Applications/pangu/`)
- ✅ Pangu `modules/mcp_adapter.js` (193 行) 已就绪
- ✅ Pangu UI 设置页有「MCP」配置入口
- ✅ pangu-crawler 已 build (`mcp-server/dist/index.js`)

如果 pangu-crawler 还没 build,先跑:

```bash
cd /Users/feng/Applications/pangu-crawler/mcp-server
pnpm install --frozen-lockfile
pnpm build
```

---

## 2. Pangu UI 注册 (推荐方式)

### 步骤

1. 启动 Pangu UI: `http://localhost:18901/ui`
2. 进入「设置」→「MCP」页面 (截图见 README)
3. 点「+ 添加」按钮
4. 填入以下配置:

```json
{
  "name": "pangu-crawler",
  "transport": "stdio",
  "command": "bash",
  "args": ["/Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh"],
  "env": {
    "PANGU_CRAWLER_MOCK": "0"
  },
  "enabled": true,
  "description": "Pangu-MCP 生态首个开源爬虫插件,Apache 2.0"
}
```

5. 点「保存」
6. 看到状态从「关闭」变「开启」(✅),并显示「已连接」

### W1 mock 模式 (测试用)

如果想先用 mock 模式验证,改 `PANGU_CRAWLER_MOCK=1`:

```json
{
  "name": "pangu-crawler (mock)",
  "transport": "stdio",
  "command": "bash",
  "args": ["/Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh"],
  "env": {
    "PANGU_CRAWLER_MOCK": "1"
  },
  "enabled": true,
  "description": "W1 mock 模式测试,假数据,不打网络"
}
```

---

## 3. 配置文件方式 (高级用户)

如果想用配置文件 (而不是 UI),编辑 Pangu 的 MCP 配置:

```
/Users/feng/Applications/pangu/config/mcp_servers.json
```

(注: Pangu 现有配置路径以实际为准,可能叫 `mcp.json` 或在 `desktop/src/.../config.json`)

格式同 §2 JSON。

---

## 4. 验证

### 4.1 手工验证 stdio 通信

跑一个 fake client 看握手是否成功:

```bash
# Terminal 1: 启动 MCP server
bash /Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh

# 应该看到:
# [start-mcp] 🔨 编译 TypeScript... (如果没 build)
# 然后进入 stdio 模式,等输入

# Terminal 2: 发 initialize 请求
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | bash /Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh
```

应该看到 server 响应 `result.protocolVersion = "2024-11-05"`。

### 4.2 Pangu 端验证

启动 Pangu,问盘古:
> "用 pangu-crawler 抓 https://example.com"

应该看到:
1. Pangu 调 `web_fetch` tool
2. 收到 mock 数据 (W1 模式) 或 真实 HTML (W2 模式)
3. 盘古把内容整合到回答

### 4.3 单元测试

跑 pangu-crawler 自带的测试:

```bash
cd /Users/feng/Applications/pangu-crawler/mcp-server
pnpm test
```

应该看到 **28/28 通过** (W1 已达成)。

---

## 5. 故障排查

### 5.1 Pangu UI 显示「未连接」

**原因 1**: start-mcp.sh 权限不对
```bash
chmod +x /Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh
```

**原因 2**: pangu-crawler 没 build
```bash
cd /Users/feng/Applications/pangu-crawler/mcp-server
pnpm install && pnpm build
```

**原因 3**: 端口冲突 / 子进程被杀
- 看 Pangu 日志: `tail -f /Users/feng/Applications/pangu/logs/*.log`
- 搜 `[MCPAdapter]` 关键字

### 5.2 协议握手失败

**症状**: 日志显示 `MCP handshake timeout`

**排查**:
```bash
# 直接跑 start-mcp.sh 看启动错误
bash /Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh < /dev/null
```

如果立刻退出,看 stderr 错误信息。常见:
- `Cannot find module ...` → 跑 `pnpm install`
- `Permission denied` → `chmod +x`
- `SyntaxError` → 跑 `pnpm build` 重编

### 5.3 抓取失败 (W2 阶段)

**症状**: tool 返回 `CHALLENGE_FAILED` 或 `TIMEOUT`

**缓解**:
- W2 baseline 数据看 `docs/BASELINE.md`
- 加 retry (默认 3 次)
- W3+ 引入 Camoufox (反指纹)

---

## 6. 进阶: 多 Pangu 共享 MCP server

如果未来 Pangu 多 agent 部署,可以让 pangu-crawler 走 TCP/SSE 常驻:

```json
{
  "name": "pangu-crawler-shared",
  "transport": "sse",
  "command": "node",
  "args": ["/Users/feng/Applications/pangu-crawler/mcp-server/dist/index.js", "--transport=sse", "--port=18910"]
}
```

(注: W1 stdio 模式足够单 Pangu 用,W3+ 评估池化)

---

## 7. 关联文档

- `docs/DEV.md` — 项目总开发文档
- `docs/API.md` — `web_fetch` tool 接口规范
- `mcp-server/src/server.ts` — MCP server 实现
- `mcp-server/tests/e2e.test.ts` — 端到端测试 (InMemoryTransport)
