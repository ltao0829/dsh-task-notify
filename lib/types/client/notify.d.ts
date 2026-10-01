/**
 * Reminder rendering — a self-contained DOM toast plus optional browser
 * (OS-level) notification and a short Web Audio beep.
 *
 * No React and no slot dependency: the toast mounts directly on document.body
 * so a reminder still works on screens with no Conversation seat (no Session
 * selected, settings panel open, and so on). DSH 0.2 exposes a `shell.overlay`
 * seat for frame-wide floating layers, but that seat is Session-agnostic only
 * in principle — occupying it costs a React root and a slot registration for
 * what is a transient, dismissable banner.
 * @module @ltao0829/dsh-task-notify/client/notify
 */
import type { CompletionEvent } from '../detect.ts';
import type { TaskNotifyTranslate } from './locales.ts';
/** Notification channels the watcher may use (read from settings). */
export interface NotifyOptions {
    /** Whether to send a browser Notification, when permission is granted. */
    browser: boolean;
    /** Whether to play the completion beep. */
    sound: boolean;
}
/** Fire every enabled channel for one completion event. */
export declare function notifyEvent(event: CompletionEvent, options: NotifyOptions, t: TaskNotifyTranslate): void;
/**
 * Request browser-notification permission. Must be called from a user gesture
 * (the settings card's save handler does this when the toggle is enabled).
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