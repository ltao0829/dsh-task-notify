/**
 * Linux host notification backend and settings bridge tests.
 */
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { en } from '../src/client/locales.ts'
import { notifyEvent } from '../src/client/notify.ts'
import { getSettings, setSetting } from '../src/client/settings.ts'

interface SpawnCall {
  cmd: string
  args: string[]
  child: EventEmitter
}

const spawnCalls: SpawnCall[] = []
let nextSpawnError: Error | undefined

const spawnMock = vi.fn((cmd: string, args: string[]) => {
  if (nextSpawnError !== undefined && cmd === 'notify-send') {
    const err = nextSpawnError
    nextSpawnError = undefined
    const child = new EventEmitter()
    spawnCalls.push({ cmd, args, child })
    queueMicrotask(() => child.emit('error', err))
    return child
  }
  const child = new EventEmitter()
  spawnCalls.push({ cmd, args, child })
  return child
})

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

interface RouteSpec {
  path: string
  methods: string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}

interface HostHarness {
  emit: (event: string, ...args: unknown[]) => void
  route: RouteSpec | undefined
  titles: Map<object, { title?: string }>
}

async function setupHost(withConnection = true): Promise<HostHarness> {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const titles = new Map<object, { title?: string }>()
  let registered: RouteSpec | undefined

  const ctx = {
    on(event: string, fn: (...args: unknown[]) => void) {
      const list = listeners.get(event) ?? []
      list.push(fn)
      listeners.set(event, list)
    },
    get(service: string) {
      if (service === 'sessionTitle') {
        return { get: (session: object) => titles.get(session) }
      }
      if (service === 'connection' && withConnection) {
        return {
          fetch: {
            register(route: RouteSpec) {
              registered = route
              return async () => {}
            },
          },
        }
      }
      return undefined
    },
    effect(fn: () => unknown) {
      fn()
    },
  }

  const { apply } = await import('../src/index.ts')
  apply(ctx as never)
  return {
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args)
    },
    get route() {
      return registered
    },
    titles,
  }
}

async function postSettings(route: RouteSpec, body: unknown, rawBody?: string): Promise<Response> {
  const req = new Request('http://localhost/api/task-notify/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody ?? JSON.stringify(body),
  })
  return route.fetch(req)
}

