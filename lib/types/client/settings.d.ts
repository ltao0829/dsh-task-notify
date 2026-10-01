/**
 * Client-side settings store backed by localStorage. The reminder page and the
 * watcher read/write here instead of a host settings namespace, so the page
 * always renders and its values survive independently of the host config.
 * @module @ltao0829/dsh-task-notify/client/settings
 */
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