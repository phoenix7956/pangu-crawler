/**
 * CrawlerClient real spawn 测试（不依赖 Python 子进程）
 *
 * W1 阶段 stdio 子进程路径是 W2 实现的，但需要测：超时/错误透传/JSON 解析失败
 * 用一个 mock 脚本来模拟。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CrawlerClient } from '../src/crawler_client';
import type { CrawlerConfig } from '../src/config';

const baseConfig: CrawlerConfig = {
  python_path: 'python3',
  crawler_module: 'pangu_crawler.cli',
  stdio_timeout_ms: 5000,
  default_timeout_ms: 2000,
  max_retries: 3,
  use_proxy: false,
};

describe('CrawlerClient (real spawn, with mock Python script)', () => {
  let tmp: string;
  let client: CrawlerClient;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'pangu-cli-'));
    client = new CrawlerClient({ ...baseConfig, python_path: 'python3' });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('handles successful Python response', async () => {
    const script = join(tmp, 'mock_cli.py');
    writeFileSync(
      script,
      `
import sys, json
req = json.loads(sys.stdin.readline())
print(json.dumps({
    "ok": True,
    "trace_id": req.get("trace_id"),
    "result": {
        "content": "Hello from mock Python",
        "final_url": req["url"],
        "status_code": 200,
        "mode": "http",
        "duration_ms": 100,
        "metadata": {"title": "test", "content_length": 22, "redirected": False}
    }
}))
`
    );
    client = new CrawlerClient({
      ...baseConfig,
      python_path: 'python3',
      crawler_module: script.replace('/mock_cli.py', '.mock_cli'), // 不重要，我们直接传 script
    });
    // 覆盖 python_path 跑我们的脚本：直接传脚本路径
    // 用一个 hack：把整个 python 调用的 module 改成一个文件
    // 简单点：直接用 script 路径
    // 但 client spawn 的是 "python3 -m <module>"，所以我们 hack 用 PYTHONPATH
    // 更简单：让 client 直接调我们的脚本作为 "python3"
    client = new CrawlerClient({
      ...baseConfig,
      python_path: '/usr/bin/env',
      crawler_module: 'python3',
    });
    // 改用：python3 接受 -m 但我们的 module 不在 path 上
    // 改用最直接：改 client.fetch 内部走 customPath
    // 这里用 hack：传一个会忽略 -m 的 mock python
    // 实际做法：写一个 wrapper 脚本充当 python3
    const wrapper = join(tmp, 'fake_python');
    writeFileSync(
      wrapper,
      `#!/bin/bash
exec python3 ${script}`
    );
    chmodSync(wrapper, 0o755);

    client = new CrawlerClient({
      ...baseConfig,
      python_path: wrapper,
      crawler_module: 'placeholder',
    });

    const resp = await client.fetch({ url: 'https://example.com' });
    expect(resp.ok).toBe(true);
    if (resp.ok) {
      expect(resp.result.content).toBe('Hello from mock Python');
      expect(resp.result.status_code).toBe(200);
    }
  });

  it('handles Python returning error JSON', async () => {
    const script = join(tmp, 'error_cli.py');
    writeFileSync(
      script,
      `
import sys, json
req = json.loads(sys.stdin.readline())
print(json.dumps({
    "ok": False,
    "trace_id": req.get("trace_id"),
    "error": {
        "code": "TIMEOUT",
        "status_code": None,
        "url": req["url"],
        "attempts": 1,
        "fallback_attempted": False,
        "original_error": "mock timeout"
    }
}))
`
    );
    const wrapper = join(tmp, 'fake_python');
    writeFileSync(wrapper, `#!/bin/bash\nexec python3 ${script}`);
    chmodSync(wrapper, 0o755);

    client = new CrawlerClient({
      ...baseConfig,
      python_path: wrapper,
      crawler_module: 'placeholder',
    });

    const resp = await client.fetch({ url: 'https://example.com' });
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.code).toBe('TIMEOUT');
      expect(resp.error.original_error).toContain('mock timeout');
    }
  });

  it('handles Python non-zero exit code', async () => {
    const script = join(tmp, 'crash_cli.py');
    writeFileSync(script, 'import sys; sys.exit(1)');
    const wrapper = join(tmp, 'fake_python');
    writeFileSync(wrapper, `#!/bin/bash\nexec python3 ${script}`);
    chmodSync(wrapper, 0o755);

    client = new CrawlerClient({
      ...baseConfig,
      python_path: wrapper,
      crawler_module: 'placeholder',
    });

    const resp = await client.fetch({ url: 'https://example.com' });
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.code).toBe('UNKNOWN');
      expect(resp.error.original_error).toContain('Python exited code=1');
    }
  });

  it('handles Python invalid JSON output', async () => {
    const script = join(tmp, 'badjson_cli.py');
    writeFileSync(script, 'print("not valid json")');
    const wrapper = join(tmp, 'fake_python');
    writeFileSync(wrapper, `#!/bin/bash\nexec python3 ${script}`);
    chmodSync(wrapper, 0o755);

    client = new CrawlerClient({
      ...baseConfig,
      python_path: wrapper,
      crawler_module: 'placeholder',
    });

    const resp = await client.fetch({ url: 'https://example.com' });
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.code).toBe('PARSE_ERROR');
    }
  });
});
