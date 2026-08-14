/**
 * Pure detection — maps the sessions-list store into a minimal view and diffs
 * two consecutive views into events (turn done, job done, review needed).
 * No DOM, no SDK values: the view is plain data so this module unit-tests
 * without a loader.
 * @module @linxin666/dsh-task-notify/detect
 */
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
/** Job lifecycle states as seen on the wire. */
export type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed';
/** The user-action kinds that block a session waiting for review. */
export type ReviewKind = 'approval' | 'plan-review' | 'question';
/** Minimal per-session view (only what the detector needs). */
export interface SessionRowView {
    running: boolean;
    title?: string;
    pendingInteraction?: ReviewKind;
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
    pending: ReviewKind;
    title?: string;
} | {
    kind: 'failure';
    sessionId: string;
    title?: string;
    message: string;
};
/**
 * Map the runtime's SessionListState into the minimal detector view.
 * @param list - the sessions-list snapshot.
 * @returns the plain view.
 */
export declare function toSnapshotView(list: SessionListState): SnapshotView;
/**
 * Diff two snapshots into the events that happened between them.
 * A null previous snapshot (the first observation) yields nothing so that a
 * page load never fires reminders for every historically-settled task.
 * @param prev - the previous snapshot, or null on the first observation.
 * @param next - the latest snapshot.
 * @returns newly-settled turns, jobs, and pending reviews.
 */
export declare function diffCompletions(prev: SnapshotView | null, next: SnapshotView): CompletionEvent[];
//# sourceMappingURL=detect.d.ts.map