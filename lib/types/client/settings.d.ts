/**
 * Client-side settings store backed by localStorage. The reminder page and the
 * watcher read/write here instead of a host settings namespace, so the page
 * always renders and its values survive independently of the host config.
 * @module @ltao0829/dsh-task-notify/client/settings
 */
/** Which sound a reminder plays. */
export type SoundMode = 'off' | 'single' | 'double' | 'custom';
/** Screen corner the toast column docks to. */
export type ToastPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export interface TaskNotifySettings {
    /** Master switch. */
    enabled: boolean;
    /** Remind when an agent turn finishes. */
    turn: boolean;
    /** Remind when a background job settles. */
    job: boolean;
    /**
     * Watch background jobs in every Session of the Host list.
     *
     * Off (the default) watches only Sessions that have been observed running
     * since this page loaded, which bounds the number of `job.list` streams.
     */
    allSessions: boolean;
    /** Remind when a session waits for review (approval / plan / question). */
    review: boolean;
    /** Remind when a turn or background job fails. */
    failure: boolean;
    /** Also send an OS-level browser notification. */
    browser: boolean;
    /** Which sound to play on a reminder. */
    soundMode: SoundMode;
    /** Audio URL for `soundMode: 'custom'`; an empty URL falls back to the built-in two-tone. */
    soundUrl: string;
    /** Sound volume, `0`–`1`. */
    volume: number;
    /** Screen corner the toasts dock to. */
    toastPosition: ToastPosition;
    /** Seconds a toast stays on screen, clamped to `3`–`15`. */
    toastSeconds: number;
    /** Title template; empty uses the built-in localized title. */
    templateTitle: string;
    /** Body template; empty uses the built-in localized body. */
    templateBody: string;
    /** Suppress every reminder inside the quiet window. */
    quietEnabled: boolean;
    /** Quiet window start, `HH:MM` local time. */
    quietFrom: string;
    /** Quiet window end, `HH:MM` local time. Windows may cross midnight. */
    quietTo: string;
    /** Session ids that never trigger a reminder. */
    mutedSessions: string[];
}
/** Read the current settings snapshot (stable reference until a change). */
export declare function getSettings(): TaskNotifySettings;
/** Set one field, persist, and notify subscribers. */
export declare function setSetting<K extends keyof TaskNotifySettings>(key: K, value: TaskNotifySettings[K]): void;
/** Subscribe to settings changes; returns the disposer. */
export declare function subscribeSettings(listener: () => void): () => void;
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
export declare function isQuietTime(settings: TaskNotifySettings, now?: Date): boolean;
//# sourceMappingURL=settings.d.ts.map