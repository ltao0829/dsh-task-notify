/**
 * Client-side settings store backed by localStorage. The reminder card and
 * watcher read/write here instead of the host settings namespace, so the card
 * always renders (no dependency on the settings surface being available).
 * @module @ltao0829/dsh-task-notify/client/settings
 */

export interface TaskNotifySettings {
  /** Master switch. */
  enabled: boolean
  /** Remind when an agent turn finishes. */
  turn: boolean
  /** Remind when a background job settles. */
  job: boolean
  /** Remind when a session waits for review (approval / plan / question). */
  review: boolean
  /** Remind when a turn or background job fails. */
  failure: boolean
  /** Also send an OS-level browser notification. */
  browser: boolean
  /** Also play a short beep. */
  sound: boolean
}

const STORAGE_KEY = 'dsh.taskNotify.v1'

const DEFAULTS: TaskNotifySettings = {
  enabled: true,
  turn: true,
  job: true,
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
