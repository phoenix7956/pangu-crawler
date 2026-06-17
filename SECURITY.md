# Security Policy

## 支持的版本

| 版本 | 支持状态 |
|------|----------|
| v0.1.x (latest) | ✅ Active |
| < v0.1 | ❌ End of life |

## 报告漏洞

如果你发现安全漏洞,**请不要在 public Issues 报告**。

请发邮件到:`security@pangu-mcp.example.com`(待替换)

我们会:
1. 24 小时内确认收到
2. 评估严重程度
3. 修复 + 发 CVE (如果需要)
4. 致谢报告者(可选)

## 安全实践

我们遵循:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- 最小权限原则
- 依赖审计 (`pnpm audit` + `pip-audit`)
- 不在代码中硬编码 secrets

## 已知安全问题

无。
