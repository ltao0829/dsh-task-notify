/**
 * dsh-task-notify host half — registers the notification-preference settings
 * section so the browser half's settings card can read/write it through the
 * DSH settings surface. No host behavior beyond that: the completion watching
 * happens entirely in the browser (the client half subscribes to the sessions
 * list store and fires the reminder).
 * @module @linxin666/dsh-task-notify
 */
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from 'schemastery';
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
export const TASK_NOTIFY_SETTINGS_NAMESPACE = settingsNamespace('task-notify');
/** Runtime schema for {@link Config}. */
export const Config = z.object({
    enabled: z.boolean().default(true),
    turn: z.boolean().default(true),
    job: z.boolean().default(true),
    review: z.boolean().default(true),
    browser: z.boolean().default(true),
    sound: z.boolean().default(false),
});
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'task-notify';
/** No required services: installSettingsSection resolves the settings service optionally. */
export const inject = [];
/**
 * Register the settings section that carries the notification preferences.
 * The browser half reads them through ctx.settingsScope.bind({namespace}).
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(ctx, config = {}) {
    installSettingsSection(ctx, TASK_NOTIFY_SETTINGS_NAMESPACE, Config, config ?? {}, {
        setSource: () => { },
        onChange: () => { },
    });
}
