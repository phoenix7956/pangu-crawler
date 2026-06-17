#!/bin/bash
# scripts/start-mcp.sh
# 
# 用途: Pangu mcp_adapter.js spawn 这个脚本启动 MCP server
# 设计: 一次性入口,无后台进程,stdio 模式
# 
# 调用方: Pangu 端
#   args: ["/Users/feng/Applications/pangu-crawler/scripts/start-mcp.sh"]
#   通信: stdin/stdout 走 JSON-RPC
#
# 测试: bash scripts/start-mcp.sh < /dev/null 应该启动后立即等输入

set -e

# ── 1. 定位路径 ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$PROJECT_ROOT/mcp-server"

# ── 2. 检查 Node.js 版本 (≥ 20) ──────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "[start-mcp] ❌ 找不到 node,请先安装 Node.js 20+" >&2
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[start-mcp] ❌ Node.js 版本过老 ($NODE_MAJOR),需要 20+" >&2
  exit 1
fi

# ── 3. 检查 MCP_DIR 存在 ─────────────────────────────────
if [ ! -d "$MCP_DIR" ]; then
  echo "[start-mcp] ❌ 找不到 MCP 目录: $MCP_DIR" >&2
  exit 1
fi

cd "$MCP_DIR"

# ── 4. 自动装依赖 (如需要) ───────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "[start-mcp] 📦 装 MCP server 依赖..." >&2
  pnpm install --frozen-lockfile 2>&1 | tail -5 >&2
fi

# ── 5. 自动 build (如需要) ───────────────────────────────
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
  echo "[start-mcp] 🔨 编译 TypeScript..." >&2
  pnpm build 2>&1 | tail -5 >&2
fi

# ── 6. 启动 MCP server (stdio 模式) ──────────────────────
# exec 替换 shell 进程,stdin/stdout 直接走 JSON-RPC
exec node dist/index.js
