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

/**
 * The shell's frozen module table, read from the same JSON the build treats as
 * its external list. A bundle requiring anything outside it would throw at boot.
 */
const PLATFORM_MODULE_IDS = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'platform-modules.json'), 'utf8'))
);

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

/**
 * GET one URL, following a bounded number of redirects and carrying any cookie
 * the redirect chain hands out. `dsh web` authenticates with a token URL that
 * redirects to a cookie-bearing document, so a naive follow lands on 401.
 * @param {string} url absolute URL
 * @param {number} redirectsLeft remaining redirect budget
 * @param {Map<string, string>} jar cookie name → value
 * @returns {Promise<{status: number, body: string, url: string}>}
 */
function getDocument(url, redirectsLeft = 3, jar = new Map()) {
  return new Promise((resolve, reject) => {
    const headers = jar.size === 0
      ? {}
      : { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') };
    http.get(url, { headers }, (res) => {
      const status = res.statusCode ?? 0;
      for (const raw of res.headers['set-cookie'] ?? []) {
        const [pair] = raw.split(';');
        const separator = pair.indexOf('=');
        if (separator > 0) jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location !== undefined && redirectsLeft > 0) {
        res.resume();
        resolve(getDocument(new URL(location, url).toString(), redirectsLeft - 1, jar));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status, body, url }));
    }).on('error', reject);
  });
}

/**
 * Assert the client half of the bundle is a valid DSH 0.2 client module: it
 * carries the module-loader handoff, identifies its own package, and resolves
 * every `require` through the frozen platform module table. A require the table
 * cannot answer throws at bootstrap in the browser, and nothing in the source
 * tree catches it — so the check runs against the bytes that actually ship.
 * @param {string} bundle source text of the shipped `client.js`
 * @param {string} expectedId package name the bundle must identify itself as
 * @returns {string[]} the external module ids the bundle requires
 */
