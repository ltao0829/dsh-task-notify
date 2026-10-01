/**
 * dsh-task-notify host half. Every notification behavior lives in the browser
 * half; this entry only gives the bundle loader a stable host plugin while
 * package.json's `dsh.client` declaration mounts the UI.
 *
 * Settings are intentionally client-side (localStorage): the card must render
 * even when the host settings surface is unavailable, and DSH 0.2's
 * `settings.plugins.tab` seat is a client-only slot with no host config row
 * behind it.
 * @module @ltao0829/dsh-task-notify
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export declare const name = "task-notify";
/** No required host services. */
export declare const inject: readonly [];
/**
 * Host entrypoint retained for the DSH bundle loader.
 * @param _ctx - host plugin context (unused).
 */
export declare function apply(_ctx: Context): void;
//# sourceMappingURL=index.d.ts.map