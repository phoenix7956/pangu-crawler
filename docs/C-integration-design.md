# C 方案对接设计

**目标**:盘古 agent 调 pangu-crawler 抓网页。

**① Pangu 新增**:`modules/pangu_crawler_client.js`(stdio JSON-RPC 客户端,启 MCP server 子进程);主入口仿 `TOOL_WEB_SEARCH` 加 `TOOL_WEB_FETCH` 定义,默认 tool 列表与 `web_search` 并列启用。

**② crawler-core 暴露**:MCP server `web_fetch` 工具(stdio/JSON-RPC),W2 由 Python `crawler-core` 模块承接真实抓取,W1 走 mock。

**③ 通信协议**:stdio JSON-RPC,每行一 JSON,Python `CrawlerError` 原样透传,跟现有 `crawler_client.ts` 同款。

**开放问题(待老板拍板)**:Pangu 端是 in-process 启 MCP 子进程(简单、隔离、每次启进程开销)还是常驻 MCP server 走 TCP/SSE(低延迟、可被多 agent 复用)?倾向先 in-process,W3 再评估池化。
