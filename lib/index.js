import z from "schemastery";
//#region src/index.ts
/** Settings namespace of the task-notify capability (the client half spells the same raw string). */
const TASK_NOTIFY_SETTINGS_NAMESPACE = "task-notify";
/** Runtime schema for {@link Config}. */
const Config = z.object({
	enabled: z.boolean().default(true),
	turn: z.boolean().default(true),
	job: z.boolean().default(true),
	review: z.boolean().default(true),
	failure: z.boolean().default(true),
	browser: z.boolean().default(true),
	sound: z.boolean().default(false)
});
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "task-notify";
/** No required host services. */
const inject = [];
/**
* Host entrypoint retained for the DSH bundle loader. All behavior is provided
* by the browser half, whose settings are localStorage-backed.
* @param ctx - host plugin context.
* @param config - resolved plugin config (schema defaults applied by the loader).
*/
function apply(_ctx, _config = {}) {}
//#endregion
export { Config, TASK_NOTIFY_SETTINGS_NAMESPACE, apply, inject, name };
