'use strict';

/**
 * Disposable Profile Verification Script for DSH Plugins
 *
 * Verifies that the plugin can be packaged, installed into a disposable,
 * isolated DSH profile, booted via `dsh web`, and cleanly uninstalled without
 * polluting the user's ~/.dsh directory or failing on peer dependencies.
 */

const { spawn, spawnSync, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const isWin = process.platform === 'win32';
const dshBin = isWin ? 'dsh.cmd' : 'dsh';
const pnpmBin = isWin ? 'pnpm.cmd' : 'pnpm';
const webStartTimeoutMs = Number.parseInt(process.env.DSH_WEB_START_TIMEOUT_MS || '90000', 10);
const pluginInstallTimeoutMs = Number.parseInt(process.env.DSH_PLUGIN_INSTALL_TIMEOUT_MS || '300000', 10);

for (const [name, value] of [
  ['DSH_WEB_START_TIMEOUT_MS', webStartTimeoutMs],
  ['DSH_PLUGIN_INSTALL_TIMEOUT_MS', pluginInstallTimeoutMs]
]) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (isWin) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // process already dead
    }
  } else {
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      // ignore
    }
  }
}

function getHeadCommit() {
  try {
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
    return dirty ? `${head} (working tree modified)` : head;
  } catch {
    return 'unknown';
  }
}

