# dsh-task-notify

**AI 编程代理的任务生命周期通知层 —— 当前支持 DeepSeek Harness（DSH）。**

[![CI](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](./LICENSE)

AI 编程代理越来越多地运行长时间、自主的任务：一轮任务可能持续数分钟，而用户通常已经切到别的窗口。本项目在代理任务生命周期之上补上了缺失的**通知层**：当代理**完成**、**失败**、**后台任务结束**、或开始**等待人工介入**（审批 / 计划评审 / 提问）时，立即通过页面 toast、操作系统级桌面通知以及可选提示音提醒你。

> **借鉴 Codex 的桌面通知体验，而不是 Codex 集成。** 目前本项目以 DeepSeek Harness（DSH）插件形式发布；其生命周期检测核心与宿主无关，设计目标是逐步演进为支持更多编程代理的适配器。

## 为什么需要它

长任务代理反转了传统注意力模型：用户提交任务后就会切走，而不是盯着终端。纯 UI 状态提示（后台标签页里的一个 spinner）恰恰在关键时刻失效——用户没有在看。`dsh-task-notify` 把生命周期变化转化为可打断的、系统级的信号，闭合自主代理与分心用户之间的反馈环。

## 演示

> 占位 —— 请替换为 10–30 秒的 GIF/MP4 录屏，录制方法见 [`docs/demo-guide.md`](./docs/demo-guide.md)。

| 任务完成 | 需要审核 | 后台任务失败 |
| --- | --- | --- |
| ![任务完成](docs/demo-turn.gif) | ![需要审核](docs/demo-review.gif) | ![后台任务失败](docs/demo-failure.gif) |

## 功能

- **对话任务完成提醒** —— 助手一轮任务（思考或工具调用）结束时提醒。
- **后台任务完成提醒** —— 后台命令或子代理作业结束时提醒（`completed` / `failed` / `killed`）。
- **需要审核提醒** —— 运行中等待审批 / 计划评审 / 回答提问时提醒。
- **失败提醒** —— 对话任务报错或后台任务失败 / 被终止时提醒。
- **三种通知通道** —— 浏览器系统通知 + 页面 toast + 可选双音提示音。
- **逐项开关** —— 每类事件和每种通道均可独立开关。

## 安装

前置：先安装 [Node.js](https://nodejs.org) 和 [pnpm](https://pnpm.io)。

```sh
# 从 Git 安装
dsh plugin --profile web add git+https://github.com/ltao0829/dsh-task-notify.git

# 发布到 npm 后（推荐，走 CDN 更稳）
dsh plugin --profile web add @ltao0829/dsh-task-notify
```

重启 `dsh web` 并刷新页面。首次在页面里点击/按键时，浏览器会请求「通知」权限，点允许即可收到系统通知。

## 配置

设置界面「插件」区会出现「任务完成提醒」卡片，配置存于 `localStorage`（键 `dsh.taskNotify.v1`）：

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| 启用提醒 | 开 | 总开关 |
| 对话任务完成提醒 | 开 | 助手一轮任务结束时提醒 |
| 后台任务完成提醒 | 开 | 后台命令 / 子代理作业结束时提醒 |
| 需要审核时提醒 | 开 | 运行中等待审批 / 计划评审 / 提问时提醒 |
| 失败时提醒 | 开 | 对话任务报错或后台任务失败 / 被终止时提醒 |
| 浏览器系统通知 | 开 | 同时发送操作系统通知（需授权） |
| 提示音 | 关 | 同时播放提示音 |

## 工作原理

监听器订阅 DSH 会话列表 store，对相邻两次快照做 diff。检测逻辑是**纯函数**（`src/detect.ts`）：把快照映射为最小视图并产出生命周期事件，通知分发器再把事件路由到已开启的通道。

```text
sessions store:  快照 N-1 ──┐
                            ├── diff ──► 生命周期事件
sessions store:  快照 N   ──┘            turn | job | review | failure
                                                  │
                                          通知分发器
                                    ┌──────────┬──────────┐
                                    ▼          ▼          ▼
                                  toast   系统通知      提示音
```

- **首个快照只建立基线** —— 刷新页面不会为历史任务补发提醒。
- `src/detect.ts` 与宿主无关（纯数据进 / 纯数据出），可独立单测。

## 项目结构

```text
src/index.ts                         宿主半部 —— 注册设置区
src/detect.ts                        纯生命周期检测器（快照 diff）
src/client/index.ts                  浏览器半部 —— 监听器 + 失败监听器
src/client/notify.ts                 toast / 系统通知 / 提示音
src/client/settings.ts               localStorage 设置存储
src/client/TaskNotifySettingsCard.tsx 设置卡片
tests/detect.spec.ts                 检测器单元测试
```

## 安全与隐私

- 无外部服务器，无云后端。
- 无遥测、无分析、无追踪。
- 无需 API 密钥。
- 通知全部在**浏览器本地**生成。
- 设置仅保存在本地 `localStorage`。
- 插件**不会上传或外传对话内容**。

与其他 DSH 插件一样，插件以你 DSH 进程的权限运行。

## 路线图

- [x] 对话任务完成通知
- [x] 后台任务通知
- [x] 审批 / 计划评审 / 提问通知
- [x] 失败通知
- [x] 系统通知 + toast + 提示音
- [ ] npm 正式发布与下载量数据
- [ ] 宿主无关的生命周期接口（把检测核心与 DSH 适配器解耦）
- [ ] 更多编程代理适配器（Claude Code、Codex、OpenCode……）
- [ ] 跨平台通知后端

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## License

[BSD-3-Clause](./LICENSE)
