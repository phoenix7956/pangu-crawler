#!/bin/bash
# 启动 MCP server（W1 mock 模式）
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")/mcp-server"

cd "$MCP_DIR"

# 安装依赖（如果还没装）
if [ ! -d "node_modules" ]; then
  echo "Installing MCP server dependencies..."
  pnpm install
fi

# 编译 TS
echo "Building TypeScript..."
pnpm build

# 启动
echo "Starting MCP server in W1 mock mode..."
PANGU_CRAWLER_MOCK=1 node dist/index.js
