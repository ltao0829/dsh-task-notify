/**
 * Client-side settings store backed by localStorage. The reminder page and the
 * watcher read/write here instead of a host settings namespace, so the page
 * always renders and its values survive independently of the host config.
 * @module @ltao0829/dsh-task-notify/client/settings
 */
const DEFAULTS = {
    enabled: true,
    turn: true,
    job: true,
    allSessions: false,
    review: true,
    failure: true,
    browser: true,
    soundMode: 'off',
    soundUrl: '',
    volume: 1,
    toastPosition: 'bottom-right',
    toastSeconds: 5,
    templateTitle: '',
    templateBody: '',
    quietEnabled: false,
    quietFrom: '22:00',
    quietTo: '08:00',
    mutedSessions: [],
};
/** Current storage key — the record shape is defined by {@link TaskNotifySettings}. */
const STORAGE_KEY = 'dsh.taskNotify.v3';
/**
 * Retired v2 record: the eight booleans with the same names and semantics as
 * today. Read once for the v2 → v3 migration, then removed.
 */
const LEGACY_KEY = 'dsh.taskNotify.v2';
const SOUND_MODES = ['off', 'single', 'double', 'custom'];
const TOAST_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
/** Coerce a stored boolean, falling back to the default for non-boolean junk. */
function bool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
/** Coerce a stored string, falling back to the default for non-string junk. */
function str(value, fallback) {
    return typeof value === 'string' ? value : fallback;
}
/** Clamp a stored number into `min`–`max`, falling back when absent or junk. */
function num(value, fallback, min, max) {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, parsed));
}
function whitelist(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}
function strArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
/**
 * Force a parsed record into a fully-typed settings object.
 *
 * Every field is checked instead of trusted: localStorage can be hand-edited
 * or carry an older shape, and a bad value must degrade to the default rather
 * than break the reminder page or the watcher.
 */
function sanitize(parsed) {
    return {
        enabled: bool(parsed.enabled, DEFAULTS.enabled),
        turn: bool(parsed.turn, DEFAULTS.turn),
        job: bool(parsed.job, DEFAULTS.job),
        allSessions: bool(parsed.allSessions, DEFAULTS.allSessions),
        review: bool(parsed.review, DEFAULTS.review),
        failure: bool(parsed.failure, DEFAULTS.failure),
        browser: bool(parsed.browser, DEFAULTS.browser),
        soundMode: whitelist(parsed.soundMode, SOUND_MODES, DEFAULTS.soundMode),
        soundUrl: str(parsed.soundUrl, DEFAULTS.soundUrl),
        volume: num(parsed.volume, DEFAULTS.volume, 0, 1),
        toastPosition: whitelist(parsed.toastPosition, TOAST_POSITIONS, DEFAULTS.toastPosition),
        toastSeconds: num(parsed.toastSeconds, DEFAULTS.toastSeconds, 3, 15),
        templateTitle: str(parsed.templateTitle, DEFAULTS.templateTitle),
        templateBody: str(parsed.templateBody, DEFAULTS.templateBody),
        quietEnabled: bool(parsed.quietEnabled, DEFAULTS.quietEnabled),
        quietFrom: str(parsed.quietFrom, DEFAULTS.quietFrom),
        quietTo: str(parsed.quietTo, DEFAULTS.quietTo),
        mutedSessions: strArray(parsed.mutedSessions),
    };
}
/** Map the retired v2 record onto the v3 shape: the boolean sound toggle becomes its mode. */
function migrateV2(parsed) {
    return sanitize({ ...parsed, soundMode: parsed.sound === true ? 'double' : 'off' });
}
function parse(raw, legacy) {
    if (raw === null)
        return { ...DEFAULTS, mutedSessions: [] };
    try {
        const parsed = JSON.parse(raw);
        return legacy ? migrateV2(parsed) : sanitize(parsed);
    }
    catch {
        return { ...DEFAULTS, mutedSessions: [] };
    }
}
function load() {
    if (typeof localStorage === 'undefined')
        return { ...DEFAULTS, mutedSessions: [] };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null)
            return parse(raw, false);
        // First run on v3: carry a v2 record over (toggles preserved, the sound
        // boolean becomes its mode), then retire the old key.
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy === null)
            return { ...DEFAULTS, mutedSessions: [] };
        const migrated = parse(legacy, true);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_KEY);
        }
        catch {
            // Migration is best-effort; the in-memory value still works this session.
        }
        return migrated;
    }
    catch {
        return { ...DEFAULTS, mutedSessions: [] };
    }
}
let current = load();
const listeners = new Set();
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
/** `HH:MM` → minutes since midnight, or `null` when malformed. */
function parseClock(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (match === null)
        return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59)
        return null;
    return hours * 60 + minutes;
}
/**
 * Whether `now` (local time) falls inside the settings' quiet window.
 *
 * A disabled, malformed, or zero-length window is never quiet — a broken
 * clock string degrades to "reminders on" instead of silencing them.
 * A window whose start is after its end (e.g. `22:00`–`08:00`) crosses
 * midnight and matches either side.
 * @param settings - settings snapshot supplying the quiet window.
 * @param now - injection point for tests; defaults to the current time.
 * @returns true when reminders should be suppressed.
 */
export function isQuietTime(settings, now = new Date()) {
    if (!settings.quietEnabled)
        return false;
    const from = parseClock(settings.quietFrom);
    const to = parseClock(settings.quietTo);
    if (from === null || to === null || from === to)
        return false;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}
