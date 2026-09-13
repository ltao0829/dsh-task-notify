# Disposable Profile Verification Evidence

## 1. 验证元数据

| 项目 | 内容 |
|---|---|
| 插件名称与版本 | `@ltao0829/dsh-task-notify@0.1.2` |
| 固定 Commit | `df83e98904a7bd03def3773ee6186228e88f6af8 (working tree modified)` |
| 验证结果 | **PASSED** |
| 验证时间 | `2026-09-13T05:43:17.401Z` |
| Node.js 运行时 | `v24.18.0` (win32 x64) |
| DSH 运行时版本 | `0.1.5-rc.1` |
| 隔离环境 | 临时 `DSH_HOME`，已在验证完成后彻底清理 |
| 监听服务地址 | `http://127.0.0.1:47974` |

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
- 运行结果：服务在 `http://127.0.0.1:47974` 正常启动并监听。
- 探测结果：HTTP GET 响应状态码 303，无 `ERR_MODULE_NOT_FOUND`、entry key 或 bundle patch 错误。

### 阶段五：卸载与清理 (`dsh plugin remove`)
- 命令：`dsh plugin --profile web remove @ltao0829/dsh-task-notify`
- 退出码：0
- 校验项：确认 `task-notify` entry 已从 bundle tree 中移除，临时目录完全清理，真实用户环境无任何残留。

## 3. 已知限制与运行边界

- **Catalog 准入与真实设备**：本验证证明该固定 Commit 符合 DSH 插件规范、且在标准 Web Profile 下可正常安装、加载与卸载。
- **系统通知权限**：浏览器与 OS 级桌面通知展示依赖用户在浏览器中授权通知权限，若用户未允许通知，插件将自动降级为应用内 Toast 提醒与音频提示。
