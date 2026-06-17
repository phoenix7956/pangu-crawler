#!/usr/bin/env node
/**
 * Pangu Crawler MCP Server - 入口
 *
 * 启动方式：
 *   PANGU_CRAWLER_MOCK=1 node dist/index.js   # W1 阶段（mock 抓取）
 *   node dist/index.js                        # W2 阶段（真实抓取，需要 Python 子进程）
 */
import { PanguCrawlerServer } from './server';

async function main(): Promise<void> {
  const server = new PanguCrawlerServer();
  // 暴露 health check 给测试用（用全局变量；不优雅但足够 W1）
  (globalThis as Record<string, unknown>).__panguCrawlerServer = server;
  await server.run();
}

main().catch((err) => {
  // 启动失败必须打到 stderr（MCP 协议 stdout 只走 JSON-RPC）
  console.error('[pangu-crawler] fatal:', err);
  process.exit(1);
});
