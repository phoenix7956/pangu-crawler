/**
 * 端到端测试（E2E，T1.10）
 *
 * 验证：
 *   1. PanguCrawlerServer 能启动
 *   2. list_tools 返 web_fetch
 *   3. call_tool('web_fetch', { url: ... }) 返 mock 数据
 *   4. 错误参数返结构化错误
 *
 * 不启 stdio transport（那是阻塞进程），直接调 MCP SDK 的 protocol handler。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PanguCrawlerServer } from '../src/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { AppConfig } from '../src/config';

const testConfig: AppConfig = {
  server: { name: 'e2e', version: '0.1.0', description: 'e2e' },
  crawler: {
    python_path: 'mock',
    crawler_module: 'pangu_crawler.cli',
    stdio_timeout_ms: 60000,
    default_timeout_ms: 30000,
    max_retries: 3,
    use_proxy: false,
  },
  logging: { level: 'error', pretty: false },
};

describe('E2E: web_fetch tool flow', () => {
  let client: Client;

  beforeEach(async () => {
    const server = new PanguCrawlerServer(testConfig);
    // 暴露 server（绕过 run()，避免启 stdio transport）
    (globalThis as Record<string, unknown>).__panguServer = (server as unknown as { server: unknown }).server;

    client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await (server as unknown as { server: { connect: (t: unknown) => Promise<void> } }).server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  it('lists web_fetch as the only tool', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('web_fetch');
  });

  it('calls web_fetch with valid URL returns ok', async () => {
    const result = await client.callTool({
      name: 'web_fetch',
      arguments: { url: 'https://example.com' },
    });
    expect(result.isError).toBeFalsy();
    const content = (result.content as Array<{ type: string; text: string }>)[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.status_code).toBe(200);
    expect(parsed.result.content).toContain('Mock content');
    expect(parsed.trace_id).toBeTruthy();
  });

  it('rejects invalid URL with structured error', async () => {
    const result = await client.callTool({
      name: 'web_fetch',
      arguments: { url: 'not-a-url' },
    });
    expect(result.isError).toBe(true);
    const content = (result.content as Array<{ type: string; text: string }>)[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('UNKNOWN');
  });

  it('rejects unknown tool name', async () => {
    const result = await client.callTool({
      name: 'web_unknown',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const content = (result.content as Array<{ type: string; text: string }>)[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.error.message).toContain('unknown tool');
  });
});
