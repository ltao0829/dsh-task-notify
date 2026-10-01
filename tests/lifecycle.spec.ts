/**
 * Lifecycle mapping tests: the three DSH 0.2 client sources
 * (SessionListState + SessionStatusSnapshot + JobsSnapshot) → SnapshotView,
 * end-to-end diff, review transitions, failure classification, and event
 * deduplication.
 */
import { describe, expect, it } from 'vitest'
import { diffCompletions, toSnapshotView } from '../src/detect.ts'

type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'

interface SessionInput { running: boolean; displayTitle?: string }

/** Build a real-shaped `SessionListState` (only the fields the detector reads). */
function list(byId: Record<string, SessionInput>) {
  const rows: Record<string, unknown> = {}
  for (const [id, row] of Object.entries(byId)) {
    rows[id] = {
      id,
      displayTitle: row.displayTitle ?? id,
      running: row.running,
      retainedBy: {},
      blank: false,
      updatedAt: 0,
    }
  }
  return { ids: Object.keys(byId), byId: rows, phase: 'ready', projectionsBySession: {} } as never
}

/** Build a real-shaped `SessionStatusSnapshot`. */
function status(entries: Record<string, { running?: boolean; pending?: { key: string; kind: string } }>) {
  const map = new Map<string, unknown>()
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, {
      running: value.running,
      pendingInteraction: value.pending === undefined ? undefined : { ...value.pending, sessionId: id },
      completionUnread: false,
    })
  }
  return map as never
}

/** Build a real-shaped `JobsSnapshot`. */
function jobs(rows: Record<string, { id: string; kind: string; label: string; status: JobStatus }[]>) {
  return { rows, observed: {} } as never
}

describe('toSnapshotView', () => {
  it('maps sessions and jobs into the minimal view', () => {
    const view = toSnapshotView(
      list({ a: { running: true, displayTitle: 'Build' }, b: { running: false } }),
      status({}),
      jobs({ a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }] }),
    )
    expect(view.sessions.a).toEqual({ running: true, title: 'Build' })
    expect(view.sessions.b).toEqual({ running: false, title: 'b' })
    expect(view.jobs.a).toEqual([{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }])
  })

  it('omits an absent pending interaction', () => {
    const view = toSnapshotView(list({ a: { running: false, displayTitle: 'Alpha' } }), status({}), jobs({}))
    expect(view.sessions.a).toEqual({ running: false, title: 'Alpha' })
    expect('pending' in view.sessions.a).toBe(false)
  })

  it('lets the live status projection override the Host list baseline', () => {
    const view = toSnapshotView(
      list({ a: { running: true } }),
      status({ a: { running: false } }),
      jobs({}),
    )
    expect(view.sessions.a.running).toBe(false)
  })

  it('falls back to the Host list baseline when status has no opinion', () => {
    const view = toSnapshotView(list({ a: { running: true } }), status({}), jobs({}))
    expect(view.sessions.a.running).toBe(true)
  })

  it('lifts the pending interaction into a key/kind pair', () => {
    const view = toSnapshotView(
      list({ a: { running: true } }),
      status({ a: { running: true, pending: { key: 'req-1', kind: 'approval' } } }),
      jobs({}),
    )
    expect(view.sessions.a.pending).toEqual({ key: 'req-1', kind: 'approval' })
  })

  it('ignores job rosters the watcher is not subscribed to', () => {
    const view = toSnapshotView(list({}), status({}), jobs({}))
    expect(view.jobs).toEqual({})
  })
})

describe('lifecycle end-to-end', () => {
  it('emits turn, review and job events together from real-shaped snapshots', () => {
    const before = toSnapshotView(
      list({ a: { running: true, displayTitle: 'Deploy' } }),
      status({ a: { running: true } }),
      jobs({ a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'running' }] }),
    )
    const after = toSnapshotView(
      list({ a: { running: false, displayTitle: 'Deploy' } }),
      status({ a: { running: false, pending: { key: 'req-1', kind: 'approval' } } }),
      jobs({ a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' }] }),
    )
    expect(diffCompletions(before, after)).toEqual([
      { kind: 'turn', sessionId: 'a', title: 'Deploy' },
      { kind: 'review', sessionId: 'a', pending: 'approval', title: 'Deploy' },
      { kind: 'job', sessionId: 'a', job: { id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' } },
    ])
  })
})

describe('review lifecycle', () => {
  it('appears, persists, and resolves without duplicate events', () => {
    const none = { a: { running: true } }
    const pending = { a: { running: true, pending: { key: 'req-1', kind: 'question' } } }
    const s0 = toSnapshotView(list(none), status(none), jobs({}))
    const s1 = toSnapshotView(list(none), status(pending), jobs({}))
    const s2 = toSnapshotView(list(none), status(pending), jobs({}))
    const s3 = toSnapshotView(list(none), status(none), jobs({}))
    expect(diffCompletions(s0, s1)).toEqual([
      { kind: 'review', sessionId: 'a', pending: 'question', title: 'a' },
    ])
    expect(diffCompletions(s1, s2)).toEqual([])
    expect(diffCompletions(s2, s3)).toEqual([])
  })
})

describe('failure classification', () => {
  it('emits failure-classified job events (failed and killed)', () => {
    const before = toSnapshotView(
      list({ a: { running: true, displayTitle: 'Deploy' } }),
      status({}),
      jobs({ a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: 'running' }] }),
    )
    for (const jobStatus of ['failed', 'killed'] as const) {
      const after = toSnapshotView(
        list({ a: { running: false, displayTitle: 'Deploy' } }),
        status({}),
        jobs({ a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: jobStatus }] }),
      )
      const events = diffCompletions(before, after)
      expect(events).toContainEqual({ kind: 'turn', sessionId: 'a', title: 'Deploy' })
      expect(events).toContainEqual({
        kind: 'job',
        sessionId: 'a',
        job: { id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: jobStatus },
      })
    }
  })
})

describe('deduplication', () => {
  it('emits nothing for consecutive identical snapshots', () => {
    const snap = toSnapshotView(
      list({ a: { running: false, displayTitle: 'Done' } }),
      status({}),
      jobs({ a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' }] }),
    )
    expect(diffCompletions(snap, snap)).toEqual([])
  })

  it('does not re-fire a job that was already settled', () => {
    const settled = { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' as const }] }
    const prev = toSnapshotView(list({}), status({}), jobs(settled))
    const next = toSnapshotView(list({}), status({}), jobs(settled))
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('does not re-fire a running job that stays running', () => {
    const running = { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' as const }] }
    const prev = toSnapshotView(list({}), status({}), jobs(running))
    const next = toSnapshotView(list({}), status({}), jobs(running))
    expect(diffCompletions(prev, next)).toEqual([])
  })
})
