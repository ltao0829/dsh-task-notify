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
import type { JobsSnapshot, JobView } from '@deepseek-ai/dsh-api-job-controller/client';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
/** Job lifecycle states as seen on the wire. */
export type JobStatus = JobView['status'];
/** One pending interaction reduced to the two facts a reminder needs. */
export interface PendingView {
    /** Opaque request identity; a replacement request uses a new key. */
    key: string;
    /** Domain-owned discriminator (`approval`, `plan-review`, `question`, …). */
    kind: string;
}
/** Minimal per-session view (only what the detector needs). */
export interface SessionRowView {
    running: boolean;
    title?: string;
    pending?: PendingView;
}
/** Minimal per-job view (only what the detector needs). */
export interface JobRowView {
    /** Registry-issued stable identity (`<kind>-N`). */
    id: string;
    kind: string;
    label: string;
    status: JobStatus;
}
/** A complete snapshot of every session and their background jobs. */
export interface SnapshotView {
    sessions: Record<string, SessionRowView>;
    jobs: Record<string, JobRowView[]>;
}
/** One transition observed between two snapshots. */
export type CompletionEvent = {
    kind: 'turn';
    sessionId: string;
    title?: string;
} | {
    kind: 'job';
    sessionId: string;
    job: JobRowView;
} | {
    kind: 'review';
    sessionId: string;
    pending: string;
    title?: string;
} | {
    kind: 'failure';
    sessionId: string;
    title?: string;
    message: string;
};
/**
 * Whether a job lifecycle state is terminal.
 * @param status - wire job status.
 * @returns true for `completed`, `killed`, and `failed`.
 */
export declare function isSettled(status: JobStatus): boolean;
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
export declare function toSnapshotView(list: SessionListState, status: SessionStatusSnapshot, jobs: JobsSnapshot): SnapshotView;
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
export declare function diffCompletions(prev: SnapshotView | null, next: SnapshotView): CompletionEvent[];
//# sourceMappingURL=detect.d.ts.map