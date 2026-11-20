/**
 * dsh-task-notify host half: native Linux notification backend.
 *
 * The browser half renders in-page toasts, sound, and (on other platforms)
 * web notifications. On Linux this host half owns the OS-notification channel
 * through `notify-send` (with a `gdbus` D-Bus fallback if `notify-send` is
 * unavailable), so reminders fire from a headless deployment, a closed tab,
 * or regardless of browser web-notification quirks. The client half suppresses
 * its own browser notification on Linux desktops, leaving one OS channel.
 *
 * Settings cross the HTTP bridge the browser already shares with the host:
 * the client POSTs its localStorage settings (and UI language) to
 * `/api/task-notify/settings` on startup and on every change. Until the first
 * POST, defaults apply.
 *
 * Scope boundaries:
 * - No audio or urgency control on Linux native notifications.
 * - Review-kind events (plan approval / question) are not mirrored host-side;
 *   the browser half covers them while a tab is open.
 * - Turn/failure events for subagent sessions are skipped; their outcome is
 *   announced by the parent's background-job notification.
 * @module @ltao0829/dsh-task-notify
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export declare const name = "task-notify";
/** No required host services; the settings bridge is registered when connection exists. */
export declare const inject: readonly [];
/**
 * Host entrypoint: Linux native notification backend.
 * On other platforms (or when passed a stub context without Cordis hooks),
 * this stays inert so the browser half owns notifications.
 * @param ctx - host plugin context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map