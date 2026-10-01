// @vitest-environment jsdom
/**
 * Client-half integration tests: drives `apply(ctx)` against a fake Cordis
 * client context built from the three real source shapes.
 *
 * This is the seat that regressed before (the 0.1.1 `settings.plugin.item`
 * keyed-slot bug shipped because nothing exercised `apply`), so it asserts both
 * the registrations and the watcher's end-to-end behavior.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

/** Minimal observable source with a test-only `set`. */
function source<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: (): T => value,
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    set(next: T): void {
      value = next
      for (const fn of [...listeners]) fn()
    },
  }
}

/** Build a `SessionListState`-shaped snapshot. */
function listState(rows: Record<string, { running: boolean; displayTitle?: string }>) {
  const byId: Record<string, unknown> = {}
  for (const [id, row] of Object.entries(rows)) {
    byId[id] = {
      id,
      displayTitle: row.displayTitle ?? id,
      running: row.running,
      retainedBy: {},
      blank: false,
      updatedAt: 0,
    }
  }
  return { ids: Object.keys(rows), byId, phase: 'ready', projectionsBySession: {} }
}

/** Build a `SessionStatusSnapshot`-shaped map. */
function statusState(entries: Record<string, { running?: boolean; pending?: { key: string; kind: string } }> = {}) {
  const map = new Map<string, unknown>()
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, {
      running: value.running,
      pendingInteraction: value.pending === undefined ? undefined : { ...value.pending, sessionId: id },
      completionUnread: false,
    })
  }
  return map
}

function createHarness() {
  const list = source(listState({}))
  const sessionStatus = source(statusState())
  const jobState = source({ rows: {}, observed: {} } as { rows: Record<string, unknown>; observed: Record<string, unknown> })

  const effectCallbacks: Array<() => unknown> = []
  const effects: string[] = []
  const registrations: Array<Record<string, unknown>> = []
  const injections: string[] = []
  const dictionaries: Array<{ ns: string; locales: string[] }> = []
  const jobWatchers = new Map<string, ReturnType<typeof vi.fn>>()

  const ctx = {
    effect: (callback: () => unknown, label?: string) => {
      effectCallbacks.push(callback)
      effects.push(label ?? '')
    },
    locale: {
      register: (ns: string, dicts: Record<string, unknown>) => {
        dictionaries.push({ ns, locales: Object.keys(dicts) })
        return () => {}
      },
      bind: (ns: string) => (key: string) => `${ns}:${key}`,
    },
    slots: {
      inject: (key: string, callback: () => unknown) => {
        injections.push(key)
        callback()
        return () => {}
      },
      register: (options: Record<string, unknown>) => {
        registrations.push(options)
        return () => {}
      },
    },
    sessions: {
      list,
      binding: () => undefined,
    },
    uiSession: { sessionStatus },
    jobs: {
      state: jobState,
      watchRows: (id: string) => {
        const stop = vi.fn()
        jobWatchers.set(id, stop)
        return stop
      },
    },
  }

  // Run every registered effect and collect its disposer (the effect body
  // returns the teardown function).
  const start = (): Array<() => void> => effectCallbacks.map((callback) => {
    const disposer = callback()
    return typeof disposer === 'function' ? disposer as () => void : () => {}
  })

  return { ctx, list, sessionStatus, jobState, start, registrations, injections, dictionaries, jobWatchers, effects }
}

function toastText(): string {
  return document.querySelector('[data-task-notify-toasts]')?.textContent ?? ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.querySelectorAll('[data-task-notify-toasts]').forEach((node) => node.remove())
  localStorage.clear()
})

describe('client inject surface', () => {
  it('declares the services the DSH 0.2 data sources live on', () => {
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'uiSession', 'jobs'])
  })
})

describe('apply(ctx)', () => {
  it('registers the dictionaries for both shipped locales', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    // `ctx.effect` defers the body until the fiber mounts.
    expect(harness.dictionaries).toEqual([])
    harness.start()
    expect(harness.dictionaries).toEqual([{ ns: 'task-notify', locales: ['zh', 'en'] }])
    expect(harness.effects).toContain('task-notify: dictionaries')
  })

  it('registers the settings page into the DSH 0.2 Plugins tab seat', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    expect(harness.injections).toEqual(['settings.plugins.tab'])
    expect(harness.registrations).toHaveLength(1)
    const registration = harness.registrations[0]
    expect(registration.name).toBe('settings.plugins.tab')
    expect(registration.id).toBe('task-notify')
    expect(registration.locale).toBe('task-notify')
    expect(typeof registration.label).toBe('function')
    expect((registration.label as () => string)()).toBe('task-notify:settings.title')
  })

  it('does not touch the retired settings.plugin.item seat', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    expect(harness.injections).not.toContain('settings.plugin.item')
  })

  it('establishes a silent baseline and then reminds on a finished turn', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    harness.start()

    harness.list.set(listState({ a: { running: true, displayTitle: 'Deploy' } }))
    expect(toastText()).toBe('')

    harness.list.set(listState({ a: { running: false, displayTitle: 'Deploy' } }))
    expect(toastText()).toContain('task-notify:event.turn')
    expect(toastText()).toContain('Deploy')
  })

  it('reminds when a pending interaction appears on the status projection', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    harness.start()

    const rows = listState({ a: { running: true, displayTitle: 'Deploy' } })
    harness.list.set(rows)
    harness.sessionStatus.set(statusState({ a: { running: true, pending: { key: 'req-1', kind: 'approval' } } }))
    expect(toastText()).toContain('task-notify:event.review')
    expect(toastText()).toContain('task-notify:review.approval')
  })

  it('opens a job stream for a session once it is observed running, and releases it on teardown', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    const disposers = harness.start()

    harness.list.set(listState({ a: { running: true } }))
    expect([...harness.jobWatchers.keys()]).toEqual(['a'])

    for (const dispose of disposers) dispose()
    expect(harness.jobWatchers.get('a')).toHaveBeenCalledTimes(1)
  })

  it('stops reminding after teardown', () => {
    const harness = createHarness()
    apply(harness.ctx as never)
    const disposers = harness.start()

    harness.list.set(listState({ a: { running: true, displayTitle: 'Deploy' } }))
    harness.list.set(listState({ a: { running: false, displayTitle: 'Deploy' } }))
    expect(toastText()).toContain('task-notify:event.turn')

    for (const dispose of disposers) dispose()
    document.querySelectorAll('[data-task-notify-toasts]').forEach((node) => node.remove())
    harness.list.set(listState({ a: { running: true, displayTitle: 'Deploy' } }))
    harness.list.set(listState({ a: { running: false, displayTitle: 'Deploy' } }))
    expect(toastText()).toBe('')
  })
})
