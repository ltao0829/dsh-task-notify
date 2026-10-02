# Disposable Profile Verification Evidence

## 1. 验证元数据

| 项目 | 内容 |
|---|---|
| 插件名称与版本 | `@ltao0829/dsh-task-notify@0.3.0` |
| 固定 Commit | `8537611dbb9316518870c5de1b3030f0cd75222e` |
| 验证结果 | **PASSED** |
| 验证时间 | `2026-10-02T06:56:22.788Z` |
| Node.js 运行时 | `v24.18.0` (win32 x64) |
| DSH 运行时版本 | `0.2.0-rc.2` |
| 隔离环境 | 临时 `DSH_HOME`，已在验证完成后彻底清理 |
| 监听服务地址 | `http://127.0.0.1:1710` |
| 启动文档 | HTTP 200，且已确认客户端模块图包含本插件 |
| 客户端产物 | 发布包内 `package/lib/client.js`，43466 字节 |
| 产物外部依赖 | `react`、`react/jsx-runtime` |

## 2. 验证阶段与执行结果

### 阶段一：本地发布包打包 (`pnpm pack`)
- 命令：`pnpm pack`
- 退出码：0
- 说明：验证发布包只包含声明的 `files`，不含未编译的测试与临时产物。

### 阶段二：一次性 Profile 安装 (`dsh plugin add`)
- 命令：`dsh plugin --profile web add <tarball>`
- 退出码：0
- 说明：在独立的临时 Profile 中完成依赖解析与 `dsh.profile.bundles` 注册。

### 阶段三：配置合成与 Entry 校验 (`dsh --dump-config`)
- 命令：`dsh --profile web --dump-config`
- 退出码：0
- 校验项：确认 composed bundle tree 中包含唯一的自有 entry `task-notify`，无任何官方组件被替换或遮蔽。

### 阶段四：运行时启动与监听验收 (`dsh web`)
- 命令：`dsh --profile web --no-open --port 0`
- 运行结果：服务在 `http://127.0.0.1:1710` 正常启动并监听。
- 探测结果：跟随 token 重定向（携带 Cookie）取回启动文档，最终 HTTP 状态码 200；文档携带 `__ModuleLoader__` 引导脚本，且客户端模块图的 combo URL 中列出了本插件，无 `ERR_MODULE_NOT_FOUND`、entry key 或 bundle patch 错误。

### 阶段五：发布包内客户端产物校验 (`tar -xzf <tarball> package/lib/client.js`)
- 校验对象：`pnpm pack` 产出的 tarball 中真实发布的 `package/lib/client.js`（43466 字节）
- 校验项：产物携带 `__ModuleLoader__.load` 交接协议、以本包名标识自身，且其 `require` 的外部模块全部属于 DSH 0.2 冻结模块表。
- 外部依赖：`react`、`react/jsx-runtime`

### 阶段六：卸载与清理 (`dsh plugin remove`)
- 命令：`dsh plugin --profile web remove @ltao0829/dsh-task-notify`
- 退出码：0
- 校验项：确认 `task-notify` entry 已从 bundle tree 中移除，临时目录完全清理，真实用户环境无任何残留。

## 3. 已知限制与运行边界

- **Catalog 准入与真实设备**：本验证证明该固定 Commit 符合 DSH 插件规范、且在标准 Web Profile 下可正常安装、加载与卸载，并且其浏览器产物可由 Host 正常提供。
- **未覆盖项**：本脚本不驱动真实浏览器，因此不覆盖浏览器内的运行时行为（通知权限、Web Audio 解锁、React 渲染）。这些路径由 `tests/client-apply.spec.ts` 与 `tests/notification.spec.ts` 在 jsdom 中覆盖。
- **系统通知权限**：浏览器与 OS 级桌面通知展示依赖用户在浏览器中授权通知权限，若用户未允许通知，插件将自动降级为应用内 Toast 提醒与音频提示。
