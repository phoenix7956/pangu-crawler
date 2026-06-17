#!/bin/bash
# 跑所有测试
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== MCP server tests ==="
cd "$ROOT/mcp-server"
if [ ! -d "node_modules" ]; then
  pnpm install
fi
pnpm test

echo ""
echo "=== Crawler core tests ==="
cd "$ROOT/crawler-core"
if ! command -v uv &> /dev/null; then
  echo "uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi
uv sync
uv run pytest

echo ""
echo "=== All tests passed ==="
