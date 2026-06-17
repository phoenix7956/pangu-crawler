/**
 * CrawlerClient 单元测试（mock 模式）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CrawlerClient } from '../src/crawler_client';
import type { CrawlerConfig } from '../src/config';

const mockConfig: CrawlerConfig = {
  python_path: 'mock', // 触发 mock 分支
  crawler_module: 'pangu_crawler.cli',
  stdio_timeout_ms: 60000,
  default_timeout_ms: 30000,
  max_retries: 3,
  use_proxy: false,
};

describe('CrawlerClient (mock mode)', () => {
  let client: CrawlerClient;

  beforeEach(() => {
    client = new CrawlerClient(mockConfig);
  });

  afterEach(() => {
    // 清理
  });

  it('returns ok=true with mock data when python_path=mock', async () => {
    const resp = await client.fetch({ url: 'https://example.com' });
    expect(resp.ok).toBe(true);
    if (resp.ok) {
      expect(resp.result.status_code).toBe(200);
      expect(resp.result.mode).toBe('http');
      expect(resp.result.content).toContain('Mock content for');
    }
    expect(resp.trace_id).toBeTruthy();
  });

  it('respects custom format', async () => {
    const resp = await client.fetch({
      url: 'https://example.com',
      format: 'html',
    });
    expect(resp.ok).toBe(true);
  });

  it('passes through wait_for_selector', async () => {
    const resp = await client.fetch({
      url: 'https://example.com',
      wait_for_selector: '.content',
    });
    expect(resp.ok).toBe(true);
  });

  it('respects use_proxy flag (no effect in mock, just no throw)', async () => {
    const resp = await client.fetch({
      url: 'https://example.com',
      use_proxy: true,
    });
    expect(resp.ok).toBe(true);
  });
});
