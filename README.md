# dsh-task-notify

DeepSeek Harness (DSH) Web 的任务完成提醒插件。任务完成、需要审核、失败时都会弹提醒；
默认同时发送**系统通知**（OS notification，像 Codex 那样）和页面右下角 toast，可选提示音。

## 功能

- 对话任务完成提醒（agent 一轮 turn 结束）
- 后台任务完成提醒（后台命令 / 子代理作业结束）
- 需要审核时提醒（审批 / 计划评审 / 提问）
- 失败提醒（对话报错 / 后台任务失败或被终止）
- 通知方式：浏览器系统通知 + 页面 toast + 可选提示音

## 安装

```sh
# 前提：先装 pnpm
npm i -g pnpm

dsh plugin --profile web add git+https://github.com/ltao0829/dsh-task-notify.git
```

安装后重启 `dsh web`，刷新页面。

首次在页面里点击/按键时，浏览器会请求「通知」权限，点允许即可收到系统通知。

> 网络提示：git 安装需要能直连 github.com（国内可能需要代理）；发布到 npm 后可用
> `dsh plugin --profile web add @linxin666/dsh-task-notify`，走 npm CDN 通常更稳。

## 配置

设置里的「插件」配置区会出现「任务完成提醒」卡片（本地存储，无需额外授权）：

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| 启用提醒 | 开 | 总开关 |
| 对话任务完成提醒 | 开 | agent 一轮任务结束时提醒 |
| 后台任务完成提醒 | 开 | 后台命令 / 子代理作业结束时提醒 |
| 需要审核时提醒 | 开 | 运行中等待审批 / 计划评审 / 提问时提醒 |
| 失败时提醒 | 开 | 对话报错 / 后台任务失败或被终止时提醒 |
| 浏览器系统通知 | 开 | 发送操作系统通知（需授权） |
| 提示音 | 关 | 额外播放提示音 |

## 实现说明

- 纯客户端监听：订阅 `ctx.sessions.list`，对相邻两次快照做 diff，检测 turn 完成、
  job 完成、pendingInteraction（需要审核）与 lastAgentError（失败）。
- 首次快照只建立基线，刷新不会为历史任务补发提醒。
- 设置用 localStorage 存储（键 `dsh.taskNotify.v1`），不依赖 settings 命名空间。
- 检测逻辑（`src/detect.ts`）为纯函数，可直接单测。

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```
