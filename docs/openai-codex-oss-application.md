# OpenAI Codex for Open Source — 申请材料（dsh-task-notify）

> 提交入口：<https://openai.com/form/codex-for-oss/>（表单为 500 字符限制的英文文案）。
> 本文件是申请底稿，正式提交前请逐项核实、替换真实数据。

## 提交前 checklist

- [ ] CI 已就绪（`.github/workflows/ci.yml`）且 badge 变绿
- [ ] 已创建 GitHub Release `v0.1.0`（见 `CHANGELOG.md`）
- [ ] README 已重构：英文主版 `README.md` + 中文副版 `README.zh-CN.md`
- [ ] Demo GIF 已放入 `docs/` 并替换 README 中的占位图
- [ ] npm 已发布（可选，发布后才有 version/downloads badge）
- [ ] 所有数字（stars / downloads / users 等）均已核实，不虚报

## 1. Role（你是谁）

**Primary maintainer**

> 与当前 GitHub commit history 一致（主要由本人维护）。若后续有多位核心维护者，可改填 Core maintainer。

## 2. Why does this repository qualify?（≤500 字符）

```text
This project provides task-lifecycle notifications for AI coding agents, addressing a common usability gap in long-running agent workflows: users need immediate feedback when an agent completes, fails, or requires human intervention. It is an open-source DeepSeek Harness plugin with OS notifications, in-page alerts, background-job tracking, approval/question detection, and failure detection. The project is actively maintained and designed to evolve toward broader AI coding-agent support.
```

字符数：**492 / 500** ✔

## 3. How will you use API credits?（≤500 字符）

```text
I would use the API credits for core open-source maintenance: AI-assisted code review, regression-test generation, issue triage, documentation, release automation, and compatibility development for additional AI coding-agent environments. The goal is to reduce maintainer overhead while improving reliability and expanding the project from a DeepSeek Harness plugin toward a reusable agent-lifecycle notification layer.
```

字符数：**419 / 500** ✔

## 4. Anything else we should know?（可选，≤500 字符）

```text
AI coding agents increasingly run long-lived autonomous tasks, making human attention management an important usability layer. This project focuses on that missing interaction layer rather than on another agent implementation. The architecture intentionally separates lifecycle detection from notification delivery, with the goal of supporting multiple coding-agent hosts over time.
```

字符数：**382 / 500** ✔

## 5. Codex Security 是否勾选？

**建议：暂不勾选。**

理由：本项目无服务器、无数据库、无复杂网络接口、无认证系统、无敏感数据处理，核心是客户端通知。**API credits 应勾选**；Codex Security 目前没有必要，不要为了拿更多资源而全选。

## 6. 诚信红线（务必遵守）

- 不要声称 monthly downloads，除非 npm 后台有真实数字。
- 不要写 "compatible with Codex" 或 "Codex notification plugin"，除非真的实现了 Codex 集成；"inspired by Codex UX" 是安全的。
- 不要夸大 stars / adoption。当前 7 stars 本身不是优势，走「生态价值 + 实际功能 + 开源状态 + 持续维护」路线。
- DSH 插件目录收录可作为 **ecosystem relevance** 佐证，但「被收录 ≠ 被广泛采用」，不能冒充 usage。

## 7. 申请入口与优先级

1. **Codex for Open Source**（第一优先）：<https://openai.com/form/codex-for-oss/>
2. **Codex Open Source Fund**（第二优先，单个项目 up to $25,000 API credits，内容不要照抄上面）：<https://openai.com/form/codex-open-source-fund/>
