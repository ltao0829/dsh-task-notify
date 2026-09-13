# Issue #802 修复任务书

## 1. 任务背景

DSH STORE 对 `@ltao0829/dsh-task-notify` 的固定 Commit 检查结果显示：当前目录曾以 `0.1.0` 收录，但没有针对官方最新三个 DSH 版本的可安装兼容证据，因此被暂时下架。

当前分支已经提交 `0.1.1` 及 `dsh.compatibility.dshReleases` 声明，但仍需补齐依赖范围和一次性 Profile 验证。

## 2. 任务目标

在默认分支形成一个可被 DSH STORE 自动复检、且实际可安装验证的发布提交：

1. 兼容声明与真实 peer 依赖范围一致。
2. 对官方最新三个 DSH 版本提供逐版本兼容结论。
3. 提供 Node.js、DSH、安装、启动、卸载的可复现证据。
4. 不替换或冒用任何 `@deepseek-ai/*` 包、官方 entry ID 或受保护组件。
5. 通过类型检查、单元测试、构建和发布包检查。

## 3. 工作分解

### P0：修正依赖兼容范围

修改 `package.json` 中所有 `@deepseek-ai/dsh-*` 的 `peerDependencies` 和开发依赖范围，使其覆盖实际支持的 DSH 版本，至少处理：

- `0.1.5-alpha.2`
- `0.1.5-rc.1`
- `0.1.5-rc.2`

不得只修改 `dsh.compatibility.dshReleases` 而保留互相矛盾的 peer 范围。

### P0：保留并审查 Catalog 元数据

确认以下字段存在且语义一致：

- `version` 已递增到新版本。
- `engines.node` 明确声明 Node.js 范围。
- `dsh.compatibility.dsh` 声明 DSH 范围。
- `dsh.compatibility.dshReleases` 对最新三个完整版本逐项给出 `compatible`、`incompatible` 或 `unknown`。
- `dsh.bundle.patch` 只插入插件自有的 `task-notify` entry。

### P1：增加 disposable Profile 验证

新增一个不会污染用户 Profile 的验证脚本或 CI job，完成以下流程：

1. 创建临时 Profile。
2. 安装本地固定 Commit 或发布包。
3. 启动 `dsh web`，确认服务正常监听并记录日志。
4. 检查插件 entry 和设置卡片可以加载。
5. 停止服务并卸载插件/Profile。
6. 保存命令、版本、Commit、退出码和关键输出作为 CI artifact 或仓库文档证据。

验证失败时必须返回非零退出码，并清理临时目录。

### P1：更新文档与变更记录

在 `README.md`、`README.zh-CN.md` 或新增验证文档中写明：

- 支持的 Node.js/DSH 版本。
- 一次性 Profile 验证命令。
- 验证日期、固定 Commit 和结果。
- 已知限制：Catalog 通过不等同于所有真实设备或浏览器通知权限场景均通过。

## 4. 验收标准

### 静态验收

- `package.json` 可解析。
- 最新三个 DSH 版本均有显式 `dshReleases` 记录。
- peer 依赖范围不会拒绝已声明 compatible 的 DSH 版本。
- 不存在替换官方包名、官方 entry ID 或删除他人插件 entry 的 patch。

### 自动化验收

在 Node.js 20 和 22 上执行并通过：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --dry-run
node scripts/check-package.cjs
```

### 运行时验收

- 临时 Profile 安装成功。
- `dsh web` 成功启动并产生预期监听地址/日志。
- 插件加载无 `ERR_MODULE_NOT_FOUND`、entry key、peer dependency 或 bundle patch 错误。
- 卸载后临时 Profile 被清理，不影响用户现有 Profile。

## 5. 交付物

1. 更新后的 `package.json` 和 `pnpm-lock.yaml`。
2. disposable Profile 验证脚本及对应 CI 配置。
3. 一份验证日志或 CI artifact 链接/说明。
4. 更新后的中英文安装与兼容性文档。
5. 新版本 Commit，并推送到默认分支，等待 DSH STORE 自动复检。

## 6. 风险与注意事项

- 不要把“宽泛 SemVer 范围”当作最新预发布版本的安装证据。
- 不要直接编辑 DSH 生成的 aggregate 文件；Bundle Patch 必须是持久化配置。
- 本地网络、npm 权限或缓存失败应与插件代码失败分开记录。
- 运行时验证应使用临时 Profile，避免修改用户已有 DSH 配置。

## 7. 完成定义

只有在依赖范围、Catalog 元数据、Profile 安装/启动/卸载证据及全套 CI 检查均通过，并且新固定 Commit 已推送到默认分支后，任务才可标记为完成。
