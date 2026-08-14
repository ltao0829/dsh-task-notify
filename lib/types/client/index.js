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
    ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
        name: 'web-ui.plugin.item',
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
            if (event.kind === 'job' && !cfg.job)
                continue;
            if (event.kind === 'review' && !cfg.review)
                continue;
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
}
