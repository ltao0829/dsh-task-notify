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
/** Job states that count as "finished". */
const SETTLED = new Set(['completed', 'killed', 'failed']);
/**
 * Whether a job lifecycle state is terminal.
 * @param status - wire job status.
 * @returns true for `completed`, `killed`, and `failed`.
 */
export function isSettled(status) {
    return SETTLED.has(status);
}
/** Re-key the branded status map so plain session-id strings can read it. */
function statusByStringKey(status) {
    const out = new Map();
    for (const [id, value] of status) {
        const pending = value.pendingInteraction;
        out.set(id, {
            ...(value.running === undefined ? {} : { running: value.running }),
            ...(pending === undefined ? {} : { pending: { key: pending.key, kind: pending.kind } }),
        });
    }
    return out;
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
export function toSnapshotView(list, status, jobs) {
    const live = statusByStringKey(status);
    const sessions = {};
    for (const [id, row] of Object.entries(list.byId)) {
        const observed = live.get(id);
        const pending = observed?.pending;
        sessions[id] = {
            running: observed?.running ?? row.running,
            ...(row.displayTitle === undefined ? {} : { title: row.displayTitle }),
            ...(pending === undefined ? {} : { pending }),
        };
    }
    const jobsBySession = {};
    for (const [sessionId, rows] of Object.entries(jobs.rows)) {
        jobsBySession[sessionId] = rows.map((job) => ({
            id: job.id,
            kind: job.kind,
            label: job.label,
            status: job.status,
        }));
    }
    return { sessions, jobs: jobsBySession };
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
export function diffCompletions(prev, next) {
    if (prev === null)
        return [];
    const events = [];
    for (const [sessionId, row] of Object.entries(next.sessions)) {
        const before = prev.sessions[sessionId];
        if (before === undefined)
            continue;
        if (before.running && !row.running) {
            events.push({ kind: 'turn', sessionId, ...(row.title === undefined ? {} : { title: row.title }) });
        }
        // A pending interaction is identified by its opaque request key, so a
        // replacement request (approval followed by a question) fires again while a
        // reconnect replay of the same request stays silent.
        const pending = row.pending;
        if (pending !== undefined && pending.key !== before.pending?.key) {
            events.push({
                kind: 'review',
                sessionId,
                pending: pending.kind,
                ...(row.title === undefined ? {} : { title: row.title }),
            });
        }
    }
    for (const [sessionId, jobs] of Object.entries(next.jobs)) {
        const prevById = new Map((prev.jobs[sessionId] ?? []).map((job) => [job.id, job]));
        for (const job of jobs) {
            const before = prevById.get(job.id);
            if (before !== undefined && !SETTLED.has(before.status) && SETTLED.has(job.status)) {
                events.push({ kind: 'job', sessionId, job });
            }
        }
    }
    return events;
}
