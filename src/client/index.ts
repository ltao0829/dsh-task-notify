/**
 * dsh-task-notify browser half — subscribes to the sessions-list store and
 * fires a reminder (toast, optional OS notification, optional beep) whenever
 * an agent turn or a background job settles. Registers the locale
 * dictionaries and an always-visible settings card into the Web UI plugin
 * group. Settings live in localStorage, so nothing depends on the host
 * settings surface.
 * @module @linxin666/dsh-task-notify/client
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
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
     * The core plugin-configuration section slot. Spelled here with the same
     * shape so this package can register its card without depending on the
     * package that declares the slot at runtime.
     */
    'settings.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
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
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
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
      if (event.kind === 'review' && !cfg.review) continue
      if (event.kind === 'job') {
        const failed = event.job.status === 'failed' || event.job.status === 'killed'
        if (failed && !cfg.failure) continue
        if (!failed && !cfg.job) continue
      }
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

  // Turn-failure watcher: subscribe to each session's ConversationSnapshot and
  // detect lastAgentError transitions (null -> non-null = the turn errored).
  const errorSeen = new Map<SessionId, string | null>()
  const errorUnsubs = new Map<SessionId, () => void>()
  const syncErrorWatchers = (): void => {
    const snapshot = sessions.list.getSnapshot()
    const ids = new Set(snapshot.ids)
    for (const [id, unsub] of [...errorUnsubs]) {
      if (!ids.has(id)) {
        unsub()
        errorUnsubs.delete(id)
        errorSeen.delete(id)
      }
    }
    for (const id of ids) {
      if (errorUnsubs.has(id)) continue
      const session = sessions.binding(id)?.session
      if (session === undefined) continue
      const onSnapshot = (): void => {
        const err = session.getSnapshot().lastAgentError
        const before = errorSeen.get(id)
        errorSeen.set(id, err)
        if (before !== undefined && before === null && err !== null) {
          const cfg = getSettings()
          if (!cfg.enabled || !cfg.failure) return
          const title = sessions.list.getSnapshot().byId[id]?.displayTitle ?? id
          notifyEvent({ kind: 'failure', sessionId: id, title, message: err }, {
            browser: cfg.browser,
            sound: cfg.sound,
          })
        }
      }
      errorUnsubs.set(id, session.subscribe(onSnapshot))
      onSnapshot()
    }
  }
  ctx.effect(() => {
    const listUnsub = sessions.list.subscribe(syncErrorWatchers)
    syncErrorWatchers()
    return () => {
      listUnsub()
      for (const unsub of errorUnsubs.values()) unsub()
      errorUnsubs.clear()
    }
  }, 'task-notify: turn-failure watcher')
}
