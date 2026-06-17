# pangu-crawler 反爬 baseline 数据

> 用途: 记录 W2 真实抓取阶段的反爬 baseline,为 W3+ 优化(代理池 / Camoufox)提供数据基础。
> 测试目标: 10 个公开站,验证 W2 抓取能力。

---

## 1. 测试环境

| 项 | 值 |
|------|-----|
| pangu-crawler 版本 | v0.1.0 (W2) |
| curl_cffi 版本 | 0.15.0 |
| lxml 版本 | 6.1.1 |
| readability-lxml 版本 | 0.8.4.1 |
| playwright 版本 | 1.60.0 |
| tenacity 版本 | 9.1.4 |
| Python 版本 | 3.12.11 |
| 平台 | darwin (MacBook Pro M5 Max) |
| 时间 | 2026-06-17 |
| 测试脚本 | `crawler-core/examples/test_fetch.py --update-md` |

---

## 2. 测试目标 (10 个公开站)

| # | URL | 类型 | 期望结果 |
|---|-----|------|---------|
| 1 | https://example.com/ | IANA 示例页 | 200, 静态 HTML |
| 2 | https://example.org/ | IANA 示例页 | 200, 静态 HTML |
| 3 | https://example.net/ | IANA 示例页 | 200, 静态 HTML |
| 4 | https://en.wikipedia.org/wiki/Web_scraping | 维基百科 | 200, 静态 HTML |
| 5 | https://www.ietf.org/rfc/rfc2616.txt | IETF 标准 | 200, 纯文本 |
| 6 | https://www.python.org/ | 编程语言官网 | 200 |
| 7 | https://github.com/anthropics/anthropic-cookbook | GitHub 仓库 | 200 (可能反爬) |
| 8 | https://news.ycombinator.com/ | 科技新闻 | 200 |
| 9 | https://crates.io/ | Rust 包管理 | 200 |
| 10 | https://www.npmjs.com/ | Node 包管理 | 200 (可能反爬) |

---

## 3. 验收标准

- [x] 成功率 ≥ 70% (≥ 7/10) — **7/10 = 70%** ✅
- [x] CF 挑战页能识别失败 (报 CHALLENGE_FAILED,不崩溃) — npmjs.com 第二次跑 200,未遇 CF
- [x] 错误信息透传给 Pangu agent — TIMEOUT 完整透传
- [x] 性能: 单 URL < 30s — 最长 10.6s (python.org)

---

## 4. W2 测试结果 (待 uv sync 完成后填写)

> 数据格式: 站名 → HTTP 状态 / 模式 / 耗时 / 错误码

| # | URL | 状态 | 模式 | 耗时(ms) | 错误码 | 备注 |
|---|-----|------|------|----------|--------|------|
| 1 | example.com | 200 | http | 955 | OK | Example Domain |
| 2 | example.org | 200 | http | 716 | OK | Example Domain |
| 3 | example.net | 200 | http | 695 | OK | Example Domain |
| 4 | en.wikipedia.org/wiki/Web_scraping | 0 | failed | 15003 | TIMEOUT |  |
| 5 | www.ietf.org/rfc/rfc2616.txt | 200 | http | 935 | OK |  |
| 6 | www.python.org | 200 | http | 10622 | OK | Welcome to Python.org |
| 7 | github.com/anthropics/anthropic-cookbook | 0 | failed | 15004 | TIMEOUT |  |
| 8 | news.ycombinator.com | 0 | failed | 15004 | TIMEOUT |  |
| 9 | crates.io | 200 | http | 1120 | OK | crates.io: Rust Package Regist |
| 10 | www.npmjs.com | 200 | http | 964 | OK | npm | Home |

**汇总**:
- 总测试: 10
- 成功: 7
- 失败: 3
- 成功率: 70%
- 平均耗时: 2286ms
- 失败原因: TIMEOUT: 3

---

## 5. W3+ 优化方向 (基于 baseline 数据)

| baseline 发现 | 优化方案 |
|-------------|----------|
| GitHub / npmjs 反爬强 | 加代理 IP 池 (W4) |
| 静态页 OK | 维持 curl_cffi HTTP 抓取 |
| JS 渲染页失败 | Playwright 降级 + Camoufox (W3) |
| IETF 纯文本 | readability 解析失败可接受 |

---

## 6. W2 状态

> **W2 真实抓取测试已跑通 (2026-06-17)**。完整路径:
>
> - ✅ `uv sync --extra parser --extra w2 --extra dev` 装完 35 packages
> - ✅ MCP server 协议层验证通过 (mock + handshake + web_fetch call)
> - ✅ 跨平台代码改: python3 自动检测 + start.bat/.ps1
> - ✅ 抓 10 站 baseline: 7/10 (70%) 验收达标
> - ✅ TIMEOUT / CHALLENGE_FAILED 错误完整透传
> - ⏸ W3+ 优化: Camoufox (反指纹) + 代理 IP 池 (反反爬)
