# 贡献指南

欢迎为 **pangu-crawler** 做出贡献! 🎉

本文档说明如何参与这个项目:提交 bug 报告、提 feature、实现代码、改进文档。

## 📜 行为准则

- 🤝 尊重所有贡献者
- 💡 建设性讨论
- 🚫 不接受骚扰 / 歧视 / 不当言论
- ✅ 以"对项目最有帮助"的方式工作

## 🐛 报告 Bug

1. 先搜 [Issues](https://github.com/Pangu-MCP/pangu-crawler/issues) 看有没有重复
2. 没重复 → 新建 issue,选 **Bug report** 模板
3. 填写:复现步骤 / 期望 / 实际 / 环境(macOS/Linux/Windows + Node + Python 版本)

## 💡 提 Feature

1. 搜 Issues 看有没有人提过
2. 新建 issue,选 **Feature request** 模板
3. 说明:动机(use case) / 提议方案 / 替代方案

## 🔧 提交 PR

### 1. Fork + Clone

```bash
git clone https://github.com/<your-name>/pangu-crawler.git
cd pangu-crawler
```

### 2. 创建分支

```bash
git checkout -b feature/awesome-thing
# 或 fix/bug-name
```

### 3. 开发

- 改代码
- **加测试**(覆盖率不掉到 80% 以下)
- 更新文档(`docs/DEV.md` v0.x)
- 跑测试:
  ```bash
  cd mcp-server && pnpm test
  cd ../crawler-core && uv run pytest
  ```

### 4. Commit

Conventional Commits 格式:

```bash
git commit -m "feat: add new tool for X"
git commit -m "fix: resolve Y bug"
git commit -m "docs: update DEV.md for Z"
git commit -m "test: add coverage for W"
```

类型:`feat` / `fix` / `docs` / `test` / `refactor` / `chore` / `perf`。

### 5. Push + PR

```bash
git push origin feature/awesome-thing
```

然后在 GitHub 上提 PR。

### 6. PR 模板

```markdown
## 描述
简述改了什么

## 动机
为什么需要这个改动

## 改动清单
- [ ] 改 A 文件
- [ ] 加 B 测试
- [ ] 更新 C 文档

## 测试
- [ ] 跑 `pnpm test` 全过
- [ ] 跑 `uv run pytest` 全过
- [ ] 跑 `test_fetch.py` (如果改了抓取逻辑)

## 关联 Issue
Closes #xxx
```

## 📋 代码风格

### JavaScript / TypeScript

- TypeScript strict mode
- 2 空格缩进
- 单引号
- 分号必加
- ESLint + Prettier(可选)

### Python

- Python 3.11+ syntax
- 4 空格缩进
- 双引号
- ruff 格式化(可选)
- 文档字符串用 `"""..."""`

### 文档

- Markdown
- 中文 / 英文混排,关键术语用英文
- 代码块标注语言
- 表格对齐

## 🔍 评审标准

PR 通过条件:

- [ ] CI 全过(vitest + pytest)
- [ ] 至少 1 个 reviewer approve
- [ ] 无未解决的 review comments
- [ ] commit message 符合 Conventional Commits
- [ ] 文档同步更新

## 🚀 发布流程

(给 maintainer 看)

1. 合并 PR 到 `main`
2. 更新 `package.json` / `pyproject.toml` 版本号
3. 更新 `docs/DEV.md` 版本表
4. 打 GitHub Release + tag
5. (如果发布到 npm/PyPI) `pnpm publish` / `uv publish`

## 📞 联系方式

- GitHub Issues: 优先
- 邮箱: `pangu-mcp@example.com` (待填)
- 微信群: 暂未建立

---

谢谢你的贡献! 💪
