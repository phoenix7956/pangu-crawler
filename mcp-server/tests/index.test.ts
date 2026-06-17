/**
 * index.ts 入口测试
 *
 * 注：index.ts 的 main() 会 server.run() → 阻塞在 stdio 上，无法直接测。
 * 改成测：实例化 server 不抛错 + health check 暴露
 */
import { describe, it, expect } from 'vitest';
import { PanguCrawlerServer } from '../src/server';
import type { AppConfig } from '../src/config';

const testConfig: AppConfig = {
  server: { name: 'idx-test', version: '0.1.0', description: 'idx' },
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

describe('index.ts entry (server instantiation)', () => {
  it('can instantiate PanguCrawlerServer without throwing', () => {
    expect(() => new PanguCrawlerServer(testConfig)).not.toThrow();
  });

  it('exposes healthCheck on server instance', () => {
    const server = new PanguCrawlerServer(testConfig);
    const h = server.healthCheck();
    expect(h.ok).toBe(true);
    expect(h.server.name).toBe('idx-test');
  });
});
