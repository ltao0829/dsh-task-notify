/**
 * Client-side settings store backed by localStorage. The reminder page and the
 * watcher read/write here instead of a host settings namespace, so the page
 * always renders and its values survive independently of the host config.
 * @module @ltao0829/dsh-task-notify/client/settings
 */
/**
 * Bumped from `dsh.taskNotify.v1`: DSH 0.2 added `allSessions`, and a v1
 * record silently inherits the new default instead of being migrated.
 */
const STORAGE_KEY = 'dsh.taskNotify.v2';
const DEFAULTS = {
    enabled: true,
    turn: true,
    job: true,
    allSessions: false,
    review: true,
    failure: true,
    browser: true,
    sound: false,
};
let current = load();
const listeners = new Set();
function load() {
    if (typeof localStorage === 'undefined')
        return { ...DEFAULTS };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null)
            return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    }
    catch {
        return { ...DEFAULTS };
    }
}
function persist() {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
    catch {
        // Best effort; the in-memory value still works for this session.
    }
}
/** Read the current settings snapshot (stable reference until a change). */
export function getSettings() {
    return current;
}
/** Set one field, persist, and notify subscribers. */
export function setSetting(key, value) {
    current = { ...current, [key]: value };
    persist();
    for (const listener of listeners)
        listener();
}
/** Subscribe to settings changes; returns the disposer. */
export function subscribeSettings(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
