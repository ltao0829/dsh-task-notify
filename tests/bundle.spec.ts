/**
 * Built-artifact contract tests.
 *
 * A DSH client bundle is fetched outside the shell's module graph and resolves
 * its externals through the loader's `require`, which can only answer the frozen
 * platform module table. A require outside that table is a guaranteed boot-time
 * throw in the browser and nothing in the source tree catches it, so this test
 * reads the emitted `lib/client.js`.
 *
 * It skips when the bundle has not been built yet, which is why CI runs
 * `pnpm run build` before `pnpm test`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundlePath = `${root}/lib/client.js`
const platformModules: readonly string[] = JSON.parse(
  readFileSync(`${root}/build/platform-modules.json`, 'utf8'),
)
const manifest = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as { name: string }

const built = existsSync(bundlePath)
const bundle = built ? readFileSync(bundlePath, 'utf8') : ''

describe.skipIf(!built)('built client bundle', () => {
  it('emits the module-loader handoff under the package id', () => {
    expect(bundle).toContain('window.__ModuleLoader__.load')
    expect(bundle).toContain(JSON.stringify(manifest.name))
  })

  it('requires only modules the DSH 0.2 platform table can answer', () => {
    const required = [...new Set([...bundle.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))]
    expect(required.length).toBeGreaterThan(0)
    for (const id of required) expect(platformModules, id).toContain(id)
  })

  it('never carries a direct reference to the retired client-runtime package', () => {
    expect(bundle).not.toContain('@deepseek-ai/dsh-client-runtime')
  })
})

describe.skipIf(built)('built client bundle (not built)', () => {
  it('is skipped until `pnpm run build` has produced lib/client.js', () => {
    expect(existsSync(bundlePath)).toBe(false)
  })
})
