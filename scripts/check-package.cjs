'use strict'
// Package/release metadata check for CI.
//
// Verifies the metadata the DSH 0.2 plugin loader and npm publishing rely on.
// DSH 0.2 no longer reads `dsh.compatibility`; before importing a plugin it
// checks every `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` entry in
// `peerDependencies` against the single runtime version, so a stale range here
// is an installation refusal rather than a warning.
const fs = require('node:fs')
const path = require('node:path')

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(pkg.name)) {
  throw new Error('package name must be scoped (@scope/name), got: ' + pkg.name)
}

for (const key of ['name', 'version', 'description', 'license', 'repository', 'files']) {
  if (pkg[key] === undefined) {
    throw new Error('missing required package.json field: ' + key)
  }
}

const dsh = pkg.dsh
if (dsh === undefined || typeof dsh !== 'object') {
  throw new Error('missing required package.json field: dsh')
}
if (dsh.manifestVersion !== 1) {
  throw new Error('dsh.manifestVersion must be 1, got: ' + JSON.stringify(dsh.manifestVersion))
}
if (dsh.compatibility !== undefined) {
  throw new Error('dsh.compatibility is retired in DSH 0.2; declare peers and engines.dsh instead')
}
if (typeof dsh.bundle?.patch !== 'string') {
  throw new Error('dsh.bundle.patch must be a single patch file path')
}
if (!fs.existsSync(path.resolve(dsh.bundle.patch))) {
  throw new Error('dsh.bundle.patch does not exist: ' + dsh.bundle.patch)
}
if (typeof dsh.client?.platform !== 'string' || dsh.client.platform === '') {
  throw new Error('dsh.client.platform must be a non-empty client platform id')
}

const enginesDsh = pkg.engines?.dsh
if (typeof enginesDsh !== 'string' || enginesDsh.trim() === '') {
  throw new Error('engines.dsh must declare the compatible DSH range')
}

const dshPeers = Object.entries(pkg.peerDependencies ?? {})
  .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
if (dshPeers.length === 0) {
  throw new Error('no @deepseek-ai/dsh-* peerDependencies declared; the DSH 0.2 gate would impose no constraint')
}
for (const [name, range] of dshPeers) {
  if (typeof range !== 'string' || range.trim() === '') {
    throw new Error(`peerDependencies[${JSON.stringify(name)}] must be a non-empty range`)
  }
  if (range !== enginesDsh) {
    throw new Error(
      `peerDependencies[${JSON.stringify(name)}] (${range}) disagrees with engines.dsh (${enginesDsh}); ` +
      'keep every DSH peer and engines.dsh pinned to the same range',
    )
  }
}

console.log('metadata OK: ' + pkg.name + '@' + pkg.version + ' (dsh ' + enginesDsh + ', ' + dshPeers.length + ' DSH peers)')
