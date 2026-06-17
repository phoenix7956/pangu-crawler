/**
 * web_fetch tool - MCP 协议暴露给 agent 的唯一工具
 *
 * 参数/返回 schema 见 docs/DEV.md §5.1
 */
import { z } from 'zod';
import { CrawlerClient, type WebFetchResult } from '../crawler_client.js';

// 参数 schema（Zod）—— W1 阶段与文档 §5.1 完全一致
export const WebFetchInputSchema = z.object({
  url: z.string().url().describe('目标 URL（必填）'),
  format: z
    .enum(['markdown', 'text', 'html'])
    .optional()
    .default('markdown')
    .describe('返回内容格式，默认 markdown'),
  timeout_ms: z.number().int().positive().optional().describe('单次超时（ms），默认 30000'),
  max_retries: z.number().int().nonnegative().optional().describe('重试次数，默认 3'),
  use_proxy: z.boolean().optional().describe('是否走代理，W1 stub 默认 false'),
  wait_for_selector: z.string().optional().describe('Playwright 模式下等待的 CSS 选择器'),
  extract_main: z.boolean().optional().default(true).describe('是否用 readability 提取主要内容'),
  headers: z.record(z.string(), z.string()).optional().describe('自定义 headers'),
});

export type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

/**
 * Tool 注册信息（MCP 协议 list_tools 返回）
 */
export const webFetchToolDefinition = {
  name: 'web_fetch',
  description:
    '抓取一个 URL 并返回结构化内容。返回 markdown/text/html。W1 阶段走 mock，W2 接真实抓取。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: '目标 URL（必填）' },
      format: {
        type: 'string',
        enum: ['markdown', 'text', 'html'],
        default: 'markdown',
        description: '返回内容格式',
      },
      timeout_ms: { type: 'number', description: '单次超时（ms）' },
      max_retries: { type: 'number', description: '重试次数' },
      use_proxy: { type: 'boolean', description: '是否走代理（W1 stub）' },
      wait_for_selector: { type: 'string', description: 'Playwright 等待 CSS' },
      extract_main: { type: 'boolean', default: true, description: 'readability 提取' },
      headers: { type: 'object', description: '自定义 headers' },
    },
    required: ['url'],
  },
};

/**
 * 调用入口
 */
export async function webFetch(
  client: CrawlerClient,
  args: WebFetchInput
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const resp = await client.fetch(args);

  if (!resp.ok) {
    // 错误透传：完整结构化错误信息给 agent，绝不吞
    const errJson = JSON.stringify(
      {
        ok: false,
        trace_id: resp.trace_id,
        error: resp.error,
      },
      null,
      2
    );
    return {
      content: [{ type: 'text', text: errJson }],
      isError: true,
    };
  }

  const result: WebFetchResult = resp.result;
  const successJson = JSON.stringify(
    {
      ok: true,
      trace_id: resp.trace_id,
      result,
    },
    null,
    2
  );
  return {
    content: [{ type: 'text', text: successJson }],
  };
}
