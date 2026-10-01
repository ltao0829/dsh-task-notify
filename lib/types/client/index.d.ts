/**
 * dsh-task-notify browser half.
 *
 * DSH 0.2 replaced the single `sessions.list` store (which used to carry
 * `jobsBySession` and a per-row `pendingInteraction`) with three independent
 * sources, and this watcher reads all three:
 *
 * - `ctx.sessions.list` — the Session Controller catalog (ids, titles, the
 *   Host baseline running flag);
 * - `ctx.uiSession.sessionStatus` — the live Client status projection
 *   (running, the pending interaction, the unread-completion flag);
 * - `ctx.jobs.state` — the job-controller rosters, fed by one `job.list` stream
 *   per watched Session.
 *
 * It registers the `task-notify` dictionaries and its settings page into the
 * Plugins settings section, then diffs consecutive snapshots into reminders.
 * @module @ltao0829/dsh-task-notify/client
 */
import type { Context } from '@deepseek-ai/cordis';
export type { TaskNotifySettings } from './TaskNotifySettingsCard.tsx';
/** Services required by this plugin. */
export declare const inject: string[];
/**
 * Register the reminder watcher and its settings page.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map