/**
 * MCP Server ↔ Python crawler-core 通信层
 *
 * 协议：stdio JSON-RPC（每行一个 JSON 对象）
 *
 * MCP server 调一次 web_fetch → 启 Python 子进程 → 传 JSON
 *   {"url": "...", "format": "markdown", ...}
 * → Python 返 JSON
 *   {"content": "...", "final_url": "...", "status_code": 200, ...}
 *
 * W1 阶段：Python 端先 mock（不真抓），跑通通信管道。W2 阶段切真抓取。
 *
 * 错误透传原则（墨的硬要求）：
 *   Python 端抛的 CrawlerError 必须原样透传给 MCP client，绝不吞。
 *   stderr 文本作为 original_error 字段保留。
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { CrawlerConfig, LoggingConfig } from './config';
import { getLogger } from './logger';

export interface WebFetchArgs {
  url: string;
  format?: 'markdown' | 'text' | 'html';
  timeout_ms?: number;
  max_retries?: number;
  use_proxy?: boolean;
  wait_for_selector?: string;
  extract_main?: boolean;
  headers?: Record<string, string>;
}

export interface WebFetchResult {
  content: string;
  final_url: string;
  status_code: number;
  mode: 'http' | 'playwright';
  duration_ms: number;
  metadata: {
    title?: string;
    description?: string;
    content_type?: string;
    content_length?: number;
    redirected?: boolean;
  };
}

export interface CrawlerErrorPayload {
  code: 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CHALLENGE_FAILED' | 'PARSE_ERROR' | 'UNKNOWN';
  status_code: number | null;
  url: string;
  attempts: number;
  fallback_attempted: boolean;
  original_error: string;
}

export type CrawlerResponse =
  | { ok: true; result: WebFetchResult; trace_id: string }
  | { ok: false; error: CrawlerErrorPayload; trace_id: string };

export class CrawlerClient {
  private config: CrawlerConfig;
  private logger = getLogger({
    level: 'info',
    pretty: false,
  } as LoggingConfig);

  constructor(config: CrawlerConfig) {
    this.config = config;
  }

  /**
   * 调一次抓取。每次调用启一个 Python 子进程（W1 mock）。
   * 简化设计：暂不维护常驻进程池，W3 阶段再考虑复用。
   */
  async fetch(args: WebFetchArgs): Promise<CrawlerResponse> {
    const trace_id = randomUUID();
    const timeoutMs =
      args.timeout_ms ?? this.config.default_timeout_ms;

    this.logger.info({ trace_id, url: args.url, timeoutMs }, 'crawler.fetch.start');

    // W1 mock：Python 子进程还没实现，先直接返 mock 数据
    // 这样 MCP server 端可以独立验收 T1.7
    if (process.env.PANGU_CRAWLER_MOCK === '1' || this.config.python_path === 'mock') {
      return this.mockFetch(args, trace_id);
    }

    // W2 真实实现
    return this.spawnFetch(args, trace_id, timeoutMs);
  }

  private mockFetch(args: WebFetchArgs, trace_id: string): CrawlerResponse {
    // 模拟耗时
    const duration_ms = 50;
    return {
      ok: true,
      trace_id,
      result: {
        content: `# Mock content for ${args.url}\n\nThis is a W1 mock response. W2 will use real crawler.`,
        final_url: args.url,
        status_code: 200,
        mode: 'http',
        duration_ms,
        metadata: {
          title: `Mock title for ${args.url}`,
          description: 'W1 mock - no real fetch',
          content_type: 'text/markdown',
          content_length: 100,
          redirected: false,
        },
      },
    };
  }

  private async spawnFetch(
    args: WebFetchArgs,
    trace_id: string,
    timeoutMs: number
  ): Promise<CrawlerResponse> {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const child: ChildProcessWithoutNullStreams = spawn(
        this.config.python_path,
        ['-m', this.config.crawler_module],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      let stdoutBuf = '';
      let stderrBuf = '';
      let timer: NodeJS.Timeout | null = null;
      let resolved = false;

      const settle = (resp: CrawlerResponse) => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        resolve(resp);
      };

      // 超时
      timer = setTimeout(() => {
        this.logger.warn({ trace_id, timeoutMs }, 'crawler.fetch.timeout');
        settle({
          ok: false,
          trace_id,
          error: {
            code: 'TIMEOUT',
            status_code: null,
            url: args.url,
            attempts: 1,
            fallback_attempted: false,
            original_error: `stdin/stdout timeout after ${timeoutMs}ms. stderr=${stderrBuf.slice(0, 500)}`,
          },
        });
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf-8');
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf-8');
        this.logger.debug({ trace_id, stderr: chunk.toString() }, 'crawler.stderr');
      });

      child.on('error', (err) => {
        this.logger.error({ trace_id, err: err.message }, 'crawler.spawn.error');
        settle({
          ok: false,
          trace_id,
          error: {
            code: 'UNKNOWN',
            status_code: null,
            url: args.url,
            attempts: 0,
            fallback_attempted: false,
            original_error: `spawn error: ${err.message}`,
          },
        });
      });

      child.on('close', (code) => {
        if (resolved) return;
        const duration = Date.now() - startedAt;
        if (code !== 0) {
          settle({
            ok: false,
            trace_id,
            error: {
              code: 'UNKNOWN',
              status_code: null,
              url: args.url,
              attempts: 1,
              fallback_attempted: false,
              original_error: `Python exited code=${code}. stderr=${stderrBuf.slice(0, 500)}`,
            },
          });
          return;
        }
        try {
          const parsed = JSON.parse(stdoutBuf.trim()) as
            | { ok: true; result: WebFetchResult }
            | { ok: false; error: CrawlerErrorPayload };
          settle({ ...parsed, trace_id } as CrawlerResponse);
        } catch (e) {
          settle({
            ok: false,
            trace_id,
            error: {
              code: 'PARSE_ERROR',
              status_code: null,
              url: args.url,
              attempts: 1,
              fallback_attempted: false,
              original_error: `JSON parse error: ${(e as Error).message}. stdout=${stdoutBuf.slice(0, 500)}`,
            },
          });
        }
        this.logger.info({ trace_id, duration, mode: 'spawn' }, 'crawler.fetch.done');
      });

      // 发请求给 Python
      try {
        child.stdin.write(JSON.stringify({ ...args, trace_id }) + '\n');
        child.stdin.end();
      } catch (e) {
        settle({
          ok: false,
          trace_id,
          error: {
            code: 'UNKNOWN',
            status_code: null,
            url: args.url,
            attempts: 0,
            fallback_attempted: false,
            original_error: `stdin write error: ${(e as Error).message}`,
          },
        });
      }
    });
  }
}
