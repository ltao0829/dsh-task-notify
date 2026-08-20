/**
 * Reminder rendering — a self-contained DOM toast plus optional browser
 * (OS-level) notification and a short Web Audio beep. No React and no slot
 * dependency: the toast mounts directly on document.body so the reminder works
 * even on screens without a conversation slot (no session selected).
 * @module @ltao0829/dsh-task-notify/client/notify
 */
import type { CompletionEvent } from '../detect.ts';
/** Notification channels the watcher may use (read from settings). */
export interface NotifyOptions {
    /** Whether to send a browser Notification, when permission is granted. */
    browser: boolean;
    /** Whether to play the completion beep. */
    sound: boolean;
}
/** Fire every enabled channel for one completion event. */
export declare function notifyEvent(event: CompletionEvent, options: NotifyOptions): void;
/**
 * Request browser-notification permission. Must be called from a user gesture
 * (the settings card save handler does this when the toggle is enabled).
 * @returns the resulting permission state.
 */
export declare function requestBrowserNotificationPermission(): Promise<NotificationPermission>;
/**
 * Unlock audio on the first user gesture. Web Audio starts suspended until a
 * gesture, so a reminder that fires before the user has clicked would
 * otherwise be silent even after they enable the sound toggle.
 */
export declare function ensureAudioUnlock(): void;
//# sourceMappingURL=notify.d.ts.map