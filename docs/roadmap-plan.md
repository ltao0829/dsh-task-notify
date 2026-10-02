# dsh-task-notify 任务规划书

> **状态**：草案 · 2026-10-02
> **基线**：`@ltao0829/dsh-task-notify@0.2.0`（`main` 分支）
> **范围**：`README.md` → Roadmap 中尚未实现的 8 项（近期 5 项 + 长期 3 项）
> **真源约定**：路线图的唯一真源是 `README.md`；`CHANGELOG.md` 只记录已交付内容。本文件是路线图的展开，不新增路线图条目——若两者冲突，以 `README.md` 为准，并回来修正本文件。

---

## 1. 总体判断

8 项未完成的工作，实际难度分布极不均匀，可以粗分为三类：

| 类别 | 条目 | 特征 |
| :--- | :--- | :--- |
| **低成本、当天可交付** | T1 演示录屏、T2 下载量跟踪、T5 覆盖率度量 | 不碰插件运行时逻辑，风险接近于零 |
| **功能增量、边界清晰** | T4 通知自定义 | 只动浏览器半部，有既有模式可循 |
| **架构级、需先定方案** | T3 跨平台通知后端、T6 生命周期 API、T8 可复用通知核心、T7 更多适配器 | 会改变插件的定位（宿主半部从"惰性锚点"变为有状态），且存在"过早抽象"风险 |

关键结论：**T3 与 T8 应当合并规划**。T3 必然要在通知层引入"第二个通道"，那正是抽取通道接口的最佳时机；反过来先做 T8，接口只能凭空设计。同理，**T7 必须等 T6 完成且拿到真实宿主需求后再启动**，否则是在为不存在的需求设计适配器。

---

## 2. 技术约束（动手前必读）

以下约束来自仓库现有代码与 CI，不是建议，是硬性边界。

### 2.1 客户端产物只能引用 9 个平台模块

`build/platform-modules.json` 是 DSH 0.2 的冻结模块表，客户端 bundle 只允许 `require` 这些 id：

```text
react · react/jsx-runtime · react-dom · react-dom/client · @deepseek-ai/cordis
@deepseek-ai/dsh-client-store · @deepseek-ai/dsh-client-ui-slots
@deepseek-ai/dsh-client-ui-primitives · @deepseek-ai/dsh-client-ui-dockkit
```

`tests/bundle.spec.ts` 会对**实际产出的 `lib/client.js`** 逐条断言。表中没有的模块，一旦被 require，浏览器 bootstrap 阶段就会抛错，而源码层面完全看不出来。

**影响**：T4 的 UI 扩展只能用 React + 自研代码实现，不能引入新的 DSH 客户端组件库。若确实需要表外模块，流程是先改 `build/platform-modules.json`，再确认 DSH 运行时的冻结表是否同步——这不是插件单方面能决定的。

### 2.2 新增 DSH peer 必须与 `engines.dsh` 字符串完全相同

`scripts/check-package.cjs` 会逐条比对：任何 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 `peerDependencies`，其范围字符串必须与 `engines.dsh` **完全相等**（不是语义等价，是字符串相等）。此外该脚本还会拒绝重新出现的 `dsh.compatibility` 字段。

**影响**：T3 若引入新的 DSH 包，必须同步改 `engines.dsh` 与全部既有 peer 字符串，`tests/manifest.spec.ts` 也会一起卡。

### 2.3 `lib/` 是提交进仓库的

源码改动后必须把重新构建的 `lib/` 一并提交，且 CI 的顺序是 **build 在 test 之前**（`tests/bundle.spec.ts` 断言的是构建产物）。任何"只提交源码"的 PR 都会让 CI 的断言落空。

### 2.4 宿主半部当前是惰性锚点

`src/index.ts` 现在只是一个 loader anchor，不持有状态、没有 `Config` schema（`schemastery` 依赖已在 0.2.0 移除）。**T3 会打破这个定位**，这是本规划中唯一一处"改变插件架构性质"的改动，需要单独评审。

### 2.5 设置存储的版本化先例

