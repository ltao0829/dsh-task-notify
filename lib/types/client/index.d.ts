/**
 * dsh-task-notify browser half — subscribes to the sessions-list store and
 * fires a reminder (toast, optional OS notification, optional beep) whenever
 * an agent turn or a background job settles. Registers the locale
 * dictionaries and an always-visible settings card into the Web UI plugin
 * group. Settings live in localStorage, so nothing depends on the host
 * settings surface.
 * @module @linxin666/dsh-task-notify/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type SettingsCardKey } from './locales.ts';
export type { TaskNotifySettings } from './TaskNotifySettingsCard.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** task-notify settings-card copy. */
        'task-notify': SettingsCardKey;
    }
    interface SlotMap {
        /**
         * The core plugin-configuration section slot. Spelled here with the same
         * shape so this package can register its card without depending on the
         * package that declares the slot at runtime.
         */
        'settings.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
    }
}
/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
/** Services required by this plugin. */
export declare const inject: string[];
/**
 * Register the reminder watcher and its settings card.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map