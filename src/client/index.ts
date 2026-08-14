/**
 * dsh-task-notify browser half — subscribes to the sessions-list store and
 * fires a reminder (toast, optional OS notification, optional beep) whenever
 * an agent turn or a background job settles. Registers the locale
 * dictionaries and an always-visible settings card into the Web UI plugin
 * group. Settings live in localStorage, so nothing depends on the host
 * settings surface.
 * @module @linxin666/dsh-task-notify/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { diffCompletions, toSnapshotView, type SnapshotView } from '../detect.ts'
import { ensureAudioUnlock, notifyEvent } from './notify.ts'
import { NS, zh, en, type SettingsCardKey } from './locales.ts'
import { getSettings } from './settings.ts'
import { TaskNotifySettingsCard, type TaskNotifySettings } from './TaskNotifySettingsCard.tsx'

export type { TaskNotifySettings } from './TaskNotifySettingsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** task-notify settings-card copy. */
    'task-notify': SettingsCardKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level settings.plugin.item list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * Register the reminder watcher and its settings card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-notify: dictionaries')

  // Settings card: always visible, backed by localStorage.
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'task-notify-settings',
    order: 150,
    locale: NS,
  }, TaskNotifySettingsCard))

  // Unlock Web Audio and request the OS notification permission on the first
  // user gesture (browsers only show the prompt during a gesture).
  ensureAudioUnlock()

  // Completion watcher: diff each sessions-list snapshot against the previous
  // one and fire a reminder for every newly-settled turn/job. The first
  // observation only establishes a baseline — page load never replays history.
  const sessions = ctx.sessions
  let prev: SnapshotView | null = null
  let inited = false
  const applySnapshot = (): void => {
    const next = toSnapshotView(sessions.list.getSnapshot())
    if (!inited) {
      prev = next
      inited = true
      return
    }
    const events = diffCompletions(prev, next)
    prev = next
    if (events.length === 0) return
    const cfg = getSettings()
    if (!cfg.enabled) return
    for (const event of events) {
      if (event.kind === 'turn' && !cfg.turn) continue
      if (event.kind === 'job' && !cfg.job) continue
      notifyEvent(event, {
        browser: cfg.browser,
        sound: cfg.sound,
      })
    }
  }
  ctx.effect(() => {
    const unsubscribe = sessions.list.subscribe(applySnapshot)
    applySnapshot()
    return unsubscribe
  }, 'task-notify: watcher')
}
