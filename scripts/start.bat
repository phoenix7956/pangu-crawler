@echo off
REM scripts/start.bat
REM
REM 用途: Windows cmd 启动 Pangu Crawler MCP server
REM 等价于 Mac/Linux 的 scripts/start-mcp.sh
REM
REM 测试: start.bat < nul 应该启动后等输入

setlocal enabledelayedexpansion

REM ── 1. 定位路径 ─────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "MCP_DIR=%PROJECT_ROOT%\mcp-server"

cd /d "%MCP_DIR%"

REM ── 2. 检查 Node.js 版本 (>= 20) ──────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [start.bat] X 找不到 node，请先安装 Node.js 20+ 1>&2
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%a"
if !NODE_MAJOR! LSS 20 (
    echo [start.bat] X Node.js 版本过老 ^(!NODE_MAJOR!^)，需要 20+ 1>&2
    exit /b 1
)

REM ── 3. 检查 MCP_DIR 存在 ─────────────────────────────────
if not exist "%MCP_DIR%\package.json" (
    echo [start.bat] X 找不到 MCP 目录: %MCP_DIR% 1>&2
    exit /b 1
)

REM ── 4. 自动装依赖 (如需要) ───────────────────────────────
if not exist "node_modules" (
    echo [start.bat] . 装 MCP server 依赖... 1>&2
    call pnpm install --frozen-lockfile 1>&2
)

REM ── 5. 自动 build (如需要) ───────────────────────────────
if not exist "dist" (
    echo [start.bat] . 编译 TypeScript... 1>&2
    call pnpm build 1>&2
)

REM ── 6. 启动 MCP server (stdio 模式) ──────────────────────
node dist\index.js
