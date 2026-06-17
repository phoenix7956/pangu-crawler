/**
 * MCP Server 主类
 *
 * 协议：stdio/JSON-RPC（Anthropic MCP 官方 SDK 默认 transport）
 * 注意：MCP server 协议 ≠ Anthropic /v1/messages（后者是 LLM API endpoint）
 * 详见 docs/DEV.md §3 修订说明
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { loadConfig, type AppConfig } from './config.js';
import { getLogger } from './logger.js';
import { CrawlerClient } from './crawler_client.js';
import {
  webFetchToolDefinition,
  webFetch,
  WebFetchInputSchema,
} from './tools/web_fetch.js';

export class PanguCrawlerServer {
  private config: AppConfig;
  private logger;
  private crawlerClient: CrawlerClient;
  private server: Server;

  constructor(config?: AppConfig) {
    this.config = config ?? loadConfig();
    this.logger = getLogger(this.config.logging);
    this.crawlerClient = new CrawlerClient(this.config.crawler);

    this.server = new Server(
      {
        name: this.config.server.name,
        version: this.config.server.version,
      },
      {
        capabilities: {
          tools: {},
          // W1 阶段不开 resources（health check 走 ping 而不是 resource）
          // W3 阶段考虑加 resources: [{ uri: 'pangu://health', name: 'health' }]
        },
      }
    );

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // list_tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('mcp.list_tools');
      return {
        tools: [webFetchToolDefinition],
      };
    });

    // call_tool
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { name, arguments: args } = request.params;
        this.logger.info({ tool: name, args }, 'mcp.call_tool');

        if (name === 'web_fetch') {
          // 严格校验（Zod），参数错误立刻返，不传 Python
          const parsed = WebFetchInputSchema.safeParse(args);
          if (!parsed.success) {
            const issues = parsed.error.issues.map(
              (i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`
            );
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      ok: false,
                      error: {
                        code: 'UNKNOWN',
                        message: 'invalid arguments',
                        details: issues,
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }
          return webFetch(this.crawlerClient, parsed.data);
        }

        // 未知 tool
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: false,
                  error: {
                    code: 'UNKNOWN',
                    message: `unknown tool: ${name}`,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    );
  }

  /**
   * 启动 stdio transport。阻塞。
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    this.logger.info(
      {
        name: this.config.server.name,
        version: this.config.server.version,
        mockMode: process.env.PANGU_CRAWLER_MOCK === '1' || this.config.crawler.python_path === 'mock',
      },
      'mcp.server.starting'
    );
    await this.server.connect(transport);
    this.logger.info('mcp.server.connected');
  }

  /**
   * 健康检查（W1.5）
   *
   * stdio 模式下没有 HTTP 端口，所以"health check"通过 MCP `ping` 资源实现。
   * 但 MCP 协议本身没有 ping 方法。W1 实际方案：
   *   - 起一个独立的 stdio ping handler（W1.5 完成项）
   *   - 返回 { ok: true, server, crawler_config, ts }
   */
  healthCheck(): {
    ok: boolean;
    server: { name: string; version: string };
    crawler_config: { python_path: string; crawler_module: string };
    ts: string;
  } {
    return {
      ok: true,
      server: {
        name: this.config.server.name,
        version: this.config.server.version,
      },
      crawler_config: {
        python_path: this.config.crawler.python_path,
        crawler_module: this.config.crawler.crawler_module,
      },
      ts: new Date().toISOString(),
    };
  }
}
