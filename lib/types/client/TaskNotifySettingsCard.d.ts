/**
 * The task-notify settings page: always-visible toggles over the
 * localStorage-backed settings store, contributed to the Plugins settings
 * section's `settings.plugins.tab` seat.
 *
 * DSH 0.2 replaced the old `settings.plugin.item` card list with three seats —
 * a whole page (`settings.section`), a page inside the Plugins section
 * (`settings.plugins.tab`), or one row in General (`settings.general.item`).
 * This plugin owns a page, so it renders its toggles as a form rather than as a
 * single `<li>` card.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type TaskNotifySettings } from './settings.ts';
export type { TaskNotifySettings };
/** Props the renderer binds for the task-notify settings page. */
export type TaskNotifySettingsCardProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'task-notify'>;
/**
 * Render the task-notify settings page.
 * @param props - locale copy injected by the slot renderer.
 * @returns the settings page body.
 */
export declare function TaskNotifySettingsCard(props: TaskNotifySettingsCardProps): import("react").JSX.Element;
//# sourceMappingURL=TaskNotifySettingsCard.d.ts.map