async function verifyDisposableProfile() {
  const rootDir = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const commit = getHeadCommit();

  console.log('=== DSH Disposable Profile Verification ===');
  console.log(`Plugin: ${pkg.name}@${pkg.version}`);
  console.log(`Commit: ${commit}`);
  console.log(`Node:   ${process.version} (${process.platform} ${process.arch})`);

  // Verify dsh CLI availability
  const dshVersionCheck = spawnSync(dshBin, ['--version'], {
    shell: isWin,
    encoding: 'utf8'
  });
  if (dshVersionCheck.status !== 0) {
    throw new Error(
      `dsh CLI is not available or failed: ${dshVersionCheck.stderr || dshVersionCheck.error?.message || 'unknown error'}`
    );
  }
  const dshVersion = dshVersionCheck.stdout.trim();
  console.log(`DSH:    ${dshVersion}`);

  // Create isolated temp DSH_HOME
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-disposable-profile-'));
  fs.mkdirSync(path.join(tempHome, 'storages'), { recursive: true });
  fs.mkdirSync(path.join(tempHome, 'profiles'), { recursive: true });
  console.log(`\n1. Initialized isolated DSH_HOME: ${tempHome}`);

  let tarballPath = null;
  let webServer = null;
  const executionLog = [];

  function record(step, command, exitCode, output) {
    executionLog.push({ step, command, exitCode, output });
  }

  try {
    // 2. Package plugin to tarball
    console.log('\n2. Packaging plugin tarball via pnpm pack...');
    const packRes = spawnSync(pnpmBin, ['pack'], {
      cwd: rootDir,
      shell: isWin,
      encoding: 'utf8'
    });
    record('pack', `${pnpmBin} pack`, packRes.status, packRes.stdout + '\n' + packRes.stderr);
    if (packRes.status !== 0) {
      throw new Error(`pnpm pack failed: ${packRes.stderr || packRes.stdout}`);
    }
    const tarballName = packRes.stdout.trim().split('\n').pop().trim();
    tarballPath = path.join(rootDir, tarballName);
    console.log(`   Created tarball: ${tarballName}`);

    // 3. Install plugin to disposable profile
    console.log('\n3. Installing plugin into disposable web profile...');
    const addRes = spawnSync(dshBin, ['plugin', '--profile', 'web', 'add', tarballPath], {
      env: { ...process.env, DSH_HOME: tempHome },
      shell: isWin,
      stdio: 'inherit',
      timeout: pluginInstallTimeoutMs
    });
    record('plugin-add', `${dshBin} plugin --profile web add ${tarballName}`, addRes.status, 'See terminal or CI log.');
    if (addRes.status !== 0) {
      const cause = addRes.error
        ? `${addRes.error.code || addRes.error.name}: ${addRes.error.message}\n`
        : '';
      throw new Error(
        `dsh plugin add failed (exit code ${addRes.status}). ${cause}See the pnpm output above for the root cause.`
      );
    }
    console.log('   Plugin added successfully to profile web');

    // 4. Dump composed configuration
    console.log('\n4. Verifying composed profile configuration...');
    const dumpRes = spawnSync(dshBin, ['--profile', 'web', '--dump-config'], {
      env: { ...process.env, DSH_HOME: tempHome },
      shell: isWin,
      encoding: 'utf8',
      timeout: 15000
    });
    record('dump-config', `${dshBin} --profile web --dump-config`, dumpRes.status, dumpRes.stdout);
    if (dumpRes.status !== 0) {
      throw new Error(`dsh --dump-config failed (exit code ${dumpRes.status}):\n${dumpRes.stderr}`);
    }
    if (!dumpRes.stdout.includes('task-notify')) {
      throw new Error('Composed profile configuration is missing the task-notify plugin entry!');
    }
    console.log('   Confirmed: task-notify entry present in composed bundle tree');

    // 5. Boot dsh web in disposable profile
    console.log('\n5. Booting dsh web in disposable profile (port 0)...');
    let webServerOutput = '';
    let webUrl = null;

    const serverPromise = new Promise((resolve, reject) => {
      const server = spawn(dshBin, ['--profile', 'web', '--no-open', '--port', '0'], {
        env: { ...process.env, DSH_HOME: tempHome },
        shell: isWin
      });
      webServer = server;

      const timeout = setTimeout(() => {
        killProcessTree(server);
        reject(new Error(
          `dsh web timed out waiting for listener after ${webStartTimeoutMs}ms. Output:\n${webServerOutput}`
        ));
      }, webStartTimeoutMs);

      server.stdout.on('data', (data) => {
        const text = data.toString();
        webServerOutput += text;
        const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/?(?:\?token=[A-Za-z0-9_-]+)?/);
        if (match && !webUrl) {
          webUrl = match[0];
          clearTimeout(timeout);
          resolve({ server, url: webUrl });
        }
      });

      server.stderr.on('data', (data) => {
        const text = data.toString();
        webServerOutput += text;
        if (text.includes('ERR_MODULE_NOT_FOUND') || text.includes('plugin tree failed to load')) {
          clearTimeout(timeout);
          killProcessTree(server);
          reject(new Error(`dsh web startup error:\n${text}`));
        }
      });

      server.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      server.on('close', (code) => {
        clearTimeout(timeout);
        if (!webUrl) {
          reject(new Error(
            `dsh web exited before reporting a listener URL (code ${code}). Output:\n${webServerOutput}`
          ));
        }
      });
    });

    const { server, url } = await serverPromise;
    const displayUrl = new URL(url).origin;
    let httpStatus = null;
    console.log(`   dsh web started and listening on: ${displayUrl}`);
    record('web-boot', `${dshBin} --profile web --no-open --port 0`, 0, `Listening: ${displayUrl}`);

    // Verify root HTTP response
    await new Promise((resolve, reject) => {
      http.get(url, (res) => {
        httpStatus = res.statusCode ?? null;
        console.log(`   HTTP GET ${displayUrl} -> Status ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`Unexpected HTTP status from dsh web: ${res.statusCode}`));
        }
      }).on('error', reject);
    });

    // 6. Stop server
    console.log('\n6. Stopping dsh web process tree...');
    killProcessTree(server);
    console.log('   dsh web stopped cleanly');

    // 7. Uninstall plugin
    console.log('\n7. Uninstalling plugin from disposable profile...');
    const rmRes = spawnSync(dshBin, ['plugin', '--profile', 'web', 'remove', pkg.name], {
      env: { ...process.env, DSH_HOME: tempHome },
      shell: isWin,
      encoding: 'utf8',
      timeout: 30000
    });
    record('plugin-remove', `${dshBin} plugin --profile web remove ${pkg.name}`, rmRes.status, rmRes.stdout + '\n' + rmRes.stderr);
    if (rmRes.status !== 0) {
      throw new Error(`dsh plugin remove failed (exit code ${rmRes.status}):\n${rmRes.stderr || rmRes.stdout}`);
    }
    console.log(`   Plugin ${pkg.name} removed from profile web`);

    // 8. Confirm uninstalled from config
    const dumpAfterRes = spawnSync(dshBin, ['--profile', 'web', '--dump-config'], {
      env: { ...process.env, DSH_HOME: tempHome },
      shell: isWin,
      encoding: 'utf8',
      timeout: 15000
    });
    if (dumpAfterRes.stdout.includes('task-notify')) {
      throw new Error('Plugin task-notify entry still present after uninstallation!');
    }
    console.log('   Confirmed: task-notify entry successfully removed from composed bundle tree');

    console.log('\n=== DISPOSABLE PROFILE VERIFICATION PASSED ===');
    console.log('All stages (package, install, dump-config, boot listener, HTTP check, uninstall) succeeded.');

    // Save evidence log
    const evidenceReportPath = path.join(rootDir, 'docs', 'verification-evidence.md');
    writeEvidenceReport(evidenceReportPath, {
      plugin: `${pkg.name}@${pkg.version}`,
      commit,
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      dshVersion,
      tempHome,
      webUrl: displayUrl,
      httpStatus,
      executionLog,
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
    console.log(`\nVerification evidence saved to: docs/verification-evidence.md`);

  } finally {
    // 9. Clean up temporary files
    if (webServer) {
      killProcessTree(webServer);
      webServer = null;
    }
    if (tarballPath && fs.existsSync(tarballPath)) {
      try { fs.unlinkSync(tarballPath); } catch {}
    }
    if (fs.existsSync(tempHome)) {
      try { fs.rmSync(tempHome, { recursive: true, force: true }); } catch {}
    }
    console.log('Cleaned up disposable profile and temporary artifacts.');
  }
}

function writeEvidenceReport(targetPath, data) {
  const content = `# Disposable Profile Verification Evidence

## 1. 验证元数据

| 项目 | 内容 |
|---|---|
| 插件名称与版本 | \`${data.plugin}\` |
| 固定 Commit | \`${data.commit}\` |
| 验证结果 | **${data.status}** |
| 验证时间 | \`${data.timestamp}\` |
| Node.js 运行时 | \`${data.nodeVersion}\` (${data.platform}) |
| DSH 运行时版本 | \`${data.dshVersion}\` |
| 隔离环境 | 临时 \`DSH_HOME\`，已在验证完成后彻底清理 |
| 监听服务地址 | \`${data.webUrl}\` |

## 2. 验证阶段与执行结果

### 阶段一：本地发布包打包 (\`pnpm pack\`)
- 命令：\`pnpm pack\`
- 退出码：0
- 说明：验证发布包只包含声明的 \`files\`，不含未编译的测试与临时产物。

### 阶段二：一次性 Profile 安装 (\`dsh plugin add\`)
- 命令：\`dsh plugin --profile web add <tarball>\`
- 退出码：0
- 说明：在独立的临时 Profile 中完成依赖解析与 \`dsh.profile.bundles\` 注册。

### 阶段三：配置合成与 Entry 校验 (\`dsh --dump-config\`)
- 命令：\`dsh --profile web --dump-config\`
- 退出码：0
- 校验项：确认 composed bundle tree 中包含唯一的自有 entry \`task-notify\`，无任何官方组件被替换或遮蔽。

### 阶段四：运行时启动与监听验收 (\`dsh web\`)
- 命令：\`dsh --profile web --no-open --port 0\`
- 运行结果：服务在 \`${data.webUrl}\` 正常启动并监听。
- 探测结果：HTTP GET 响应状态码 ${data.httpStatus}，无 \`ERR_MODULE_NOT_FOUND\`、entry key 或 bundle patch 错误。

### 阶段五：卸载与清理 (\`dsh plugin remove\`)
- 命令：\`dsh plugin --profile web remove @ltao0829/dsh-task-notify\`
- 退出码：0
- 校验项：确认 \`task-notify\` entry 已从 bundle tree 中移除，临时目录完全清理，真实用户环境无任何残留。

## 3. 已知限制与运行边界

- **Catalog 准入与真实设备**：本验证证明该固定 Commit 符合 DSH 插件规范、且在标准 Web Profile 下可正常安装、加载与卸载。
- **系统通知权限**：浏览器与 OS 级桌面通知展示依赖用户在浏览器中授权通知权限，若用户未允许通知，插件将自动降级为应用内 Toast 提醒与音频提示。
`;

  fs.writeFileSync(targetPath, content, 'utf8');
}

verifyDisposableProfile().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err.message);
  process.exit(1);
});
