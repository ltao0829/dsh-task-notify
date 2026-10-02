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

import type { Context } from '@deepseek-ai/cordis'
// Type-only imports pull the Client Context merges for ctx.sessions,
// ctx.uiSession and ctx.jobs, plus the slot declarations this plugin
// registers into. They are erased at build time and never reach the module
// table (a cross-plugin value import would either duplicate a runtime instance
// or ask for a specifier the frozen table cannot answer).
import type {} from '@deepseek-ai/dsh-api-job-controller/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { diffCompletions, toSnapshotView, type SnapshotView } from '../detect.ts'
import { ensureAudioUnlock, notifyEvent, type NotifyOptions } from './notify.ts'
import { NS, en, zh } from './locales.ts'
import { getSettings, isQuietTime } from './settings.ts'
import { TaskNotifySettingsCard, type TaskNotifySettings } from './TaskNotifySettingsCard.tsx'

export type { TaskNotifySettings } from './TaskNotifySettingsCard.tsx'

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions', 'uiSession', 'jobs']

/** Presentation options derived from the settings snapshot. */
function optionsFor(cfg: TaskNotifySettings): NotifyOptions {
  return {
    browser: cfg.browser,
    sound: cfg.soundMode,
    soundUrl: cfg.soundUrl,
    volume: cfg.volume,
    toastPosition: cfg.toastPosition,
    toastSeconds: cfg.toastSeconds,
    templateTitle: cfg.templateTitle,
    templateBody: cfg.templateBody,
  }
}

/** Whether a reminder for this session must not fire right now. */
function suppressed(cfg: TaskNotifySettings, sessionId: string): boolean {
  return isQuietTime(cfg) || cfg.mutedSessions.includes(sessionId)
}

/**
 * The Controller's branded Session identity, spelled from its own signature so
 * this module needs no value import of the session types package.
 */
type SessionKey = Parameters<
  import('@deepseek-ai/dsh-api-session-controller/client').ISessions['binding']
>[0]

/**
 * Register the reminder watcher and its settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-notify: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: NS,
    order: 10,
    label: () => t('settings.title'),
    locale: NS,
  }, TaskNotifySettingsCard))

  const sessions = ctx.sessions
  const ui = ctx.uiSession
  const jobs = ctx.jobs

  // Unlock Web Audio and request the OS notification permission on the first
  // user gesture (browsers only show the prompt during a gesture).
  ensureAudioUnlock()

  // Sessions observed running at least once since this page loaded. Used as the
  // default job-stream target set: a Session that never ran here cannot hold a
  // job whose completion this page is waiting on, and watching every catalog
  // row would open one `job.list` stream per Session.
  const activeSessions = new Set<string>()
  const jobWatchers = new Map<string, () => void>()

  /** Open and release job rosters so exactly `targets` are watched. */
  const syncJobWatchers = (targets: ReadonlySet<string>): void => {
    for (const [id, stop] of [...jobWatchers]) {
      if (targets.has(id)) continue
      stop()
      jobWatchers.delete(id)
    }
    for (const id of targets) {
      if (jobWatchers.has(id)) continue
      jobWatchers.set(id, jobs.watchRows(id as SessionKey))
    }
  }

  // Turn-failure watcher. `lastAgentError` lives on the Session face, and a
  // face exists only for a retained generation, so this observes exactly the
  // Sessions the workspace already keeps open — the same reach the 0.1.x
  // `sessions.binding(id)?.session` watcher had, and it costs no extra retain.
  const errorSeen = new Map<string, string | null>()
  const errorUnsubs = new Map<string, () => void>()

  const syncErrorWatchers = (): void => {
    const list = sessions.list.getSnapshot()
    const ids = new Set<string>(list.ids as readonly string[])
    for (const [id, unsubscribe] of [...errorUnsubs]) {
      if (ids.has(id)) continue
      unsubscribe()
      errorUnsubs.delete(id)
      errorSeen.delete(id)
    }
    for (const id of ids) {
      if (errorUnsubs.has(id)) continue
      const binding = sessions.binding(id as SessionKey)
      if (binding === undefined) continue
      const face = binding.session
      const onSnapshot = (): void => {
        const error = face.getSnapshot().lastAgentError
        const before = errorSeen.get(id)
        errorSeen.set(id, error)
        if (before === undefined || before !== null || error === null) return
        const cfg = getSettings()
        if (!cfg.enabled || !cfg.failure) return
        if (suppressed(cfg, id)) return
        const title = sessions.list.getSnapshot().byId[id as SessionKey]?.displayTitle ?? id
        notifyEvent({ kind: 'failure', sessionId: id, title, message: error }, optionsFor(cfg), t)
      }
      errorUnsubs.set(id, face.subscribe(onSnapshot))
      onSnapshot()
    }
  }

  let prev: SnapshotView | null = null
  let inited = false

  /** One reconcile pass over the three sources. */
  const reconcileOnce = (): void => {
    const list = sessions.list.getSnapshot()
    const status = ui.sessionStatus.getSnapshot()
    const cfg = getSettings()

    const inList = new Set<string>(Object.keys(list.byId))
    for (const id of activeSessions) if (!inList.has(id)) activeSessions.delete(id)

    const statusRunning = new Map<string, boolean>()
    for (const [id, value] of status) {
      if (value.running !== undefined) statusRunning.set(id, value.running)
    }
    for (const id of inList) {
      const running = statusRunning.get(id) ?? list.byId[id as SessionKey]?.running ?? false
      if (running) activeSessions.add(id)
    }

    syncJobWatchers(cfg.allSessions ? inList : activeSessions)
    syncErrorWatchers()

    const next = toSnapshotView(list, status, jobs.state.getSnapshot())
    if (!inited) {
      // First observation only establishes a baseline — page load never
      // replays history for every already-settled task.
      prev = next
      inited = true
      return
    }
    const events = diffCompletions(prev, next)
    prev = next
    if (events.length === 0 || !cfg.enabled) return
    for (const event of events) {
      if (event.kind === 'turn' && !cfg.turn) continue
      if (event.kind === 'review' && !cfg.review) continue
      if (event.kind === 'failure' && !cfg.failure) continue
      if (event.kind === 'job') {
        const failed = event.job.status === 'failed' || event.job.status === 'killed'
        if (failed && !cfg.failure) continue
        if (!failed && !cfg.job) continue
      }
      if (suppressed(cfg, event.sessionId)) continue
      notifyEvent(event, optionsFor(cfg), t)
    }
  }

  // One subscription can make another fire (opening a job stream publishes a
  // roster). Collapse that cascade into a bounded re-run instead of recursing.
  let reconciling = false
  let queued = false
  const reconcile = (): void => {
    if (reconciling) {
      queued = true
      return
    }
    reconciling = true
    try {
      reconcileOnce()
    } finally {
      reconciling = false
    }
    if (queued) {
      queued = false
      reconcile()
    }
  }

  ctx.effect(() => {
    const unsubscribers = [
      sessions.list.subscribe(reconcile),
      ui.sessionStatus.subscribe(reconcile),
      jobs.state.subscribe(reconcile),
    ]
    reconcile()
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      for (const stop of jobWatchers.values()) stop()
      jobWatchers.clear()
      for (const unsubscribe of errorUnsubs.values()) unsubscribe()
      errorUnsubs.clear()
      errorSeen.clear()
    }
  }, 'task-notify: watcher')
}
