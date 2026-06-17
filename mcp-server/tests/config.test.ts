/**
 * config.ts 单元测试
 *
 * 注：loadConfig 实际从 PROJECT_ROOT/config.json 找文件（MCP server 实际跑的位置）。
 * 测试要 mock PROJECT_ROOT，但当前实现是常量导出，简化处理：
 *   1. 验证能正常 load 现有 config.json（mcp-server 目录）
 *   2. 验证 .env override 逻辑（用单独的纯函数测）
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, PROJECT_ROOT } from '../src/config';

describe('loadConfig', () => {
  it('loads existing config.json (mcp-server/config.json)', () => {
    const cfg = loadConfig();
    expect(cfg.server.name).toBe('pangu-crawler');
    expect(cfg.server.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(cfg.crawler.python_path).toBeTruthy();
    expect(cfg.crawler.default_timeout_ms).toBeGreaterThan(0);
  });

  it('PROJECT_ROOT points to mcp-server', () => {
    const cfgPath = join(PROJECT_ROOT, 'config.json');
    expect(existsSync(cfgPath)).toBe(true);
  });

  it('respects CRAWLER_DEFAULT_TIMEOUT_MS env var', () => {
    const original = process.env.CRAWLER_DEFAULT_TIMEOUT_MS;
    process.env.CRAWLER_DEFAULT_TIMEOUT_MS = '99999';
    try {
      const cfg = loadConfig();
      expect(cfg.crawler.default_timeout_ms).toBe(99999);
    } finally {
      if (original === undefined) {
        delete process.env.CRAWLER_DEFAULT_TIMEOUT_MS;
      } else {
        process.env.CRAWLER_DEFAULT_TIMEOUT_MS = original;
      }
    }
  });

  it('respects CRAWLER_USE_PROXY env var (true)', () => {
    const original = process.env.CRAWLER_USE_PROXY;
    process.env.CRAWLER_USE_PROXY = 'true';
    try {
      const cfg = loadConfig();
      expect(cfg.crawler.use_proxy).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.CRAWLER_USE_PROXY;
      } else {
        process.env.CRAWLER_USE_PROXY = original;
      }
    }
  });

  it('rejects invalid number in env var', () => {
    const original = process.env.CRAWLER_DEFAULT_TIMEOUT_MS;
    process.env.CRAWLER_DEFAULT_TIMEOUT_MS = 'not-a-number';
    try {
      expect(() => loadConfig()).toThrow(/invalid number/);
    } finally {
      if (original === undefined) {
        delete process.env.CRAWLER_DEFAULT_TIMEOUT_MS;
      } else {
        process.env.CRAWLER_DEFAULT_TIMEOUT_MS = original;
      }
    }
  });
});
