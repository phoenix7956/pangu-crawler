/**
 * Pino logger 单例
 *
 * W1 阶段只输出 JSON（W1.8 任务）。pretty 模式 W2 阶段再说。
 */
import pino from 'pino';
import type { LoggingConfig } from './config';

let _logger: pino.Logger | null = null;

export function getLogger(cfg: LoggingConfig): pino.Logger {
  if (_logger) return _logger;
  _logger = pino({
    level: cfg.level,
    prettyPrint: cfg.pretty,
    base: { service: 'pangu-crawler-mcp' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return _logger;
}

/**
 * 测试用：重置单例
 */
export function _resetLoggerForTest(): void {
  _logger = null;
}
