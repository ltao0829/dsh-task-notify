/**
 * dsh-task-notify browser half.
 *
 * DSH 0.2 replaced the single `sessions.list` store (which used to carry
 * `jobsBySession` and a per-row `pendingInteraction`) with three independent
 * sources, and this watcher reads all three:
 *
 * - `ctx.sessions.list` — the Session Controller catalog (ids, titles, the
 *   Host baseline running flag);
 * - `ctx.uiSession.sessionStatus` — the live Client status projection
 *   (running, the pending interaction, the unread-completion flag);
 * - `ctx.jobs.state` — the job-controller rosters, fed by one `job.list` stream
 *   per watched Session.
 *
 * It registers the `task-notify` dictionaries and its settings page into the
 * Plugins settings section, then diffs consecutive snapshots into reminders.
 * @module @ltao0829/dsh-task-notify/client
 */
import { diffCompletions, toSnapshotView } from "../detect.js";
import { ensureAudioUnlock, notifyEvent } from "./notify.js";
import { NS, en, zh } from "./locales.js";
import { getSettings } from "./settings.js";
import { TaskNotifySettingsCard } from "./TaskNotifySettingsCard.js";
/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions', 'uiSession', 'jobs'];
/**
 * Register the reminder watcher and its settings page.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-notify: dictionaries');
    const t = ctx.locale.bind(NS);
    ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: NS,
        order: 10,
        label: () => t('settings.title'),
        locale: NS,
    }, TaskNotifySettingsCard));
    const sessions = ctx.sessions;
    const ui = ctx.uiSession;
    const jobs = ctx.jobs;
    // Unlock Web Audio and request the OS notification permission on the first
    // user gesture (browsers only show the prompt during a gesture).
    ensureAudioUnlock();
    // Sessions observed running at least once since this page loaded. Used as the
    // default job-stream target set: a Session that never ran here cannot hold a
    // job whose completion this page is waiting on, and watching every catalog
    // row would open one `job.list` stream per Session.
    const activeSessions = new Set();
    const jobWatchers = new Map();
    /** Open and release job rosters so exactly `targets` are watched. */
    const syncJobWatchers = (targets) => {
        for (const [id, stop] of [...jobWatchers]) {
            if (targets.has(id))
                continue;
            stop();
            jobWatchers.delete(id);
        }
        for (const id of targets) {
            if (jobWatchers.has(id))
                continue;
            jobWatchers.set(id, jobs.watchRows(id));
        }
    };
    // Turn-failure watcher. `lastAgentError` lives on the Session face, and a
    // face exists only for a retained generation, so this observes exactly the
    // Sessions the workspace already keeps open — the same reach the 0.1.x
    // `sessions.binding(id)?.session` watcher had, and it costs no extra retain.
    const errorSeen = new Map();
    const errorUnsubs = new Map();
    const syncErrorWatchers = () => {
        const list = sessions.list.getSnapshot();
        const ids = new Set(list.ids);
        for (const [id, unsubscribe] of [...errorUnsubs]) {
            if (ids.has(id))
                continue;
            unsubscribe();
            errorUnsubs.delete(id);
            errorSeen.delete(id);
        }
        for (const id of ids) {
            if (errorUnsubs.has(id))
                continue;
            const binding = sessions.binding(id);
            if (binding === undefined)
                continue;
            const face = binding.session;
            const onSnapshot = () => {
                const error = face.getSnapshot().lastAgentError;
                const before = errorSeen.get(id);
                errorSeen.set(id, error);
                if (before === undefined || before !== null || error === null)
                    return;
                const cfg = getSettings();
                if (!cfg.enabled || !cfg.failure)
                    return;
                const title = sessions.list.getSnapshot().byId[id]?.displayTitle ?? id;
                notifyEvent({ kind: 'failure', sessionId: id, title, message: error }, {
                    browser: cfg.browser,
                    sound: cfg.sound,
                }, t);
            };
            errorUnsubs.set(id, face.subscribe(onSnapshot));
            onSnapshot();
        }
    };
    let prev = null;
    let inited = false;
    /** One reconcile pass over the three sources. */
    const reconcileOnce = () => {
        const list = sessions.list.getSnapshot();
        const status = ui.sessionStatus.getSnapshot();
        const cfg = getSettings();
        const inList = new Set(Object.keys(list.byId));
        for (const id of activeSessions)
            if (!inList.has(id))
                activeSessions.delete(id);
        const statusRunning = new Map();
        for (const [id, value] of status) {
            if (value.running !== undefined)
                statusRunning.set(id, value.running);
        }
        for (const id of inList) {
            const running = statusRunning.get(id) ?? list.byId[id]?.running ?? false;
            if (running)
                activeSessions.add(id);
        }
        syncJobWatchers(cfg.allSessions ? inList : activeSessions);
        syncErrorWatchers();
        const next = toSnapshotView(list, status, jobs.state.getSnapshot());
        if (!inited) {
            // First observation only establishes a baseline — page load never
            // replays history for every already-settled task.
            prev = next;
            inited = true;
            return;
        }
        const events = diffCompletions(prev, next);
        prev = next;
        if (events.length === 0 || !cfg.enabled)
            return;
        for (const event of events) {
            if (event.kind === 'turn' && !cfg.turn)
                continue;
            if (event.kind === 'review' && !cfg.review)
                continue;
            if (event.kind === 'failure' && !cfg.failure)
                continue;
            if (event.kind === 'job') {
                const failed = event.job.status === 'failed' || event.job.status === 'killed';
                if (failed && !cfg.failure)
                    continue;
                if (!failed && !cfg.job)
                    continue;
            }
            notifyEvent(event, { browser: cfg.browser, sound: cfg.sound }, t);
        }
    };
    // One subscription can make another fire (opening a job stream publishes a
    // roster). Collapse that cascade into a bounded re-run instead of recursing.
    let reconciling = false;
    let queued = false;
    const reconcile = () => {
        if (reconciling) {
            queued = true;
            return;
        }
        reconciling = true;
        try {
            reconcileOnce();
        }
        finally {
            reconciling = false;
        }
        if (queued) {
            queued = false;
            reconcile();
        }
    };
    ctx.effect(() => {
        const unsubscribers = [
            sessions.list.subscribe(reconcile),
            ui.sessionStatus.subscribe(reconcile),
            jobs.state.subscribe(reconcile),
        ];
        reconcile();
        return () => {
            for (const unsubscribe of unsubscribers)
                unsubscribe();
            for (const stop of jobWatchers.values())
                stop();
            jobWatchers.clear();
            for (const unsubscribe of errorUnsubs.values())
                unsubscribe();
            errorUnsubs.clear();
            errorSeen.clear();
        };
    }, 'task-notify: watcher');
}
