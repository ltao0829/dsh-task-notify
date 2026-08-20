/**
 * Pure detection — maps the sessions-list store into a minimal view and diffs
 * two consecutive views into events (turn done, job done, review needed).
 * No DOM, no SDK values: the view is plain data so this module unit-tests
 * without a loader.
 * @module @ltao0829/dsh-task-notify/detect
 */
/** Job states that count as "finished". */
const SETTLED = new Set(['completed', 'killed', 'failed']);
/**
 * Map the runtime's SessionListState into the minimal detector view.
 * @param list - the sessions-list snapshot.
 * @returns the plain view.
 */
export function toSnapshotView(list) {
    const sessions = {};
    for (const [id, row] of Object.entries(list.byId)) {
        sessions[id] = {
            running: row.running,
            ...(row.displayTitle === undefined ? {} : { title: row.displayTitle }),
            ...(row.pendingInteraction === undefined ? {} : { pendingInteraction: row.pendingInteraction }),
        };
    }
    const jobs = {};
    for (const [sessionId, rows] of Object.entries(list.jobsBySession)) {
        jobs[sessionId] = rows.map((job) => ({
            id: job.id,
            kind: job.kind,
            label: job.label,
            status: job.status,
        }));
    }
    return { sessions, jobs };
}
/**
 * Diff two snapshots into the events that happened between them.
 * A null previous snapshot (the first observation) yields nothing so that a
 * page load never fires reminders for every historically-settled task.
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
        if (before.pendingInteraction === undefined && row.pendingInteraction !== undefined) {
            events.push({ kind: 'review', sessionId, pending: row.pendingInteraction, ...(row.title === undefined ? {} : { title: row.title }) });
        }
    }
    for (const [sessionId, jobs] of Object.entries(next.jobs)) {
        const prevJobs = prev.jobs[sessionId] ?? [];
        const prevById = new Map(prevJobs.map((job) => [job.id, job]));
        for (const job of jobs) {
            const before = prevById.get(job.id);
            if (before !== undefined && !SETTLED.has(before.status) && SETTLED.has(job.status)) {
                events.push({ kind: 'job', sessionId, job });
            }
        }
    }
    return events;
}
