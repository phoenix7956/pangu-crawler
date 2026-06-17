# 测试策略

## W1 验收

| 任务 | 测试 | 覆盖 |
|------|------|------|
| T1.1 项目结构 | 手动 ls | - |
| T1.2 package.json | `pnpm install` 成功 | - |
| T1.3 MCP 框架 | `e2e.test.ts` | 协议层 |
| T1.4 暴露 web_fetch | `e2e.test.ts` + `web_fetch.test.ts` | 完整 |
| T1.5 health check | `server.test.ts` | 完整 |
| T1.6 config 加载 | `config.test.ts` | 80% |
| T1.7 stdio 通信 | `test_cli.py` | 完整 |
| T1.8 日志 | 手动 grep log | - |
| T1.9 单元测试 80% | `pnpm test:coverage` | 80% |
| T1.10 端到端 | `e2e.test.ts` | 完整 |

## 覆盖率目标

- **W1**: 80%（MCP server + crawler core 全部）
- **W2**: 80% + 真实 URL 抓取 ≥ 70% 成功率

## 运行测试

```bash
# MCP server
cd mcp-server
pnpm test
pnpm test:coverage

# Crawler core
cd ../crawler-core
uv run pytest
uv run pytest --cov=pangu_crawler --cov-report=term-missing
```

## 已知跳过

- `config.test.ts` 第二个 case 测的是 JSON 解析逻辑（受 PROJECT_ROOT 限制没全跑），W2 改用 DI 重构后补齐
