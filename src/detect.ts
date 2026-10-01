/**
 * Pure detection — folds the three DSH 0.2 client sources (the Session
 * Controller list, the ui-session status snapshot, and the job-controller
 * roster snapshot) into one minimal view, then diffs two consecutive views into
 * completion events.
 *
 * No DOM, no React, no loader: the view is plain data, so this module
 * unit-tests without a running Client.
 * @module @ltao0829/dsh-task-notify/detect
 */

import type { JobsSnapshot, JobView } from '@deepseek-ai/dsh-api-job-controller/client'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'

/** Job lifecycle states as seen on the wire. */
export type JobStatus = JobView['status']

/** One pending interaction reduced to the two facts a reminder needs. */
export interface PendingView {
  /** Opaque request identity; a replacement request uses a new key. */
  key: string
  /** Domain-owned discriminator (`approval`, `plan-review`, `question`, …). */
  kind: string
}

/** Minimal per-session view (only what the detector needs). */
export interface SessionRowView {
  running: boolean
  title?: string
  pending?: PendingView
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

/** One transition observed between two snapshots. */
export type CompletionEvent =
  | { kind: 'turn'; sessionId: string; title?: string }
  | { kind: 'job'; sessionId: string; job: JobRowView }
  | { kind: 'review'; sessionId: string; pending: string; title?: string }
  | { kind: 'failure'; sessionId: string; title?: string; message: string }

/** Job states that count as "finished". */
const SETTLED: ReadonlySet<JobStatus> = new Set(['completed', 'killed', 'failed'])

/**
 * Whether a job lifecycle state is terminal.
 * @param status - wire job status.
 * @returns true for `completed`, `killed`, and `failed`.
 */
export function isSettled(status: JobStatus): boolean {
  return SETTLED.has(status)
}

/** Re-key the branded status map so plain session-id strings can read it. */
function statusByStringKey(status: SessionStatusSnapshot): Map<string, { running?: boolean; pending?: PendingView }> {
  const out = new Map<string, { running?: boolean; pending?: PendingView }>()
  for (const [id, value] of status) {
    const pending = value.pendingInteraction
    out.set(id, {
      ...(value.running === undefined ? {} : { running: value.running }),
      ...(pending === undefined ? {} : { pending: { key: pending.key, kind: pending.kind } }),
    })
  }
  return out
}

/**
 * Map the three runtime sources into the minimal detector view.
 *
 * `SessionStatus` wins over the list row wherever it has an opinion: it is the
 * live Client projection, while `SessionSummary.running` is the Host baseline
 * that status events update.
 * @param list - the Session Controller list snapshot.
 * @param status - the `uiSession.sessionStatus` snapshot.
 * @param jobs - the job-controller roster snapshot.
 * @returns the plain view.
 */
export function toSnapshotView(
  list: SessionListState,
  status: SessionStatusSnapshot,
  jobs: JobsSnapshot,
): SnapshotView {
  const live = statusByStringKey(status)
  const sessions: Record<string, SessionRowView> = {}
  for (const [id, row] of Object.entries(list.byId) as [string, SessionSummary][]) {
    const observed = live.get(id)
    const pending = observed?.pending
    sessions[id] = {
      running: observed?.running ?? row.running,
      ...(row.displayTitle === undefined ? {} : { title: row.displayTitle }),
      ...(pending === undefined ? {} : { pending }),
    }
  }
  const jobsBySession: Record<string, JobRowView[]> = {}
  for (const [sessionId, rows] of Object.entries(jobs.rows) as [string, readonly JobView[]][]) {
    jobsBySession[sessionId] = rows.map((job) => ({
      id: job.id,
      kind: job.kind,
      label: job.label,
      status: job.status,
    }))
  }
  return { sessions, jobs: jobsBySession }
}

/**
 * Diff two snapshots into the events that happened between them.
 *
 * A null previous snapshot (the first observation) yields nothing, so a page
 * load never fires reminders for every historically-settled task. A session or
 * job first seen in `next` is likewise treated as pre-existing and silent.
 * @param prev - the previous snapshot, or null on the first observation.
 * @param next - the latest snapshot.
 * @returns newly-settled turns, jobs, and pending reviews.
 */
export function diffCompletions(prev: SnapshotView | null, next: SnapshotView): CompletionEvent[] {
  if (prev === null) return []
  const events: CompletionEvent[] = []
  for (const [sessionId, row] of Object.entries(next.sessions)) {
    const before = prev.sessions[sessionId]
    if (before === undefined) continue
    if (before.running && !row.running) {
      events.push({ kind: 'turn', sessionId, ...(row.title === undefined ? {} : { title: row.title }) })
    }
    // A pending interaction is identified by its opaque request key, so a
    // replacement request (approval followed by a question) fires again while a
    // reconnect replay of the same request stays silent.
    const pending = row.pending
    if (pending !== undefined && pending.key !== before.pending?.key) {
      events.push({
        kind: 'review',
        sessionId,
        pending: pending.kind,
        ...(row.title === undefined ? {} : { title: row.title }),
      })
    }
  }
  for (const [sessionId, jobs] of Object.entries(next.jobs)) {
    const prevById = new Map((prev.jobs[sessionId] ?? []).map((job) => [job.id, job]))
    for (const job of jobs) {
      const before = prevById.get(job.id)
      if (before !== undefined && !SETTLED.has(before.status) && SETTLED.has(job.status)) {
        events.push({ kind: 'job', sessionId, job })
      }
    }
  }
  return events
}
