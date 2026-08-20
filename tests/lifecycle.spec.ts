/**
 * Lifecycle mapping tests: SessionListState → SnapshotView, end-to-end diff,
 * review transitions, failure classification, and event deduplication.
 */
import { describe, expect, it } from 'vitest'
import { diffCompletions, toSnapshotView } from '../src/detect.ts'

function list(byId: Record<string, unknown>, jobsBySession: Record<string, unknown[]> = {}) {
  return { byId, jobsBySession } as never
}

describe('toSnapshotView', () => {
  it('maps sessions and jobs into the minimal view', () => {
    const view = toSnapshotView(list(
      { a: { running: true, displayTitle: 'Build' }, b: { running: false } },
      { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }] },
    ))
    expect(view.sessions.a).toEqual({ running: true, title: 'Build' })
    expect(view.sessions.b).toEqual({ running: false })
    expect(view.jobs.a).toEqual([{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }])
  })

  it('omits undefined optional fields', () => {
    const view = toSnapshotView(list({ a: { running: false } }))
    expect(view.sessions.a).toEqual({ running: false })
    expect('title' in view.sessions.a).toBe(false)
    expect('pendingInteraction' in view.sessions.a).toBe(false)
  })
})

describe('lifecycle end-to-end', () => {
  it('emits turn, review and job events together from real-shaped snapshots', () => {
    const before = toSnapshotView(list(
      { a: { running: true, displayTitle: 'Deploy' } },
      { a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'running' }] },
    ))
    const after = toSnapshotView(list(
      { a: { running: false, displayTitle: 'Deploy', pendingInteraction: 'approval' } },
      { a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' }] },
    ))
    expect(diffCompletions(before, after)).toEqual([
      { kind: 'turn', sessionId: 'a', title: 'Deploy' },
      { kind: 'review', sessionId: 'a', pending: 'approval', title: 'Deploy' },
      { kind: 'job', sessionId: 'a', job: { id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' } },
    ])
  })
})

describe('review lifecycle', () => {
  it('appears, persists, and resolves without duplicate events', () => {
    const s0 = toSnapshotView(list({ a: { running: true, displayTitle: 'Deploy' } }))
    const s1 = toSnapshotView(list({ a: { running: true, displayTitle: 'Deploy', pendingInteraction: 'question' } }))
    const s2 = toSnapshotView(list({ a: { running: true, displayTitle: 'Deploy', pendingInteraction: 'question' } }))
    const s3 = toSnapshotView(list({ a: { running: true, displayTitle: 'Deploy' } }))
    expect(diffCompletions(s0, s1)).toEqual([
      { kind: 'review', sessionId: 'a', pending: 'question', title: 'Deploy' },
    ])
    expect(diffCompletions(s1, s2)).toEqual([])
    expect(diffCompletions(s2, s3)).toEqual([])
  })

  it('does not re-fire when pending switches between review kinds', () => {
    const s0 = toSnapshotView(list({ a: { running: true, pendingInteraction: 'approval' } }))
    const s1 = toSnapshotView(list({ a: { running: true, pendingInteraction: 'plan-review' } }))
    expect(diffCompletions(s0, s1)).toEqual([])
  })
})

describe('failure classification', () => {
  it('emits failure-classified job events (failed and killed)', () => {
    const before = toSnapshotView(list(
      { a: { running: true, displayTitle: 'Deploy' } },
      { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: 'running' }] },
    ))
    for (const status of ['failed', 'killed'] as const) {
      const after = toSnapshotView(list(
        { a: { running: false, displayTitle: 'Deploy' } },
        { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status }] },
      ))
      const events = diffCompletions(before, after)
      expect(events).toContainEqual({ kind: 'turn', sessionId: 'a', title: 'Deploy' })
      expect(events).toContainEqual({ kind: 'job', sessionId: 'a', job: { id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status } })
    }
  })
})

describe('deduplication', () => {
  it('emits nothing for consecutive identical snapshots', () => {
    const snap = toSnapshotView(list(
      { a: { running: false, displayTitle: 'Done' } },
      { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' }] },
    ))
    expect(diffCompletions(snap, snap)).toEqual([])
  })

  it('does not re-fire a job that was already settled', () => {
    const prev = toSnapshotView(list({}, { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' }] }))
    const next = toSnapshotView(list({}, { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' }] }))
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('does not re-fire a running job that stays running', () => {
    const prev = toSnapshotView(list({}, { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }] }))
    const next = toSnapshotView(list({}, { a: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }] }))
    expect(diffCompletions(prev, next)).toEqual([])
  })
})
