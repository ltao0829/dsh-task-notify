/**
 * The task-notify settings card: five always-visible toggles over the
 * localStorage-backed settings store. Renders unconditionally (no settings
 * namespace dependency), so it always appears in the Web UI plugin group.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type TaskNotifySettings } from './settings.ts';
export type { TaskNotifySettings };
/** Props the renderer binds for the task-notify card. */
export type TaskNotifySettingsCardProps = PropsRuntime<'settings.plugin.item'> & PropsLocale<'task-notify'>;
/**
 * Render the task-notify card.
 * @param props - locale copy.
 * @returns the card.
 */
export declare function TaskNotifySettingsCard(props: TaskNotifySettingsCardProps): import("react").JSX.Element;
//# sourceMappingURL=TaskNotifySettingsCard.d.ts.map