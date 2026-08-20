/**
 * Lifecycle mapping tests: SessionListState → SnapshotView, plus an
 * end-to-end diff across a full lifecycle transition.
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
