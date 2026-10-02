/**
 * Unit tests for the localStorage-backed settings store.
 * Runs in the default node environment with a mocked localStorage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskNotifySettings } from '../src/client/settings.ts'

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
      allSessions: false,
      review: true,
      failure: true,
      browser: true,
      soundMode: 'off',
      soundUrl: '',
      volume: 1,
      toastPosition: 'bottom-right',
      toastSeconds: 5,
      templateTitle: '',
      templateBody: '',
      quietEnabled: false,
      quietFrom: '22:00',
      quietTo: '08:00',
      mutedSessions: [],
    } satisfies TaskNotifySettings)
  })

  it('merges persisted v3 values over defaults', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v3', JSON.stringify({ soundMode: 'single', enabled: false }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ enabled: false, soundMode: 'single', turn: true, volume: 1 })
  })

  it('migrates the v2 record: toggles kept, the sound boolean becomes its mode, v2 key retired', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v2', JSON.stringify({ sound: true, enabled: false }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ enabled: false, soundMode: 'double', turn: true, quietEnabled: false })
    expect(globalThis.localStorage!.getItem('dsh.taskNotify.v2')).toBeNull()
    expect(JSON.parse(globalThis.localStorage!.getItem('dsh.taskNotify.v3')!)).toMatchObject({ enabled: false, soundMode: 'double' })
  })

  it('migrates a v2 record with the sound toggle off to soundMode off', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v2', JSON.stringify({ enabled: true }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ enabled: true, soundMode: 'off' })
  })

  it('persists updates to the v3 key and notifies subscribers', async () => {
    const { getSettings, setSetting, subscribeSettings } = await import('../src/client/settings.ts')
    const listener = vi.fn()
    const unsubscribe = subscribeSettings(listener)
    setSetting('soundMode', 'single')
    expect(getSettings().soundMode).toBe('single')
    expect(listener).toHaveBeenCalledTimes(1)
    const raw = JSON.parse(globalThis.localStorage!.getItem('dsh.taskNotify.v3')!)
    expect(raw.soundMode).toBe('single')
    unsubscribe()
    setSetting('soundMode', 'off')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults on corrupt JSON', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v3', '{not-json')
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings().enabled).toBe(true)
  })

  it('ignores the retired v1 record so a fresh install starts from defaults', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v1', JSON.stringify({ sound: true, enabled: false }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ enabled: true, soundMode: 'off' })
  })

  it('sanitizes junk values out of a hand-edited record', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v3', JSON.stringify({
      toastSeconds: 99,
      volume: 5,
      soundMode: 'loud',
      toastPosition: 'center',
      mutedSessions: 'nope',
      templateTitle: 42,
      quietFrom: 7,
    }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({
      toastSeconds: 15,
      volume: 1,
      soundMode: 'off',
      toastPosition: 'bottom-right',
      mutedSessions: [],
      templateTitle: '',
      quietFrom: '22:00',
    })
  })

  it('clamps low values into range as well', async () => {
    globalThis.localStorage!.setItem('dsh.taskNotify.v3', JSON.stringify({ toastSeconds: 1, volume: -2 }))
    const { getSettings } = await import('../src/client/settings.ts')
    expect(getSettings()).toMatchObject({ toastSeconds: 3, volume: 0 })
  })
})

describe('isQuietTime', () => {
  beforeEach(() => {
    vi.resetModules()
    globalThis.localStorage = memoryStorage()
  })

  /** Local `2026-10-02 hh:mm` — `isQuietTime` compares wall-clock minutes. */
  const at = (hours: number, minutes: number): Date => new Date(2026, 9, 2, hours, minutes)

  it('is never quiet when the window is disabled', async () => {
    const { getSettings, isQuietTime } = await import('../src/client/settings.ts')
    const settings = { ...getSettings(), quietEnabled: false, quietFrom: '00:00', quietTo: '23:59' }
    expect(isQuietTime(settings, at(12, 0))).toBe(false)
  })

  it('matches a same-day window with an exclusive end', async () => {
    const { getSettings, isQuietTime } = await import('../src/client/settings.ts')
    const settings = { ...getSettings(), quietEnabled: true, quietFrom: '12:00', quietTo: '13:00' }
    expect(isQuietTime(settings, at(11, 59))).toBe(false)
    expect(isQuietTime(settings, at(12, 0))).toBe(true)
    expect(isQuietTime(settings, at(12, 59))).toBe(true)
    expect(isQuietTime(settings, at(13, 0))).toBe(false)
  })

  it('matches an overnight window across midnight', async () => {
    const { getSettings, isQuietTime } = await import('../src/client/settings.ts')
    const settings = { ...getSettings(), quietEnabled: true, quietFrom: '22:00', quietTo: '08:00' }
    expect(isQuietTime(settings, at(21, 59))).toBe(false)
    expect(isQuietTime(settings, at(23, 30))).toBe(true)
    expect(isQuietTime(settings, at(3, 0))).toBe(true)
    expect(isQuietTime(settings, at(7, 59))).toBe(true)
    expect(isQuietTime(settings, at(8, 0))).toBe(false)
    expect(isQuietTime(settings, at(12, 0))).toBe(false)
  })

  it('treats malformed or zero-length windows as never quiet', async () => {
    const { getSettings, isQuietTime } = await import('../src/client/settings.ts')
    const base = { ...getSettings(), quietEnabled: true }
    expect(isQuietTime({ ...base, quietFrom: '25:00', quietTo: '08:00' }, at(23, 0))).toBe(false)
    expect(isQuietTime({ ...base, quietFrom: 'abc', quietTo: '08:00' }, at(23, 0))).toBe(false)
    expect(isQuietTime({ ...base, quietFrom: '08:00', quietTo: '08:00' }, at(8, 30))).toBe(false)
  })

  it('defaults to the current time when `now` is omitted', async () => {
    const { getSettings, isQuietTime } = await import('../src/client/settings.ts')
    // Two complementary windows cover every minute of the day, so whichever
    // time this runs at, exactly one matches — deterministic without fake timers.
    const morning = { ...getSettings(), quietEnabled: true, quietFrom: '00:00', quietTo: '12:00' }
    const evening = { ...getSettings(), quietEnabled: true, quietFrom: '12:00', quietTo: '00:00' }
    expect(isQuietTime(morning) || isQuietTime(evening)).toBe(true)
  })
})