describe('Linux host notification backend', () => {
  const realPlatform = process.platform

  beforeEach(() => {
    spawnCalls.length = 0
    nextSpawnError = undefined
    spawnMock.mockClear()
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true })
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('no-ops on non-Linux platforms and stub contexts without hooks', async () => {
    const { apply } = await import('../src/index.ts')
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const registered = vi.fn()
    apply({ on: registered, get: vi.fn() } as never)
    expect(registered).not.toHaveBeenCalled()

    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    expect(() => apply({} as never)).not.toThrow()
    expect(spawnCalls).toHaveLength(0)
  })

  it('handles settings bridge POST 200, sanitization, and 400 on malformed/non-object bodies', async () => {
    const host = await setupHost()
    expect(host.route?.path).toBe('/api/task-notify/settings')

    const badJson = await postSettings(host.route!, null, '{not-json')
    expect(badJson.status).toBe(400)

    const badArray = await postSettings(host.route!, [1, 2, 3])
    expect(badArray.status).toBe(400)

    const badNull = await postSettings(host.route!, null)
    expect(badNull.status).toBe(400)

    const good = await postSettings(host.route!, {
      lang: 'zh',
      settings: {
        enabled: true,
        turn: true,
        quietEnabled: false,
        quietFrom: 'not-a-clock',
        mutedSessions: ['s-muted', 123],
      },
    })
    expect(good.status).toBe(200)

    const session = { id: 's-1', header: { cwd: '/tmp/work' } }
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].cmd).toBe('notify-send')
    expect(spawnCalls[0].args).toEqual(['-a', 'dsh', '-t', '6000', '任务已完成', 'work'])

    // Muted session is suppressed despite invalid string filter preserving only 's-muted'.
    const mutedSession = { id: 's-muted', header: { cwd: '/tmp/other' } }
    host.emit('agent/status', { agent: { session: mutedSession }, status: 'running' })
    host.emit('agent/status', { agent: { session: mutedSession }, status: 'idle' })
    expect(spawnCalls).toHaveLength(1)
  })

  it('tracks agent/status, agent/disposed, agent/error, and subagent filtering', async () => {
    const host = await setupHost(false)
    const sMain = { id: 'main-1', header: { cwd: '/tmp/repo' } }
    host.titles.set(sMain, { title: 'Fix Linux notify' })

    // Initial idle without prior running is ignored.
    host.emit('agent/status', { agent: { session: sMain }, status: 'idle' })
    expect(spawnCalls).toHaveLength(0)

    // Disposed while running clears baseline so a trailing idle does not notify.
    host.emit('agent/status', { agent: { session: sMain }, status: 'running' })
    host.emit('agent/disposed', { agent: { session: sMain } })
    host.emit('agent/status', { agent: { session: sMain }, status: 'idle' })
    expect(spawnCalls).toHaveLength(0)

    // Subagent turn and error are ignored.
    const sSub = { id: 'sub-1', header: { origin: 'subagent' as const } }
    host.emit('agent/status', { agent: { session: sSub }, status: 'running' })
    host.emit('agent/status', { agent: { session: sSub }, status: 'idle' })
    host.emit('agent/error', { agent: { session: sSub }, error: new Error('sub fail') })
    expect(spawnCalls).toHaveLength(0)

    // Main session error truncates long error messages to 160 chars.
    const longMsg = 'x'.repeat(200)
    host.emit('agent/error', { agent: { session: sMain }, error: new Error(longMsg) })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].args).toEqual([
      '-a',
      'dsh',
      '-t',
      '6000',
      'Task failed',
      `Fix Linux notify · ${'x'.repeat(160)}`,
    ])
  })

  it('notifies job/settled events and respects allSessions on subagent sessions', async () => {
    const host = await setupHost()
    const main = { id: 's-main', header: { cwd: '/tmp/app' } }
    const sub = { id: 's-sub', header: { origin: 'subagent' as const } }

    host.emit('session/event', main, {
      type: 'job/settled',
      data: { owner: 's-main', kind: 'bash', label: 'npm test', status: 'completed' },
    })
    host.emit('session/event', main, {
      type: 'job/settled',
      data: { owner: 's-main', kind: 'bash', label: 'lint', status: 'failed' },
    })
    host.emit('session/event', main, {
      type: 'job/settled',
      data: { owner: 's-main', kind: 'bash', label: '', status: 'killed' },
    })
    expect(spawnCalls.map((c) => [c.args[4], c.args[5]])).toEqual([
      ['Background job finished', 'bash: npm test'],
      ['Background job failed', 'bash: lint'],
      ['Background job was killed', 'bash'],
    ])

    // Subagent job/settled is suppressed unless allSessions is true.
    host.emit('session/event', sub, {
      type: 'job/settled',
      data: { owner: 's-sub', kind: 'subagent', label: 'worker', status: 'completed' },
    })
    expect(spawnCalls).toHaveLength(3)

    await postSettings(host.route!, { settings: { allSessions: true } })
    host.emit('session/event', sub, {
      type: 'job/settled',
      data: { owner: 's-sub', kind: 'subagent', label: 'worker', status: 'completed' },
    })
    expect(spawnCalls).toHaveLength(4)
  })

  it('supports quiet hours (daytime, overnight, equal bounds), toggles, and custom templates', async () => {
    vi.useFakeTimers()
    const host = await setupHost()
    const session = { id: 's-q', header: { cwd: '/tmp/proj' } }

    // Overnight quiet hours 22:00 - 08:00: 23:30 is suppressed, 09:00 fires.
    await postSettings(host.route!, {
      settings: {
        quietEnabled: true,
        quietFrom: '22:00',
        quietTo: '08:00',
        templateTitle: '[{kind}] {title}',
        templateBody: 'Session={session}',
      },
    })
    vi.setSystemTime(new Date(2026, 9, 2, 23, 30, 0))
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(0)

    vi.setSystemTime(new Date(2026, 9, 2, 9, 0, 0))
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].args.slice(4)).toEqual(['[Turn finished] proj', 'Session=s-q'])

    // Equal quiet bounds (08:00 - 08:00) treat quiet window as disabled, matching client.
    await postSettings(host.route!, {
      settings: { quietEnabled: true, quietFrom: '08:00', quietTo: '08:00' },
    })
    vi.setSystemTime(new Date(2026, 9, 2, 8, 0, 0))
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(2)

    // Daytime quiet window 12:00 - 14:00 suppresses 13:00; browser: false and enabled: false suppress.
    await postSettings(host.route!, {
      settings: { quietEnabled: true, quietFrom: '12:00', quietTo: '14:00' },
    })
    vi.setSystemTime(new Date(2026, 9, 2, 13, 0, 0))
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(2)

    await postSettings(host.route!, { settings: { browser: false } })
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(2)

    await postSettings(host.route!, { settings: { enabled: false, browser: true } })
    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    expect(spawnCalls).toHaveLength(2)
  })

  it('falls back to gdbus D-Bus call when notify-send emits ENOENT', async () => {
    const enoent = Object.assign(new Error('spawn notify-send ENOENT'), { code: 'ENOENT' })
    nextSpawnError = enoent
    const host = await setupHost()
    const session = { id: 's-dbus', header: { cwd: '/tmp/dbus' } }

    host.emit('agent/status', { agent: { session }, status: 'running' })
    host.emit('agent/status', { agent: { session }, status: 'idle' })
    await Promise.resolve()

    expect(spawnCalls.map((c) => c.cmd)).toEqual(['notify-send', 'gdbus'])
    expect(spawnCalls[1].args).toContain('org.freedesktop.Notifications.Notify')
    expect(spawnCalls[1].args).toContain('Turn finished')
    expect(spawnCalls[1].args).toContain('dbus')
  })

  it('pushes client setSetting updates to /api/task-notify/settings and suppresses browser Notification on Linux desktop', () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    setSetting('toastSeconds', 9)
    expect(getSettings().toastSeconds).toBe(9)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/task-notify/settings')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body)).settings.toastSeconds).toBe(9)

    const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
    const created: Array<{ title: string; body: string }> = []
    class MockNotification {
      static permission = 'granted'
      constructor(title: string, opts?: { body?: string }) {
        created.push({ title, body: opts?.body ?? '' })
      }
    }

    vi.stubGlobal('window', dom.window)
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('navigator', {
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    })
    vi.stubGlobal('Notification', MockNotification)

    const t = ((key: keyof typeof en) => en[key]) as never
    notifyEvent({ kind: 'turn', sessionId: 's-1', title: 'Task A' }, { browser: true, sound: 'off' }, t)

    // In-page toast still renders, while OS browser Notification is suppressed on Linux desktop.
    expect(dom.window.document.querySelector('[data-task-notify-toasts]')?.children.length).toBe(1)
    expect(created).toHaveLength(0)
  })
})