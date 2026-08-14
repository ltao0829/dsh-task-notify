# dsh-task-notify

DeepSeek Harness (DSH) Web 的任务完成提醒插件：当一轮对话任务（agent turn）或
一个后台作业（后台命令 / 子代理）结束时，弹提醒。默认同时发送**系统通知**
（OS notification，像 Codex 那样）和页面右下角 toast，可选提示音。

## 安装

```sh
dsh plugin --profile web add git+https://github.com/ltao0829/dsh-plugin.git
# 或本地开发：
dsh plugin --profile web add link:/path/to/dsh-plugin
```

安装后重启 `dsh web`，刷新页面。

首次在页面里点击/按键时，浏览器会请求「通知」权限，点允许即可收到系统通知。

## 配置

设置 → 展开「Web UI 插件」分组 → 「任务完成提醒」卡片（本地存储，无需额外授权）：

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| 启用提醒 | 开 | 总开关 |
| 对话任务完成提醒 | 开 | agent 一轮任务结束时提醒 |
| 后台任务完成提醒 | 开 | 后台命令 / 子代理作业结束时提醒 |
| 浏览器系统通知 | 开 | 发送操作系统通知（需授权） |
| 提示音 | 关 | 额外播放提示音 |

## 实现说明

- 纯客户端监听：浏览器半订阅 `ctx.sessions.list`，对相邻两次快照做 diff，
  检测 `running: true -> false`（turn 完成）与
  `running/stopping -> completed/failed/killed`（job 完成）。
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
