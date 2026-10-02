// @vitest-environment jsdom
/**
 * Unit tests for the notification renderer (toast + browser notification +
 * sound). Copy is asserted through the plugin's own Chinese dictionary, which
 * is the key-set source of truth for the namespace.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zh, type SettingsCardKey } from '../src/client/locales.ts'
import type { NotifyOptions } from '../src/client/notify.ts'

/** Namespace-bound translate over the real zh dictionary (no locale service). */
const t = (key: SettingsCardKey): string => zh[key]

/** Base options: every channel off — individual tests enable what they assert. */
const base: NotifyOptions = { browser: false, sound: 'off' }

class MockNotification {
  static permission: NotificationPermission = 'granted'
  static requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))
  static instances: MockNotification[] = []
  title: string
  body: string
  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.body = options?.body ?? ''
    MockNotification.instances.push(this)
  }
}

class MockAudio {
  static instances: MockAudio[] = []
  src: string
  volume = 1
  constructor(src: string) {
    this.src = src
    MockAudio.instances.push(this)
  }
  play(): { catch(): void } {
    return { catch: () => {} }
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  MockNotification.instances = []
  MockNotification.permission = 'granted'
  MockAudio.instances = []
  // @ts-expect-error installing a test double for the browser Notification API
  globalThis.Notification = MockNotification
  document.body.innerHTML = ''
  document.querySelectorAll('[data-task-notify-toasts]').forEach((node) => node.remove())
})

const toastHost = (): HTMLElement => {
  const host = document.querySelector('[data-task-notify-toasts]')
  if (host === null) throw new Error('toast host not mounted')
  return host as HTMLElement
}

describe('notifyEvent', () => {
  it('shows a toast with title and body', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1', title: 'Build feature' }, base, t)
    expect(toastHost().textContent).toContain('任务已完成')
    expect(toastHost().textContent).toContain('Build feature')
  })

  it('sends a browser notification when enabled and granted', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: 'completed' } },
      { ...base, browser: true },
      t,
    )
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('后台任务已完成')
    expect(MockNotification.instances[0].body).toContain('deploy')
  })

  it('skips browser notification when permission is denied', async () => {
    MockNotification.permission = 'denied'
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, browser: true }, t)
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('labels failed and killed jobs distinctly', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-1', kind: 'pwsh', label: 'x', status: 'failed' } },
      base,
      t,
    )
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-2', kind: 'pwsh', label: 'y', status: 'killed' } },
      base,
      t,
    )
    const text = toastHost().textContent!
    expect(text).toContain('后台任务失败')
    expect(text).toContain('后台任务被终止')
  })

  it('labels known review kinds in the body', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'review', sessionId: 's1', pending: 'approval', title: 'Deploy' }, base, t)
    expect(toastHost().textContent).toContain('操作审批')
  })

  it('falls back to the wire word for an unknown review kind', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'review', sessionId: 's1', pending: 'vendor-gate', title: 'Deploy' }, base, t)
    expect(toastHost().textContent).toContain('vendor-gate')
  })

  it('renders an agent-failure reminder', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'failure', sessionId: 's1', title: 'Deploy', message: 'quota exceeded' },
      base,
      t,
    )
    const text = toastHost().textContent!
    expect(text).toContain('任务失败')
    expect(text).toContain('quota exceeded')
  })
})

describe('custom templates', () => {
  it('expands the {title} {session} {kind} placeholders', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'turn', sessionId: 's1', title: 'Build feature' },
      { ...base, templateTitle: '[{kind}] {title}', templateBody: 'session: {session}' },
      t,
    )
    const text = toastHost().textContent!
    expect(text).toContain('[任务已完成] Build feature')
    expect(text).toContain('session: s1')
  })

  it('maps {title} to the job label for job events', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'j1', kind: 'pwsh', label: 'deploy', status: 'completed' } },
      { ...base, templateBody: '{title} ({kind})' },
      t,
    )
    expect(toastHost().textContent).toContain('deploy (后台任务已完成)')
  })

  it('uses the built-in copy for empty or blank templates', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'turn', sessionId: 's1', title: 'Build feature' },
      { ...base, templateTitle: '   ', templateBody: '' },
      t,
    )
    const text = toastHost().textContent!
    expect(text).toContain('任务已完成')
    expect(text).toContain('Build feature')
  })

  it('leaves unknown placeholders as written', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, templateTitle: 'hi {bogus}' }, t)
    expect(toastHost().textContent).toContain('hi {bogus}')
  })

  it('renders template output as text, never markup', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'turn', sessionId: 's1', title: '<img src=x onerror=alert(1)>' },
      { ...base, templateBody: '<b>{title}</b>' },
      t,
    )
    expect(document.querySelector('img')).toBeNull()
    expect(toastHost().textContent).toContain('<b><img src=x onerror=alert(1)></b>')
  })
})