设置存于 `localStorage` 的 `dsh.taskNotify.v2`。`src/client/settings.ts` 的注释写明了升级理由：新增字段时**升 key**（v2 → v3），让旧记录从干净默认值开始，而不是静默继承新默认值。T4 新增字段时可选两条路——沿用"重新开始"策略，或写一次显式迁移；无论选哪条都要在 CHANGELOG 说明，因为前者会让用户丢掉已有关闭的开关。

### 2.6 词典的编译期约束

`src/client/locales.ts` 中 `zh` 是 key 集合的唯一真源，`en` 用 `satisfies Record<SettingsCardKey, string>` 约束。**给 `zh` 加一个 key，`en` 不补就编译失败**——这是好事，T4 新增文案时不需要额外纪律。

### 2.7 隐私承诺是硬约束

README 明确承诺"无遥测、无分析、无追踪、不上传对话内容"。任何采用度统计都不得引入客户端上报；T2 因此只能走 npm 公共统计 API。

---

## 3. 任务清单

### T1 · 演示录屏（近期）

| 项 | 内容 |
| :--- | :--- |
| **目标** | README 首屏有三个可播放的 GIF，替换当前的"文件名占位"表格 |
| **交付物** | `docs/demo-turn.gif`、`docs/demo-review.gif`、`docs/demo-failure.gif`；两份 README 的表格换回 `<img>` 写法 |
| **前置** | 本机环境已就绪：DSH 桌面端 `0.2.0-rc.2` + 插件 `0.2.0` 已激活（宿主行与 `settings.plugins.tab` 占用均已确认 active） |
| **步骤** | 按 `docs/demo-guide.md` 的三个场景各录一条：① 任务完成 ② 需要审核 ③ 后台任务失败 |
| **验收** | 三个文件均 ≤ 3 MB；GitHub 页面三图正常渲染；中英两份 README 表格写法一致 |
| **风险 / 阻塞** | **必须人工操作，无法自动化**——需要真实任务触发事件、需要录屏时通知弹窗入镜、需要在页面里点一次以授予通知权限 |
| **估算** | 1–2 小时（含剪辑与体积压缩） |

### T2 · npm 下载量 / 采用度跟踪（近期）

| 项 | 内容 |
| :--- | :--- |
| **目标** | README 展示下载量；可选地定期记录趋势 |
| **方案 A（首选）** | 加 shields.io 徽章 `https://img.shields.io/npm/dm/@ltao0829/dsh-task-notify`。零后端、零遥测，只用 npm 公共统计 |
| **方案 B（进阶）** | `.github/workflows/adoption.yml` 每周调用 `https://api.npmjs.org/downloads/point/last-week/<pkg>`，把结果追加到 `docs/adoption.md` 并提交 |
| **口径说明** | npm downloads 统计的是 **tarball 下载次数**，不等于活跃用户数（含 CI 拉取、镜像同步）。写进文档时必须标注口径，避免夸大 |
| **验收** | 徽章正常显示；若做方案 B，连续两周有数据提交，且该 workflow 失败不阻塞主 CI |
| **估算** | 方案 A：0.5 小时；方案 B：半天 |
| **状态** | **方案 A 已交付（2026-10-02）**——徽章已加入两份 README，口径说明随 CHANGELOG `[Unreleased]` 记录，发版时随对应版本归档。据此 README 路线图已拆成两条：「npm 下载量徽章」已勾选，「采用度趋势跟踪（周度下载量变化）」保持未勾选——方案 B 尚未启动 |

### T3 · 跨平台通知后端（近期，架构级）

