/**
 * dsh-task-notify host half — registers the notification-preference settings
 * section so the browser half's settings card can read/write it through the
 * DSH settings surface. No host behavior beyond that: the completion watching
 * happens entirely in the browser (the client half subscribes to the sessions
 * list store and fires the reminder).
 * @module @ltao0829/dsh-task-notify
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
export declare const TASK_NOTIFY_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Plugin configuration (composition entry) — the settings section's base layer. */
export interface Config {
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Remind when an agent turn finishes. */
    turn?: boolean;
    /** Remind when a background job settles. */
    job?: boolean;
    /** Remind when a session waits for review (approval / plan / question). */
    review?: boolean;
    /** Remind when a turn or background job fails. */
    failure?: boolean;
    /** Also send a browser (OS-level) notification. */
    browser?: boolean;
    /** Also play a short beep. */
    sound?: boolean;
}
/** Runtime schema for {@link Config}. */
export declare const Config: z<Config>;
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export declare const name = "task-notify";
/** No required services: installSettingsSection resolves the settings service optionally. */
export declare const inject: readonly [];
/**
 * Register the settings section that carries the notification preferences.
 * The browser half reads them through ctx.settingsScope.bind({namespace}).
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map