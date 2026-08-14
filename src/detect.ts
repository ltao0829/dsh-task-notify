/**
 * Pure completion detection — maps the sessions-list store into a minimal view
 * and diffs two consecutive views into "completion events". No DOM, no SDK
 * values: the view is plain data so this module unit-tests without a loader.
 * @module @linxin666/dsh-task-notify/detect
 */

import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'

/** Job lifecycle states as seen on the wire. */
export type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'

/** Minimal per-session view (only what the detector needs). */
export interface SessionRowView {
  running: boolean
  title?: string
}

/** Minimal per-job view (only what the detector needs). */
export interface JobRowView {
  /** Registry-issued stable identity (`<kind>-N`). */
  id: string
  kind: string
  label: string
  status: JobStatus
}

/** A complete snapshot of every session and their background jobs. */
export interface SnapshotView {
  sessions: Record<string, SessionRowView>
  jobs: Record<string, JobRowView[]>
}

/** One settled transition observed between two snapshots. */
export type CompletionEvent =
  | { kind: 'turn'; sessionId: string; title?: string }
  | { kind: 'job'; sessionId: string; job: JobRowView }

/** Job states that count as "finished". */
const SETTLED: ReadonlySet<JobStatus> = new Set(['completed', 'killed', 'failed'])

/**
 * Map the runtime's SessionListState into the minimal detector view.
 * @param list - the sessions-list snapshot.
 * @returns the plain view.
 */
export function toSnapshotView(list: SessionListState): SnapshotView {
  const sessions: Record<string, SessionRowView> = {}
  for (const [id, row] of Object.entries(list.byId)) {
    sessions[id] = {
      running: row.running,
      ...(row.displayTitle === undefined ? {} : { title: row.displayTitle }),
    }
  }
  const jobs: Record<string, JobRowView[]> = {}
  for (const [sessionId, rows] of Object.entries(list.jobsBySession)) {
    jobs[sessionId] = rows.map((job) => ({
      id: job.id,
      kind: job.kind,
      label: job.label,
      status: job.status,
    }))
  }
  return { sessions, jobs }
}

/**
 * Diff two snapshots into the completions that happened between them.
 * A null previous snapshot (the first observation) yields nothing so that a
 * page load never fires reminders for every historically-settled task.
 * @param prev - the previous snapshot, or null on the first observation.
 * @param next - the latest snapshot.
 * @returns newly-settled turns and jobs, in stable iteration order.
 */
export function diffCompletions(prev: SnapshotView | null, next: SnapshotView): CompletionEvent[] {
  if (prev === null) return []
  const events: CompletionEvent[] = []
  for (const [sessionId, row] of Object.entries(next.sessions)) {
    const before = prev.sessions[sessionId]
    if (before !== undefined && before.running && !row.running) {
      events.push({ kind: 'turn', sessionId, ...(row.title === undefined ? {} : { title: row.title }) })
    }
  }
  for (const [sessionId, jobs] of Object.entries(next.jobs)) {
    const prevJobs = prev.jobs[sessionId] ?? []
    const prevById = new Map(prevJobs.map((job) => [job.id, job]))
    for (const job of jobs) {
      const before = prevById.get(job.id)
      if (before !== undefined && !SETTLED.has(before.status) && SETTLED.has(job.status)) {
        events.push({ kind: 'job', sessionId, job })
      }
    }
  }
  return events
}
