/**
 * Unit tests for the localStorage-backed settings store.
 * Runs in the default node environment with a mocked localStorage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  } as unknown as Storage
}

describe('task-notify settings store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    globalThis.localStorage = memoryStorage()
  })

  it('returns defaults when storage is empty', async () => {
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toEqual({
      enabled: true,
      turn: true,
      job: true,
      review: true,
      failure: true,
      browser: true,
      sound: false,
    })
  })

  it('merges persisted values over defaults', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v1', JSON.stringify({ sound: true, enabled: false }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ enabled: false, sound: true, turn: true })
  })

  it('persists updates and notifies subscribers', async () => {
    const { getSettings, setSetting, subscribeSettings } = await import('../src/client/settings.ts')
    const listener = vi.fn()
    const unsubscribe = subscribeSettings(listener)
    setSetting('sound', true)
    expect(getSettings().sound).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    const raw = JSON.parse(globalThis.localStorage!.getItem('dsh.taskNotify.v1')!)
    expect(raw.sound).toBe(true)
    unsubscribe()
    setSetting('sound', false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults on corrupt JSON', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v1', '{not-json')
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings().enabled).toBe(true)
  })
})