describe('toast placement and duration', () => {
  it('docks the toast column to the configured corner', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, toastPosition: 'top-left' }, t)
    const host = toastHost()
    expect(host.style.top).toBe('16px')
    expect(host.style.left).toBe('16px')
  })

  it('re-docks the existing column when the position changes', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, base, t)
    const first = toastHost()
    expect(first.style.bottom).toBe('16px')
    notifyEvent({ kind: 'turn', sessionId: 's2' }, { ...base, toastPosition: 'top-right' }, t)
    expect(toastHost()).toBe(first)
    expect(first.style.top).toBe('16px')
    expect(first.style.bottom).toBe('')
  })

  it('honors the configured toast duration', async () => {
    vi.useFakeTimers()
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, toastSeconds: 3 }, t)
    expect(toastHost().children).toHaveLength(1)
    vi.advanceTimersByTime(2999)
    expect(toastHost().children).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastHost().children).toHaveLength(0)
  })

  it('clamps out-of-range durations to the 3–15 second band', async () => {
    vi.useFakeTimers()
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, toastSeconds: 99 }, t)
    vi.advanceTimersByTime(14_999)
    expect(toastHost().children).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastHost().children).toHaveLength(0)
  })

  it('keeps toasts for 5 seconds when no duration is set', async () => {
    vi.useFakeTimers()
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, base, t)
    vi.advanceTimersByTime(4_999)
    expect(toastHost().children).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastHost().children).toHaveLength(0)
  })
})

describe('sound modes', () => {
  it('plays a custom sound through an Audio element with clamped volume', async () => {
    vi.stubGlobal('Audio', MockAudio)
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'turn', sessionId: 's1' },
      { ...base, sound: 'custom', soundUrl: 'https://example.com/ding.mp3', volume: 5 },
      t,
    )
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].src).toBe('https://example.com/ding.mp3')
    expect(MockAudio.instances[0].volume).toBe(1)
  })

  it('falls back to the built-in tone when the custom URL is empty', async () => {
    vi.stubGlobal('Audio', MockAudio)
    const { notifyEvent } = await import('../src/client/notify.ts')
    expect(() =>
      notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, sound: 'custom', soundUrl: '   ', volume: 0.5 }, t),
    ).not.toThrow()
    expect(MockAudio.instances).toHaveLength(0)
  })

  it('clamps negative volume to silence and junk volume to full', async () => {
    vi.stubGlobal('Audio', MockAudio)
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, sound: 'custom', soundUrl: 'a.mp3', volume: -3 }, t)
    notifyEvent(
      { kind: 'turn', sessionId: 's2' },
      { ...base, sound: 'custom', soundUrl: 'b.mp3', volume: Number.NaN },
      t,
    )
    expect(MockAudio.instances.map((audio) => audio.volume)).toEqual([0, 1])
  })

  it('no-ops quietly for built-in tones without Web Audio support', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    expect(() =>
      notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, sound: 'single', volume: 0.7 }, t),
    ).not.toThrow()
    expect(() =>
      notifyEvent({ kind: 'turn', sessionId: 's2' }, { ...base, sound: 'double', volume: 0.7 }, t),
    ).not.toThrow()
    expect(MockAudio.instances).toHaveLength(0)
  })

  it('plays nothing when the sound mode is off', async () => {
    vi.stubGlobal('Audio', MockAudio)
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { ...base, sound: 'off', soundUrl: 'x.mp3' }, t)
    expect(MockAudio.instances).toHaveLength(0)
  })
})