| 项 | 内容 |
| :--- | :--- |
| **现状** | `dsh.client.platform` 为 `web`；通知只有浏览器 `Notification` 一条路径（`src/client/notify.ts`） |
| **"跨平台"的三种解读** | a. 宿主侧发送原生通知（页面关闭/未聚焦也能收到）<br>b. 覆盖 DSH 未来的非 Web 前端<br>c. 多浏览器引擎兼容（Firefox/Safari 差异、Windows 专注助手压制） |
| **建议** | 选 **a**。本插件的立身之本就是"用户切走了"，而浏览器通知在窗口完全最小化、被专注助手压制、或页面被关闭时恰恰失效——这是当前实现最大的能力缺口 |
| **步骤** | ① 预研：用 `cordis_inspect_list` / `cordis_inspect_query` 查 DSH 0.2 是否提供宿主侧通知座位（Service 或 Event）<br>② 选定通道：Electron `Notification` / `node-notifier` / 平台 CLI<br>③ 宿主半部实现，并**做去重**——同一事件不能让浏览器通道和宿主通道各弹一次<br>④ 新增设置项（如"桌面端原生通知"）<br>⑤ 补测试并跑 `pnpm run verify:profile` |
| **验收** | 撤销浏览器通知权限后仍能收到系统通知；双通道场景下不重复提醒；`verify:profile` 仍全绿 |
| **风险** | **高**。引入新运行时依赖；平台差异；`src/index.ts` 从锚点变为状态持有者（见 §2.4）；若引入新 DSH 包，需按 §2.2 同步全部 peer 字符串 |
| **估算** | 3–5 天 |

### T4 · 通知自定义（近期）

| 项 | 内容 |
| :--- | :--- |
| **目标** | 从"8 个布尔开关"升级为可配置 |
| **建议范围（按价值排序）** | ① 自定义标题/正文模板，支持 `{title}` `{session}` `{kind}` 占位<br>② 提示音选择（无 / 双音 / 单音 / 自定义 URL）与音量<br>③ toast 位置（四角）与停留时长<br>④ 免打扰（按会话静音、按时间段静音） |
| **涉及文件** | `src/client/settings.ts`（扩展字段 + 升 key，见 §2.5）、`src/client/locales.ts`（`zh` 先加 key）、`src/client/TaskNotifySettingsCard.tsx`（表单）、`src/client/notify.ts`（模板插值、音量、位置、时长） |
| **注意** | 卡片只能 require 冻结表内的模块（§2.1）；模板插值需防注入——用 `textContent` 而非 `innerHTML`（现有 toast 已是这么做的，保持一致） |
| **验收** | `tests/config.spec.ts` 覆盖新默认值与迁移；`tests/notification.spec.ts` 覆盖模板渲染与降级；`pnpm test` 全绿 |
| **估算** | 2–3 天 |
| **状态** | **已交付（建议范围 ①②③④ 全部，2026-10-02）**——设置存储升 key 至 `dsh.taskNotify.v3`（显式迁移：v2 开关全保留，旧 `sound` 布尔映射为双音模式，迁移后移除 v2 键；加载时逐字段清理与钳制）；标题/正文模板（`{title}`/`{session}`/`{kind}`，空 = 内置文案，`textContent` 渲染防注入）；提示音四选一 + 音量 + 自定义 URL（空 URL 回退双音）；toast 四角 + 3–15 秒时长；免打扰时段（支持跨零点）+ 按会话静音。新增 `tests/settings-card.spec.tsx` 真实渲染卡片后，卡片覆盖从 15% 升至 92.5%。发版时随对应版本归档 |

### T5 · 测试覆盖率度量与提升（近期）

