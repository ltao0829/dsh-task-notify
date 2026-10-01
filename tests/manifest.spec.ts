/**
 * Manifest contract tests.
 *
 * DSH 0.2 stopped reading `dsh.compatibility`: before a profile imports a
 * plugin, `evaluatePluginCompatibility` (dsh-app-boot) checks every
 * `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` entry in `peerDependencies` against
 * the single runtime version, with prereleases participating in ranges. These
 * tests pin the manifest facts that gate installation, and the patch/plugin
 * identity agreement that gates loading.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { name as hostPluginName } from '../src/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
  engines?: Record<string, string>
  dsh?: {
    manifestVersion?: number
    bundle?: { patch?: string }
    client?: { platform?: string; inject?: string[] }
    compatibility?: unknown
  }
  peerDependencies?: Record<string, string>
}

/** The DSH runtime this plugin revision targets. */
const RUNTIME_VERSION = '0.2.0-rc.2'

/** The one range every DSH peer must carry so the runtime satisfies it. */
const DSH_PEER_RANGE = '^0.2.0-rc.2'

describe('package manifest', () => {
  it('declares the 0.2 manifest format and the web client platform', () => {
    expect(manifest.dsh?.manifestVersion).toBe(1)
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  })

  it('drops the retired dsh.compatibility block', () => {
    expect(manifest.dsh?.compatibility).toBeUndefined()
  })

  it('declares the DSH runtime under engines.dsh', () => {
    expect(manifest.engines?.dsh).toBe(DSH_PEER_RANGE)
  })

  it('pins every DSH peer to the range the 0.2 runtime satisfies', () => {
    const dshPeers = Object.entries(manifest.peerDependencies ?? {})
      .filter(([dependency]) => dependency === '@deepseek-ai/dsh' || dependency.startsWith('@deepseek-ai/dsh-'))
    expect(dshPeers.length).toBeGreaterThan(0)
    for (const [dependency, range] of dshPeers) {
      // A peer left on the retired 0.1 range would make DSH refuse the install,
      // so any drift here is a hard failure rather than a warning.
      expect(range, dependency).toBe(DSH_PEER_RANGE)
    }
  })

  it('names only packages that ship at the 0.2 runtime version', () => {
    for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
      expect(dependency.startsWith('@deepseek-ai/dsh-client-runtime'), dependency).toBe(false)
    }
  })

  it('keeps the informational client inject list free of the retired runtime package', () => {
    const inject = manifest.dsh?.client?.inject ?? []
    expect(inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(inject).not.toContain('@deepseek-ai/dsh-client-runtime')
  })
})

describe('bundle patch', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

  it('inserts exactly one row, named after this package and the host plugin', () => {
    const inserted = [...patch.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map((match) => match[1])
    expect(inserted).toEqual(['task-notify'])

    const names = [...patch.matchAll(/^\s*name:\s*'([^']+)'\s*$/gm)].map((match) => match[1])
    expect(names).toEqual([manifest.name])

    expect(hostPluginName).toBe(inserted[0])
  })
})
