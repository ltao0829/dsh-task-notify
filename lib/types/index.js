/**
 * dsh-task-notify host half. Notification settings and lifecycle watching live
 * entirely in the browser; this entry only gives the bundle loader a stable
 * host plugin while package.json wires the client half into the web runtime.
 * @module @ltao0829/dsh-task-notify
 */
import z from 'schemastery';
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
export const TASK_NOTIFY_SETTINGS_NAMESPACE = 'task-notify';
/** Runtime schema for {@link Config}. */
export const Config = z.object({
    enabled: z.boolean().default(true),
    turn: z.boolean().default(true),
    job: z.boolean().default(true),
    review: z.boolean().default(true),
    failure: z.boolean().default(true),
    browser: z.boolean().default(true),
    sound: z.boolean().default(false),
});
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'task-notify';
/** No required host services. */
export const inject = [];
/**
 * Host entrypoint retained for the DSH bundle loader. All behavior is provided
 * by the browser half, whose settings are localStorage-backed.
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(_ctx, _config = {}) {
    // Intentionally empty: package.json's dsh.client declaration mounts the UI.
}
