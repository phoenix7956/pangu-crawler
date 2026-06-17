/**
 * 配置加载 - config.json + .env
 *
 * 设计：单例 loader，进程启动时调一次。W1 阶段所有配置都是静态的，
 * 不做热重载（YAGNI）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCP server 根目录（src/..）
export const PROJECT_ROOT = resolve(__dirname, '..');

export interface CrawlerConfig {
  python_path: string;
  crawler_module: string;
  stdio_timeout_ms: number;
  default_timeout_ms: number;
  max_retries: number;
  use_proxy: boolean;
}

export interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  pretty: boolean;
}

export interface AppConfig {
  server: {
    name: string;
    version: string;
    description: string;
  };
  crawler: CrawlerConfig;
  logging: LoggingConfig;
}

/**
 * 加载并校验配置。优先级：.env > config.json > 默认值
 *
 * .env 可以覆盖 config.json 的部分字段（key 前缀匹配）：
 *   CRAWLER_DEFAULT_TIMEOUT_MS -> crawler.default_timeout_ms
 *   CRAWLER_MAX_RETRIES       -> crawler.max_retries
 *   CRAWLER_USE_PROXY         -> crawler.use_proxy
 *   LOG_LEVEL                 -> logging.level
 *   STDIO_TIMEOUT_MS          -> crawler.stdio_timeout_ms
 */
export function loadConfig(): AppConfig {
  // 1. 加载 .env（不存在也不报错）
  const envPath = join(PROJECT_ROOT, '.env');
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  }

  // 2. 加载 config.json
  const configPath = join(PROJECT_ROOT, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}`);
  }
  const raw = readFileSync(configPath, 'utf-8');
  const cfg = JSON.parse(raw) as AppConfig;

  // 3. .env 覆盖（白名单）
  const num = (v: string | undefined, fallback: number): number => {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error(`invalid number: ${v}`);
    return n;
  };
  const bool = (v: string | undefined, fallback: boolean): boolean => {
    if (v === undefined || v === '') return fallback;
    return v === 'true' || v === '1';
  };

  // 跨平台: 自动检测 python 命令名 (Mac/Linux: python3, Windows: python)
  // 优先级: PANGU_CRAWLER_PYTHON env > config.json > 自动检测
  if (!process.env.PANGU_CRAWLER_PYTHON && (cfg.crawler.python_path === 'python3' || cfg.crawler.python_path === 'python')) {
    cfg.crawler.python_path = process.platform === 'win32' ? 'python' : 'python3';
  }

  cfg.crawler.default_timeout_ms = num(
    process.env.CRAWLER_DEFAULT_TIMEOUT_MS,
    cfg.crawler.default_timeout_ms
  );
  cfg.crawler.max_retries = num(
    process.env.CRAWLER_MAX_RETRIES,
    cfg.crawler.max_retries
  );
  cfg.crawler.stdio_timeout_ms = num(
    process.env.STDIO_TIMEOUT_MS,
    cfg.crawler.stdio_timeout_ms
  );
  cfg.crawler.use_proxy = bool(
    process.env.CRAWLER_USE_PROXY,
    cfg.crawler.use_proxy
  );
  if (process.env.LOG_LEVEL) {
    cfg.logging.level = process.env.LOG_LEVEL as LoggingConfig['level'];
  }

  return cfg;
}
