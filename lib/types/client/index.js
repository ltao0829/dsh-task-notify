/**
 * dsh-task-notify browser half — subscribes to the sessions-list store and
 * fires a reminder (toast, optional OS notification, optional beep) whenever
 * an agent turn or a background job settles. Registers the locale
 * dictionaries and an always-visible settings card into the Web UI plugin
 * group. Settings live in localStorage, so nothing depends on the host
 * settings surface.
 * @module @linxin666/dsh-task-notify/client
 */
import { diffCompletions, toSnapshotView } from "../detect.js";
import { ensureAudioUnlock, notifyEvent } from "./notify.js";
import { NS, zh, en } from "./locales.js";
import { getSettings } from "./settings.js";
import { TaskNotifySettingsCard } from "./TaskNotifySettingsCard.js";
/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions'];
/**
 * Register the reminder watcher and its settings card.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-notify: dictionaries');
    // Settings card: always visible, backed by localStorage.
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        id: 'task-notify-settings',
        order: 150,
        locale: NS,
    }, TaskNotifySettingsCard));
    // Unlock Web Audio and request the OS notification permission on the first
    // user gesture (browsers only show the prompt during a gesture).
    ensureAudioUnlock();
    // Completion watcher: diff each sessions-list snapshot against the previous
    // one and fire a reminder for every newly-settled turn/job. The first
    // observation only establishes a baseline — page load never replays history.
    const sessions = ctx.sessions;
    let prev = null;
    let inited = false;
    const applySnapshot = () => {
        const next = toSnapshotView(sessions.list.getSnapshot());
        if (!inited) {
            prev = next;
            inited = true;
            return;
        }
        const events = diffCompletions(prev, next);
        prev = next;
        if (events.length === 0)
            return;
        const cfg = getSettings();
        if (!cfg.enabled)
            return;
        for (const event of events) {
            if (event.kind === 'turn' && !cfg.turn)
                continue;
            if (event.kind === 'review' && !cfg.review)
                continue;
            if (event.kind === 'job') {
                const failed = event.job.status === 'failed' || event.job.status === 'killed';
                if (failed && !cfg.failure)
                    continue;
                if (!failed && !cfg.job)
                    continue;
            }
            notifyEvent(event, {
                browser: cfg.browser,
                sound: cfg.sound,
            });
        }
    };
    ctx.effect(() => {
        const unsubscribe = sessions.list.subscribe(applySnapshot);
        applySnapshot();
        return unsubscribe;
    }, 'task-notify: watcher');
    // Turn-failure watcher: subscribe to each session's ConversationSnapshot and
    // detect lastAgentError transitions (null -> non-null = the turn errored).
    const errorSeen = new Map();
    const errorUnsubs = new Map();
    const syncErrorWatchers = () => {
        const snapshot = sessions.list.getSnapshot();
        const ids = new Set(snapshot.ids);
        for (const [id, unsub] of [...errorUnsubs]) {
            if (!ids.has(id)) {
                unsub();
                errorUnsubs.delete(id);
                errorSeen.delete(id);
            }
        }
        for (const id of ids) {
            if (errorUnsubs.has(id))
                continue;
            const session = sessions.binding(id)?.session;
            if (session === undefined)
                continue;
            const onSnapshot = () => {
                const err = session.getSnapshot().lastAgentError;
                const before = errorSeen.get(id);
                errorSeen.set(id, err);
                if (before !== undefined && before === null && err !== null) {
                    const cfg = getSettings();
                    if (!cfg.enabled || !cfg.failure)
                        return;
                    const title = sessions.list.getSnapshot().byId[id]?.displayTitle ?? id;
                    notifyEvent({ kind: 'failure', sessionId: id, title, message: err }, {
                        browser: cfg.browser,
                        sound: cfg.sound,
                    });
                }
            };
            errorUnsubs.set(id, session.subscribe(onSnapshot));
            onSnapshot();
        }
    };
    ctx.effect(() => {
        const listUnsub = sessions.list.subscribe(syncErrorWatchers);
        syncErrorWatchers();
        return () => {
            listUnsub();
            for (const unsub of errorUnsubs.values())
                unsub();
            errorUnsubs.clear();
        };
    }, 'task-notify: turn-failure watcher');
}