| 项 | 内容 |
| :--- | :--- |
| **目标** | 先把"覆盖率"变成可测量的数字，再谈提升 |
| **现状** | 起点为 8 个套件 / 63 个用例，`vitest.config.ts` 无 `coverage` 配置，`package.json` 无脚本、无阈值；接入后为 9 个套件 / 97 个用例（`1 skipped` 见下方澄清） |
| **澄清** | 测试输出里的 `1 skipped` **不是被禁用的用例**，而是 `tests/bundle.spec.ts` 中 `describe.skipIf(!built)` 与 `describe.skipIf(built)` 的配对：构建产物存在时跑真实断言，不存在时跑占位套件 |
| **步骤** | ① 加 `@vitest/coverage-v8`<br>② `vitest.config.ts` 增 `coverage: { provider: 'v8', reporter: ['text','lcov'], include: ['src/**'], thresholds: {...} }`<br>③ `package.json` 增 `"coverage": "vitest run --coverage"`<br>④ CI 中在 **build 之后**运行并把 `lcov` 作为 artifact 上传<br>⑤ 阈值以"当前实测值向下取整"起步，此后只允许升 |
| **验收** | `pnpm run coverage` 有数字产出；CI 上传 artifact；阈值能卡住回退 |
| **估算** | 度量落地：半天；补测达到合理阈值：另 1–2 天 |
| **状态** | **度量落地已交付（2026-10-02）**——`@vitest/coverage-v8`（锁定与 vitest 相同版本）+ `pnpm run coverage` + 全局阈值 **77/68/90/81**（按当前实测值留约 1 pp 余量，只允许升）+ CI 覆盖率步骤（build 之后）与 lcov artifact 上传。实测全局：语句 **78.6%** / 分支 **69.85%** / 函数 **91.35%** / 行 **82.3%**。阈值最初按接入卡片测试**之前**的基线定为 69/56/77/73，比实测低 9–14 pp，已收紧。补测提升仍待推进，真正的洼地是 `src/client/index.ts`（语句 69.76% / 分支 44.44%）与 `src/client/notify.ts`（70.58%）；`TaskNotifySettingsCard.tsx` 已达 92.5%，README 路线图据此拆出「提升监听器与通知渲染器的覆盖率」一条 |

### T6 · 与宿主无关的生命周期 API（长期）

| 项 | 内容 |
| :--- | :--- |
| **现状评估（重要）** | 这项工作**已有一半基础**：`src/detect.ts` 的 `SnapshotView` / `SessionRowView` / `JobRowView` / `CompletionEvent` 都是自有类型，`diffCompletions()` 是纯函数。唯一耦合点是 `toSnapshotView()` 的三个入参（`SessionListState` / `SessionStatusSnapshot` / `JobsSnapshot`）与两处 DSH 类型别名。所以这是"改造"，不是"从零做" |
| **T6a（低成本，建议先做）** | 清掉 `detect.ts` 里剩余的 DSH 专有类型引用（`JobStatus` 改为自有联合类型，映射下沉到适配器）；在 `package.json` 的 `exports` 增加 `./detect` 子路径，把纯核作为稳定 API 导出；补契约用例 |
| **T6b（高成本，建议暂缓）** | 把 `toSnapshotView()` 挪进 `src/adapters/dsh.ts`，定义 `interface SnapshotProvider { snapshot(): SnapshotView }`，形成"一个宿主一个适配器"的目录结构 |
| **风险** | **过早抽象**。当前只有一个宿主，凭想象设计的接口在第二个宿主出现时大概率要推倒重来 |
| **验收** | T6a 完成后，`lib/types/detect.d.ts` 不再引用任何 DSH 类型（可用一条测试断言、而不是靠自觉） |
| **估算** | T6a：0.5–1 天；T6b：3–5 天 |

### T7 · 更多编程代理适配器（长期）

| 项 | 内容 |
| :--- | :--- |
| **前置** | T6b 完成，且拿到**真实**的目标宿主需求 |
| **现实评估** | Claude Code / Codex / OpenCode 的生命周期数据都不是现成可读的：需要各自的 hook、日志或进程探测，单个宿主的对接工作量与不确定性都高于本插件当前全部代码之和 |
| **建议** | **在出现真实需求方之前不启动。** 若必须做，先做一个"最小可用探测"（例如仅从 Claude Code 的 hook 判定 turn 结束），用它来验证 T6b 的适配器接口是否站得住，再决定是否铺开 |
| **估算** | 每个宿主 1–2 周起，不确定性高 |

### T8 · 可复用通知核心（长期）

| 项 | 内容 |
| :--- | :--- |
| **现状** | `src/client/notify.ts` 直接操作 `document.body`、`Notification`、`AudioContext`，无注入点 |
| **目标** | 把"通道"变成可替换实现，宿主可提供自己的通道 |
| **建议** | **与 T3 合并规划**。T3 必然引入第二个通道（宿主侧原生通知），那正是抽接口的时机；先于 T3 单独做，只能凭空设计 |
| **形态** | `notify.ts` 不再直接引用全局对象，改为 `Channel` 接口 + `toast` / `browser` / `sound` 三个内置实现 + 宿主注入实现 |
| **验收** | 现有 `tests/notification.spec.ts`（jsdom）继续覆盖三个内置通道；新增一个假通道验证注入路径 |
| **估算** | 2–3 天；若与 T3 合并，边际成本更低 |

