/**
 * web_fetch tool 单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  WebFetchInputSchema,
  webFetchToolDefinition,
} from '../src/tools/web_fetch';

describe('webFetch tool', () => {
  describe('input schema', () => {
    it('requires url', () => {
      const r = WebFetchInputSchema.safeParse({});
      expect(r.success).toBe(false);
    });

    it('accepts minimal valid input', () => {
      const r = WebFetchInputSchema.safeParse({ url: 'https://example.com' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.format).toBe('markdown'); // default
        expect(r.data.extract_main).toBe(true); // default
      }
    });

    it('rejects invalid url', () => {
      const r = WebFetchInputSchema.safeParse({ url: 'not-a-url' });
      expect(r.success).toBe(false);
    });

    it('accepts all optional fields', () => {
      const r = WebFetchInputSchema.safeParse({
        url: 'https://example.com',
        format: 'text',
        timeout_ms: 10000,
        max_retries: 5,
        use_proxy: true,
        wait_for_selector: '.content',
        extract_main: false,
        headers: { 'X-Test': '1' },
      });
      expect(r.success).toBe(true);
    });

    it('rejects invalid format enum', () => {
      const r = WebFetchInputSchema.safeParse({
        url: 'https://example.com',
        format: 'xml', // not in enum
      });
      expect(r.success).toBe(false);
    });

    it('rejects negative timeout', () => {
      const r = WebFetchInputSchema.safeParse({
        url: 'https://example.com',
        timeout_ms: -1,
      });
      expect(r.success).toBe(false);
    });
  });

  describe('tool definition (MCP list_tools)', () => {
    it('has name and description', () => {
      expect(webFetchToolDefinition.name).toBe('web_fetch');
      expect(webFetchToolDefinition.description).toBeTruthy();
    });

    it('declares url as required', () => {
      expect(webFetchToolDefinition.inputSchema.required).toContain('url');
    });
  });
});
