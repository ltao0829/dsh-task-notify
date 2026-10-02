# dsh-task-notify

**AI 编程代理的生命周期通知层，当前支持 DeepSeek Harness。**

[![CI](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](./LICENSE)

[English](./README.md) · **简体中文**

AI 编程代理越来越多地运行长时间、自主的任务：一轮任务可能持续数分钟，而用户通常已经切到别的窗口。本项目在代理任务生命周期之上补上了缺失的**通知层**：当代理**完成**、**失败**、**后台任务结束**、或开始**等待人工介入**（审批 / 计划评审 / 提问）时，立即通过页面 toast、操作系统级桌面通知以及可选提示音提醒你。

> **借鉴 Codex 的桌面通知体验，而非 Codex 集成。与 OpenAI 无关联，也不受 OpenAI 赞助。** 目前本项目以 DeepSeek Harness（DSH）插件形式发布；其生命周期检测核心与宿主无关，设计目标是逐步演进为支持更多编程代理的适配器。

## 为什么需要它

长任务代理反转了传统注意力模型：用户提交任务后就会切走，而不是盯着终端。纯 UI 状态提示（后台标签页里的一个 spinner）恰恰在关键时刻失效——用户没有在看。`dsh-task-notify` 把生命周期变化转化为可打断的、系统级的信号，闭合自主代理与分心用户之间的反馈环。

## 演示

> 录屏尚未入库，因此下表只列出三个片段的文件名，而不是直接嵌入图片。录制方案（场景、工具、体积建议）与恢复图片所需的精确写法见 [`docs/demo-guide.md`](./docs/demo-guide.md)。

| 任务完成 | 需要审核 | 后台任务失败 |
| --- | --- | --- |
| `docs/demo-turn.gif` | `docs/demo-review.gif` | `docs/demo-failure.gif` |

## 功能

- **对话任务完成提醒** —— 助手一轮任务（思考或工具调用）结束时提醒。
- **后台任务完成提醒** —— 后台命令或子代理作业结束时提醒（`completed` / `failed` / `killed`）。
- **需要审核提醒** —— 运行中等待审批 / 计划评审 / 回答提问时提醒。
- **失败提醒** —— 对话任务报错或后台任务失败 / 被终止时提醒。
- **三种通知通道** —— 浏览器系统通知 + 页面 toast + 可选双音提示音。
- **逐项开关** —— 每类事件和每种通道均可独立开关。

## 环境要求

| 依赖项 | 说明 |
| --- | --- |
| **DeepSeek Harness** | `0.2.0-rc.2` 或更新的 `0.2.x` —— 兼容性网关读取的是 `peerDependencies`，本包把所有 DSH peer 固定为 `^0.2.0-rc.2` |
| **Node.js** | `>=22.0.0`（CI 覆盖 Node 22 与 24；桌面端内置运行时为 Node 24） |
| **pnpm** | 仅在使用 `dsh plugin` 命令行安装时需要；桌面端使用其内置的 pnpm |

## 安装

```sh
# 从 npm 安装 —— 请写明版本范围，原因见下方冷却期说明
dsh plugin --profile <profile> add @ltao0829/dsh-task-notify@^0.2.0

# 或从 Git 安装，锁定发布标签
dsh plugin --profile <profile> add git+https://github.com/ltao0829/dsh-task-notify.git#v0.2.0
```

`<profile>` 是要装入的 DSH Profile：`dsh web` 服务器用 `web`，桌面端用 `desktop`。安装会把包写入该 Profile 并注册它的 bundle patch，由后者插入唯一一行 `task-notify`，同时挂载插件的宿主半部与浏览器半部。

在**桌面端**请从应用自身的 **设置 → 插件** 安装。`desktop` Profile 由 Electron 应用独占管理：活动 Profile 的插件变更会立即生效、无需重启，而 `dsh --profile desktop …` 会拒绝在第二个命令行进程里运行该 Profile。

装入 `dsh web` 服务器后，重启服务并刷新页面。首次在页面里点击/按键时，浏览器会请求「通知」权限，点允许即可收到系统通知。

> **版本必须与 DSH 系列对应。** `0.2.x` 需要 **DeepSeek Harness 0.2**；`0.1.x` 需要 DSH 0.1.x。两个系列不能互相通用：DSH 0.2 的兼容性网关会直接拒绝 `0.1.x` 系列，而 DSH 0.1.x 也无法加载 `0.2.x` 系列。
>
> `0.1.x` 系列已**停止维护**。npm 上只有 `0.1.0`；之后的 `0.1.1`、`0.1.2` 修复只存在于 Git 历史中，从未打过标签、也从未发布。如果你仍在 DSH 0.1.x，请先把 DSH 升级到 0.2，再安装 `0.2.x`。

> **为什么要写版本范围而不是裸包名。** pnpm 11 内置了 **24 小时供应链冷却期**（`minimumReleaseAge` 默认为 `24 * 60` 分钟）。发布时间不足一天的版本对版本解析不可见，因此 `dsh plugin add @ltao0829/dsh-task-notify` 会静默解析到**上一个**发布版本，进而被判为不兼容而拒绝。写明版本或范围后，pnpm 会写入 `minimumReleaseAgeExclude` 并立即安装；等发布满一天后，裸包名也会正常解析到最新版。

### 卸载

```sh
dsh plugin --profile <profile> remove @ltao0829/dsh-task-notify
# 桌面端：在「设置 → 插件」中移除
```

这会同时移除包与它的 bundle 条目，`task-notify` 行随即从合成后的 Profile 中消失。浏览器侧的 `localStorage` 记录（`dsh.taskNotify.v2`）不属于 Profile：若希望重装后从默认值开始，请手动清除该键。

## 配置

设置页面位于 DSH 设置界面的**「插件」**区（DSH 0.2 新增的 `settings.plugins.tab` 插槽），页面标题为*任务完成提醒*。配置存于 `localStorage`（键 `dsh.taskNotify.v2`）：

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| 启用提醒 | 开 | 总开关 |
| 对话任务完成提醒 | 开 | 助手一轮任务结束时提醒 |
| 后台任务完成提醒 | 开 | 后台命令 / 子代理作业结束时提醒 |
| 监听全部会话的后台任务 | 关 | 为会话列表中每个会话各开一条后台任务流，而非仅监听本页面打开后活跃过的会话 |
| 需要审核时提醒 | 开 | 运行中等待审批 / 计划评审 / 提问时提醒 |
| 失败时提醒 | 开 | 对话任务报错或后台任务失败 / 被终止时提醒 |
| 浏览器系统通知 | 开 | 同时发送操作系统通知（需授权） |
| 提示音 | 关 | 同时播放提示音 |

页面内 toast 没有开关——它是始终可用的通道，也是系统通知被拒绝、提示音被拦截时的兜底。

## 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 有 toast，但没有系统通知 | `Notification.permission` 不是 `granted`，插件会静默跳过而非报错 | 授予通知权限。浏览器只允许在用户手势中弹窗，因此在页面里点击一次即可；或把**浏览器系统通知**关掉再打开，它会主动请求权限 |
| 没有提示音 | Web Audio 在用户手势之前处于 suspended 状态 | 在页面里点击一次或按一下键盘，音频会在首个手势解锁 |
| 完全没有任何提醒 | 总开关或对应事件开关是关的 | 检查**启用提醒**与各事件开关 |
| 已经跑完的任务没有补发提醒 | 页面加载后的首个快照只建立基线 | 属预期行为——刷新页面不会重放历史 |
| 只对当前在看的会话有后台任务提醒 | 默认只为「本页面打开后被观察到运行过」的会话各开一条 `job.list` 流 | 打开**监听全部会话的后台任务** |
| 任务失败但没有提醒 | `lastAgentError` 只存在于被 retain 的会话 face 上 | 属预期行为——插件覆盖工作区已保持打开的会话，不会为了监听报错而额外 retain 会话 |
| 安装被判为不兼容 | `0.1.x` 插件装在 DSH 0.2 上，或反之 | 让两个系列对应，见[安装](#安装)中的配对说明 |
| 用裸包名装到了旧版本 | pnpm 11 的 24 小时 `minimumReleaseAge` 冷却期 | 写明范围：`@^0.2.0` |

## 架构

```text
              coding agent（编程代理）
                   │
                   ▼
     宿主适配器（当前为 DeepSeek Harness；
                 未来可扩展 Claude Code / Codex / OpenCode）
                   │
                   ▼
     会话快照（N-1 与 N）
                   │
                   ▼
     生命周期检测器 ──►  事件：turn | job | review | failure
                   │
                   ▼
     通知分发器
       │          │          │
       ▼          ▼          ▼
    系统通知     toast      提示音
```

检测器（`src/detect.ts`）是**纯函数**：快照进去，生命周期事件出来。它不依赖 DSH 或 DOM，因此未来支持更多编程代理只需实现新的快照提供者，而无需重写通知核心。

### DSH 0.2 的数据来源

DSH 0.2 移除了原先同时承载 `jobsBySession` 与逐行 `pendingInteraction` 的单一 `sessions.list` store。监听器现在把三个彼此独立的客户端数据源折叠成一份快照：

| 数据源 | 服务 | 提供内容 |
| --- | --- | --- |
| 会话目录 | `ctx.sessions.list` | id、标题、宿主基线的运行标志、引用计数 |
| 客户端状态投影 | `ctx.uiSession.sessionStatus` | 实时的 `running`、待处理交互（`key` + `kind`）、未读完成标记 |
| 后台任务名册 | `ctx.jobs.state` | 每个被监听会话的 `JobView` 行，由每会话一条 `job.list` 流驱动 |

值得注意的行为：

- **首个快照只建立基线** —— 刷新页面不会补发历史提醒；此后才出现的会话或任务名册同样视为既存，不触发提醒。
- 待处理交互以其**不透明请求 key** 追踪：被替换的新请求（审批之后又来一个提问）会再次提醒，而重连时对同一请求的重放不会重复提醒。
- `job.list` 是**按会话**的流。默认只为「本页面打开后被观察到运行过」的会话各开一条；未在此页面运行过的会话，不可能持有本页面正在等待的后台任务。开启「监听全部会话」则改为覆盖整个会话列表，代价是每个会话一条流。
- 对话失败检测读取 `lastAgentError`，而该字段只存在于**被 retain** 的会话 face 上。因此本插件覆盖工作区已经打开的会话，不会为了监听报错而额外 retain 会话。

### 通知通道

toast 直接挂载到 `document.body`，不依赖 React root，也不占用任何插槽，因此在没有对话座位的界面上（未选中会话、设置面板打开等）依然可用。最多同时堆叠 4 条，每条显示 5 秒。系统通知只在权限已是 `granted` 时发送；提示音会先 `resume()` 处于 suspended 状态的 `AudioContext`——每条通道都选择静默降级，而不是抛错。

## 项目结构

```text
src/index.ts                         宿主半部 —— 惰性加载锚点
src/detect.ts                        纯生命周期检测器（三源折叠 + 快照 diff）
src/client/index.ts                  浏览器半部 —— 监听器、后台任务流与失败监听、UI 注册
src/client/notify.ts                 toast / 系统通知 / 提示音
src/client/locales.ts                zh + en 词典与命名空间声明合并
src/client/settings.ts               localStorage 设置存储
src/client/TaskNotifySettingsCard.tsx 设置页面（settings.plugins.tab）
tests/*.spec.ts                      检测器、生命周期、设置、通知、Manifest 与 apply() 测试
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

### 当前阶段

- [x] 对话任务完成通知
- [x] 后台任务通知
- [x] 审批 / 计划评审 / 提问通知
- [x] 失败通知
- [x] 系统通知 + toast + 提示音
- [x] npm 正式发布（`@ltao0829/dsh-task-notify`）
- [x] CI/CD（typecheck + test + build + pack dry-run）

### 近期

- [ ] README 演示录屏
- [ ] npm 下载量 / 采用度跟踪
- [ ] 跨平台通知后端
- [ ] 通知自定义
- [ ] 更完善的测试覆盖

### 长期

- [ ] 与代理无关的生命周期 API
- [ ] 更多编程代理集成（Claude Code、Codex、OpenCode……）
- [ ] 可复用的通知核心

## 相关项目

- [dsh-launcher](https://github.com/ltao0829/dsh-launcher) —— DeepSeek Harness Web 的一键启动器。

两者共同构成一套面向 AI 编程代理工作流的小型工具集。

同一作者的另一个项目：[buaa-auto-auth](https://github.com/ltao0829/buaa-auto-auth) —— 为一台 Windows 机器每天自动完成校园网（SRun）认证。

## 贡献

见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 兼容性与一次性 Profile 验证

- **Node.js**：`>=22.0.0`（CI 矩阵覆盖 Node 22 与 24）
- **DeepSeek Harness**：`^0.2.0-rc.2`

DSH 0.2 已不再读取被废弃的 `dsh.compatibility` 字段。Profile 导入插件前，`evaluatePluginCompatibility`（`@deepseek-ai/dsh-app-boot`）会把插件 `peerDependencies` 中所有 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 项与唯一运行时版本逐一比对，预发布版本参与范围匹配。因此本包把所有 DSH peer 固定为 `^0.2.0-rc.2`，并在 `engines.dsh` 中镜像同一范围；只要有任何一项漂移，`tests/manifest.spec.ts` 就会失败。

> `0.2.0` 是**破坏性的重新定位**，而非增量发布：`0.1.x` 系列基于已被移除的 `@deepseek-ai/dsh-client-runtime` 与 `settings.plugin.item` 插槽构建，这两者在 DSH 0.2 中都不复存在。npm 上只发布过 `0.1.0`；`0.1.1` 与 `0.1.2` 仅存在于 Git 历史中。

### 一次性 Profile 验证命令

在不污染任何现有用户配置（`~/.dsh`）的隔离临时 Profile 中，验证插件安装、配置合成、Web 启动监听与卸载：

```sh
pnpm run verify:profile
```

脚本默认等待 DSH 首次准备 Profile 最多 90 秒。如果 CI Runner 或本机需要调整，可将 `DSH_WEB_START_TIMEOUT_MS` 设置为正整数毫秒值。插件安装另有默认五分钟的等待限制，可通过 `DSH_PLUGIN_INSTALL_TIMEOUT_MS` 调整。

验证日志证据报告：[`docs/verification-evidence.md`](./docs/verification-evidence.md)。

> **限制与边界说明**：Catalog 准入及一次性 Profile 验收证明插件生命周期契约与标准 Web Profile 启动兼容；系统级操作系统通知依然依赖用户在浏览器前端授予通知权限。一次性 Profile 验证会把打包后的 tarball 装入一个临时 `DSH_HOME`，证明插件**被接受并成功加载**；此外构建产物还会被单独校验，确认其外部依赖只包含平台模块。该脚本不驱动真实浏览器，页面内通知行为由 jsdom 测试套件覆盖。

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run verify:profile
```

必须先 `pnpm run build` 再 `pnpm test`：`tests/bundle.spec.ts` 会断言产出的 `lib/client.js` 只 require 冻结的平台模块。`lib/` 是提交进仓库的，因此改动源码后必须把重新构建的产物一并纳入提交。

## License

[BSD-3-Clause](./LICENSE)