---

## 4. 依赖关系与建议顺序

```text
第一阶段 · 零风险、当天见效
  T1 演示录屏（人工）
  T2 下载量徽章
  T5 覆盖率度量
  └─ 文档与真源对齐（本轮已完成）

第二阶段 · 用户可感知的功能
  T4 通知自定义 ──► 发 0.3.0

第三阶段 · 架构（先定方案再动代码）
  T6a 纯核导出（低风险，可提前）
  T3 跨平台通知后端 ┐
                    ├─ 合并设计：T3 引入第二通道 → 顺势抽 T8 接口 ──► 发 0.4.0
  T8 通道抽象       ┘

暂缓（等真实需求）
  T6b 适配器目录结构
  T7 其他编程代理适配器（依赖 T6b）
```

依赖要点：

- **T7 依赖 T6b**；T6b 又依赖"第二个宿主真实存在"。因此 T6b 与 T7 是一个整体，不应拆开排期。
- **T3 与 T8 互为前提**，合并做一个迭代比分开做两次更省。
- **T6a 不依赖任何东西**，可以随时插入，且能顺手降低 T3 的改动面。
- T1/T2/T5 之间无依赖，可并行。

---

## 5. 版本计划

| 版本 | 类型 | 内容 | 触发条件 |
| :--- | :--- | :--- | :--- |
| `0.2.1` | patch | 文档对齐 + 覆盖率工具链（若判定 devDependency 变更不需要独立版本，可并入下一个 minor） | 第一阶段完成 |
| `0.3.0` | minor | 通知自定义（T4） | 第二阶段完成 |
| `0.4.0` | minor | 宿主侧原生通知通道 + 通道抽象（T3 + T8） | 第三阶段完成 |
| 待定 | — | 生命周期纯核是否拆为独立包 | T6b/T7 启动时再评估 |

注意：`0.2.0` 是一次破坏性重新定位，`0.3.0` 起应回归常规语义化版本节奏——**新增功能走 minor，不新增 peer 依赖**，避免再次触发用户侧的版本配对问题（见 README 的版本配对说明）。

---

## 6. 明确建议暂缓的部分

| 条目 | 暂缓理由 |
| :--- | :--- |
| T6b 适配器目录结构 | 单宿主下是过早抽象；接口会在第二个宿主出现时重做 |
| T7 其他编程代理适配器 | 依赖 T6b，且没有真实需求方；单宿主对接成本远高于预期收益 |
| 在客户端引入任何表外 DSH 模块 | 会撞上 §2.1 的冻结模块表，且需 DSH 侧配合 |

---

## 7. 全局验收标准

每个任务在合并前都必须满足以下 5 条，缺一不可：

1. `pnpm run typecheck`、`pnpm test`、`pnpm run build` 全绿，且**重新构建的 `lib/` 一并提交**（§2.3）；
2. `node scripts/check-package.cjs` 通过——新增 DSH peer 时必须与 `engines.dsh` 字符串同串（§2.2）；
3. `pnpm run verify:profile` 在隔离 `DSH_HOME` 中走完"打包 → 安装 → 配置合成 → 启动监听 → 卸载"全流程；
4. 产出的 `lib/client.js` 只 require `build/platform-modules.json` 冻结表内的模块（§2.1）；
5. 两份 README 与 CHANGELOG 同步更新，中英保持对等；路线图条目状态随之勾选。

---

## 附：本规划书的维护约定

- 路线图条目**增删改**只发生在 `README.md`，本文件随之更新对应小节；
- 某个任务**交付后**，从 `README.md` 勾掉、把事实写进 `CHANGELOG.md` 的 `[Unreleased]`，并在本文件该任务上标注完成版本号；
- 本文件不引入 README 之外的路线图条目。
