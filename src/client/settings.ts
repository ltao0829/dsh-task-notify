/**
 * Client-side settings store backed by localStorage. The reminder page and the
 * watcher read/write here instead of a host settings namespace, so the page
 * always renders and its values survive independently of the host config.
 * @module @ltao0829/dsh-task-notify/client/settings
 */

export interface TaskNotifySettings {
  /** Master switch. */
  enabled: boolean
  /** Remind when an agent turn finishes. */
  turn: boolean
  /** Remind when a background job settles. */
  job: boolean
  /**
   * Watch background jobs in every Session of the Host list.
   *
   * Off (the default) watches only Sessions that have been observed running
   * since this page loaded, which bounds the number of `job.list` streams.
   */
  allSessions: boolean
  /** Remind when a session waits for review (approval / plan / question). */
  review: boolean
  /** Remind when a turn or background job fails. */
  failure: boolean
  /** Also send an OS-level browser notification. */
  browser: boolean
  /** Also play a short beep. */
  sound: boolean
}

/**
 * Bumped from `dsh.taskNotify.v1`: DSH 0.2 added `allSessions`, and a v1
 * record silently inherits the new default instead of being migrated.
 */
const STORAGE_KEY = 'dsh.taskNotify.v2'

const DEFAULTS: TaskNotifySettings = {
  enabled: true,
  turn: true,
  job: true,
  allSessions: false,
  review: true,
  failure: true,
  browser: true,
  sound: false,
}

let current: TaskNotifySettings = load()

const listeners = new Set<() => void>()

function load(): TaskNotifySettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<TaskNotifySettings>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function persist(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Best effort; the in-memory value still works for this session.
  }
}

/** Read the current settings snapshot (stable reference until a change). */
export function getSettings(): TaskNotifySettings {
  return current
}

/** Set one field, persist, and notify subscribers. */
export function setSetting<K extends keyof TaskNotifySettings>(key: K, value: TaskNotifySettings[K]): void {
  current = { ...current, [key]: value }
  persist()
  for (const listener of listeners) listener()
}

/** Subscribe to settings changes; returns the disposer. */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
