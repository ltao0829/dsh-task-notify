import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";
//#region src/index.ts
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
const TASK_NOTIFY_SETTINGS_NAMESPACE = settingsNamespace("task-notify");
/** Runtime schema for {@link Config}. */
const Config = z.object({
	enabled: z.boolean().default(true),
	turn: z.boolean().default(true),
	job: z.boolean().default(true),
	review: z.boolean().default(true),
	browser: z.boolean().default(true),
	sound: z.boolean().default(false)
});
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "task-notify";
/** No required services: installSettingsSection resolves the settings service optionally. */
const inject = [];
/**
* Register the settings section that carries the notification preferences.
* The browser half reads them through ctx.settingsScope.bind({namespace}).
* @param ctx - host plugin context.
* @param config - resolved plugin config (schema defaults applied by the loader).
*/
function apply(ctx, config = {}) {
	installSettingsSection(ctx, TASK_NOTIFY_SETTINGS_NAMESPACE, Config, config ?? {}, {
		setSource: () => {},
		onChange: () => {}
	});
}
//#endregion
export { Config, TASK_NOTIFY_SETTINGS_NAMESPACE, apply, inject, name };
