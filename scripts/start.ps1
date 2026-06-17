# scripts/start.ps1
#
# 用途: Windows PowerShell 启动 Pangu Crawler MCP server
# 等价于 Mac/Linux 的 scripts/start-mcp.sh
#
# 测试: .\start.ps1 应该启动后等输入

$ErrorActionPreference = "Stop"

# ── 1. 定位路径 ─────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$MCPDir = Join-Path $ProjectRoot "mcp-server"

Set-Location $MCPDir

# ── 2. 检查 Node.js 版本 (>= 20) ──────────────────────────
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[start.ps1] X 找不到 node,请先安装 Node.js 20+" -ForegroundColor Red
    exit 1
}

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
    Write-Host "[start.ps1] X Node.js 版本过老 ($nodeMajor),需要 20+" -ForegroundColor Red
    exit 1
}

# ── 3. 检查 MCP_DIR 存在 ─────────────────────────────────
if (-not (Test-Path "$MCPDir\package.json")) {
    Write-Host "[start.ps1] X 找不到 MCP 目录: $MCPDir" -ForegroundColor Red
    exit 1
}

# ── 4. 自动装依赖 (如需要) ───────────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Host "[start.ps1] . 装 MCP server 依赖..." -ForegroundColor Yellow
    pnpm install --frozen-lockfile
}

# ── 5. 自动 build (如需要) ───────────────────────────────
if (-not (Test-Path "dist")) {
    Write-Host "[start.ps1] . 编译 TypeScript..." -ForegroundColor Yellow
    pnpm build
}

# ── 6. 启动 MCP server (stdio 模式) ──────────────────────
node dist\index.js
