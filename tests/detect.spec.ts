/**
 * Unit tests for the pure completion detector (diffCompletions).
 * Plain-data only: no DOM, no SDK values, no module loader.
 */
import { describe, expect, it } from 'vitest'
import { diffCompletions, type SnapshotView } from '../src/detect.ts'

type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'

interface JobInput { id: string; kind: string; label: string; status: JobStatus }

function view(
  sessions: Record<string, { running: boolean; title?: string }>,
  jobs: Record<string, JobInput[]> = {},
): SnapshotView {
  return { sessions, jobs }
}

describe('diffCompletions', () => {
  it('yields nothing on the first observation (null previous)', () => {
    const next = view({ a: { running: false } })
    expect(diffCompletions(null, next)).toEqual([])
  })

  it('detects a turn finishing (running true -> false)', () => {
    const prev = view({ a: { running: true, title: 'Build feature' } })
    const next = view({ a: { running: false, title: 'Build feature' } })
    expect(diffCompletions(prev, next)).toEqual([
      { kind: 'turn', sessionId: 'a', title: 'Build feature' },
    ])
  })

  it('does not re-fire a turn that was already finished', () => {
    const prev = view({ a: { running: false } })
    const next = view({ a: { running: false } })
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('does not fire for a brand-new session that is not running', () => {
    const prev = view({})
    const next = view({ a: { running: false } })
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('detects a background job settling to each terminal status', () => {
    const running = [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' as const }]
    for (const status of ['completed', 'failed', 'killed'] as const) {
      const prev = view({}, { s: running })
      const next = view({}, { s: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status }] })
      expect(diffCompletions(prev, next)).toEqual([
        { kind: 'job', sessionId: 's', job: { id: 'pwsh-1', kind: 'pwsh', label: 'ls', status } },
      ])
    }
  })

  it('detects a job moving from stopping to completed', () => {
    const prev = view({}, { s: [{ id: 'subagent-1', kind: 'subagent', label: 'research', status: 'stopping' }] })
    const next = view({}, { s: [{ id: 'subagent-1', kind: 'subagent', label: 'research', status: 'completed' }] })
    expect(diffCompletions(prev, next)).toHaveLength(1)
  })

  it('does not fire for a job that is still live', () => {
    const prev = view({}, { s: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'running' }] })
    const next = view({}, { s: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'stopping' }] })
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('does not fire for a job that appears already settled', () => {
    const prev = view({}, {})
    const next = view({}, { s: [{ id: 'pwsh-1', kind: 'pwsh', label: 'ls', status: 'completed' }] })
    expect(diffCompletions(prev, next)).toEqual([])
  })

  it('tracks jobs per session by stable id', () => {
    const prev = view({}, {
      s1: [{ id: 'pwsh-1', kind: 'pwsh', label: 'a', status: 'running' }],
      s2: [{ id: 'pwsh-1', kind: 'pwsh', label: 'b', status: 'running' }],
    })
    const next = view({}, {
      s1: [{ id: 'pwsh-1', kind: 'pwsh', label: 'a', status: 'completed' }],
      s2: [{ id: 'pwsh-1', kind: 'pwsh', label: 'b', status: 'running' }],
    })
    const events = diffCompletions(prev, next)
    expect(events).toEqual([
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-1', kind: 'pwsh', label: 'a', status: 'completed' } },
    ])
  })

  it('combines turn and job completions in one diff', () => {
    const prev = view(
      { a: { running: true } },
      { a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'running' }] },
    )
    const next = view(
      { a: { running: false } },
      { a: [{ id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' }] },
    )
    const events = diffCompletions(prev, next)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ kind: 'turn', sessionId: 'a' })
    expect(events[1]).toEqual({ kind: 'job', sessionId: 'a', job: { id: 'subagent-1', kind: 'subagent', label: 'delegate', status: 'completed' } })
  })
})
