/**
 * dsh-task-notify host half. Notification settings and lifecycle watching live
 * entirely in the browser; this entry only gives the bundle loader a stable
 * host plugin while package.json wires the client half into the web runtime.
 * @module @ltao0829/dsh-task-notify
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
export declare const TASK_NOTIFY_SETTINGS_NAMESPACE = "task-notify";
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
/** No required host services. */
export declare const inject: readonly [];
/**
 * Host entrypoint retained for the DSH bundle loader. All behavior is provided
 * by the browser half, whose settings are localStorage-backed.
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare function apply(_ctx: Context, _config?: Config): void;
//# sourceMappingURL=index.d.ts.map