/**
 * PanguCrawlerServer 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PanguCrawlerServer } from '../src/server';
import type { AppConfig } from '../src/config';

const testConfig: AppConfig = {
  server: { name: 'pangu-crawler-test', version: '0.1.0-test', description: 'test' },
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

describe('PanguCrawlerServer', () => {
  let server: PanguCrawlerServer;

  beforeEach(() => {
    server = new PanguCrawlerServer(testConfig);
  });

  it('healthCheck returns ok=true with server info', () => {
    const h = server.healthCheck();
    expect(h.ok).toBe(true);
    expect(h.server.name).toBe('pangu-crawler-test');
    expect(h.server.version).toBe('0.1.0-test');
    expect(h.crawler_config.python_path).toBe('mock');
    expect(h.ts).toBeTruthy();
    // 验证 ISO 格式
    expect(new Date(h.ts).toISOString()).toBe(h.ts);
  });
});