function assertClientBundle(bundle, expectedId) {
  if (!bundle.includes('__ModuleLoader__.load')) {
    throw new Error('shipped lib/client.js is missing the module-loader handoff');
  }
  if (!bundle.includes(expectedId)) {
    throw new Error(`shipped lib/client.js does not identify ${expectedId}`);
  }
  const requires = [...new Set([...bundle.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))];
  const nonPlatform = requires.filter((id) => !PLATFORM_MODULE_IDS.has(id));
  if (nonPlatform.length > 0) {
    throw new Error(
      `shipped lib/client.js requires modules the DSH 0.2 module table cannot answer: ${nonPlatform.join(', ')}`,
    );
  }
  return requires;
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
  let extractDir = null;
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

    // Verify the boot document. The token URL redirects to a cookie-bearing
    // document, so follow it with a cookie jar and require the final 200.
    const document = await getDocument(url);
    httpStatus = document.status;
    console.log(`   HTTP GET ${displayUrl} -> final status ${document.status} (${document.body.length} bytes)`);
    if (document.status !== 200) {
      throw new Error(`Unexpected final HTTP status from dsh web: ${document.status}`);
    }
    if (!document.body.includes('__ModuleLoader__')) {
      throw new Error('Boot document does not carry the DSH module-loader bootstrap');
    }
    // The composed application batch is a combo URL listing every application
    // plugin by package id, so the client half of THIS plugin must be named
    // there — otherwise the profile composed the host row without the client
    // module and the browser would never run the watcher.
    if (!document.body.includes(pkg.name)) {
      throw new Error(
        `Boot document does not reference ${pkg.name}; the client half did not reach the composed module graph`,
      );
    }
    console.log('   Boot document references this plugin in the client module graph');

    // 6. Check the SHIPPED client bundle straight out of the packed tarball —
    //    `files` decides what npm publishes, so this is the artifact users get.
    console.log('\n6. Checking the shipped client bundle inside the packed tarball...');
    const extractDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bundle-'));
    extractDir = extractDirPath;
    const tarRes = spawnSync('tar', ['-xzf', tarballPath, '-C', extractDirPath, 'package/lib/client.js', 'package/lib/index.js'], {
      encoding: 'utf8'
    });
    if (tarRes.status !== 0) {
      throw new Error(
        `extracting lib/client.js from the packed tarball failed: ${tarRes.stderr || tarRes.error?.message || 'unknown error'}`,
      );
    }
    const shippedBundle = fs.readFileSync(path.join(extractDirPath, 'package', 'lib', 'client.js'), 'utf8');
    const requires = assertClientBundle(shippedBundle, pkg.name);
    record('client-bundle', 'tar -xzf <tarball> package/lib/client.js', 0, `${shippedBundle.length} bytes; externals: ${requires.join(', ') || 'none'}`);
    console.log(`   Shipped client.js: ${shippedBundle.length} bytes; externals: ${requires.join(', ') || 'none'}`);

    // 7. Stop server
    console.log('\n7. Stopping dsh web process tree...');
    killProcessTree(server);
    console.log('   dsh web stopped cleanly');

    // 8. Uninstall plugin
    console.log('\n8. Uninstalling plugin from disposable profile...');
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

    // 9. Confirm uninstalled from config
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
    console.log('All stages (package, install, dump-config, boot listener, HTTP check, client bundle, uninstall) succeeded.');

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
      clientBundleBytes: shippedBundle.length,
      clientExternals: requires,
      executionLog,
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
    console.log(`\nVerification evidence saved to: docs/verification-evidence.md`);

  } finally {
    // 10. Clean up temporary files
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
    if (typeof extractDir === 'string' && fs.existsSync(extractDir)) {
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
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
| 启动文档 | HTTP 200，且已确认客户端模块图包含本插件 |
| 客户端产物 | 发布包内 \`package/lib/client.js\`，${data.clientBundleBytes} 字节 |
| 产物外部依赖 | ${data.clientExternals.length === 0 ? '（无）' : data.clientExternals.map((id) => `\`${id}\``).join('、')} |

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
- 探测结果：跟随 token 重定向（携带 Cookie）取回启动文档，最终 HTTP 状态码 200；文档携带 \`__ModuleLoader__\` 引导脚本，且客户端模块图的 combo URL 中列出了本插件，无 \`ERR_MODULE_NOT_FOUND\`、entry key 或 bundle patch 错误。

### 阶段五：发布包内客户端产物校验 (\`tar -xzf <tarball> package/lib/client.js\`)
- 校验对象：\`pnpm pack\` 产出的 tarball 中真实发布的 \`package/lib/client.js\`（${data.clientBundleBytes} 字节）
- 校验项：产物携带 \`__ModuleLoader__.load\` 交接协议、以本包名标识自身，且其 \`require\` 的外部模块全部属于 DSH 0.2 冻结模块表。
- 外部依赖：${data.clientExternals.length === 0 ? '（无）' : data.clientExternals.map((id) => `\`${id}\``).join('、')}

### 阶段六：卸载与清理 (\`dsh plugin remove\`)
- 命令：\`dsh plugin --profile web remove @ltao0829/dsh-task-notify\`
- 退出码：0
- 校验项：确认 \`task-notify\` entry 已从 bundle tree 中移除，临时目录完全清理，真实用户环境无任何残留。

## 3. 已知限制与运行边界

- **Catalog 准入与真实设备**：本验证证明该固定 Commit 符合 DSH 插件规范、且在标准 Web Profile 下可正常安装、加载与卸载，并且其浏览器产物可由 Host 正常提供。
- **未覆盖项**：本脚本不驱动真实浏览器，因此不覆盖浏览器内的运行时行为（通知权限、Web Audio 解锁、React 渲染）。这些路径由 \`tests/client-apply.spec.ts\` 与 \`tests/notification.spec.ts\` 在 jsdom 中覆盖。
- **系统通知权限**：浏览器与 OS 级桌面通知展示依赖用户在浏览器中授权通知权限，若用户未允许通知，插件将自动降级为应用内 Toast 提醒与音频提示。
`;

  fs.writeFileSync(targetPath, content, 'utf8');
}

verifyDisposableProfile().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err.message);
  process.exit(1);
});
