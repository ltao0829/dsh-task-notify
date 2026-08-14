/**
 * Client-side settings store backed by localStorage. The reminder card and
 * watcher read/write here instead of the host settings namespace, so the card
 * always renders (no dependency on the settings surface being available).
 * @module @linxin666/dsh-task-notify/client/settings
 */
export interface TaskNotifySettings {
    /** Master switch. */
    enabled: boolean;
    /** Remind when an agent turn finishes. */
    turn: boolean;
    /** Remind when a background job settles. */
    job: boolean;
    /** Also send an OS-level browser notification. */
    browser: boolean;
    /** Also play a short beep. */
    sound: boolean;
}
/** Read the current settings snapshot (stable reference until a change). */
export declare function getSettings(): TaskNotifySettings;
/** Set one field, persist, and notify subscribers. */
export declare function setSetting<K extends keyof TaskNotifySettings>(key: K, value: TaskNotifySettings[K]): void;
/** Subscribe to settings changes; returns the disposer. */
export declare function subscribeSettings(listener: () => void): () => void;
//# sourceMappingURL=settings.d.ts.map