/**
 * Reminder rendering — a self-contained DOM toast plus optional browser
 * (OS-level) notification and a short Web Audio beep.
 *
 * No React and no slot dependency: the toast mounts directly on document.body
 * so a reminder still works on screens with no Conversation seat (no Session
 * selected, settings panel open, and so on). DSH 0.2 exposes a `shell.overlay`
 * seat for frame-wide floating layers, but that seat is Session-agnostic only
 * in principle — occupying it costs a React root and a slot registration for
 * what is a transient, dismissable banner.
 * @module @ltao0829/dsh-task-notify/client/notify
 */

import type { CompletionEvent } from '../detect.ts'
import type { TaskNotifyTranslate } from './locales.ts'

/** Notification channels the watcher may use (read from settings). */
export interface NotifyOptions {
  /** Whether to send a browser Notification, when permission is granted. */
  browser: boolean
  /** Whether to play the completion beep. */
  sound: boolean
}

/** How long a toast stays on screen. */
const TOAST_MS = 5000

/** Maximum stacked toasts before the oldest is dropped. */
const MAX_TOASTS = 4

let toastHost: HTMLDivElement | null = null
let audio: AudioContext | null = null

/** Locate or create the fixed toast column appended to document.body. */
function ensureToastHost(): HTMLDivElement {
  if (toastHost !== null && document.body.contains(toastHost)) return toastHost
  const host = document.createElement('div')
  host.setAttribute('data-task-notify-toasts', '')
  host.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483000',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'pointer-events:none',
  ].join(';') + ';'
  document.body.appendChild(host)
  toastHost = host
  return host
}

/** Human title for one completion event. */
function titleOf(event: CompletionEvent, t: TaskNotifyTranslate): string {
  if (event.kind === 'turn') return t('event.turn')
  if (event.kind === 'job') {
    if (event.job.status === 'failed') return t('event.jobFailed')
    if (event.job.status === 'killed') return t('event.jobKilled')
    return t('event.jobCompleted')
  }
  if (event.kind === 'review') return t('event.review')
  return t('event.failure')
}

/** Human body for one completion event. */
function bodyOf(event: CompletionEvent, t: TaskNotifyTranslate): string {
  if (event.kind === 'turn') return event.title ?? event.sessionId
  if (event.kind === 'job') return event.job.label === '' ? event.job.kind : event.job.kind + ': ' + event.job.label
  if (event.kind === 'review') return (event.title ?? event.sessionId) + ' · ' + reviewKindLabel(event.pending, t)
  return (event.title ?? event.sessionId) + (event.message === '' ? '' : ' · ' + event.message)
}

/**
 * Human label for a pending-interaction kind.
 *
 * The kind is a domain-owned open string (ui-approval, ui-plan,
 * ui-user-questions each merge their own), so an unrecognized domain falls back
 * to the wire word rather than to a wrong translation.
 * @param kind - the pending interaction's domain discriminator.
 * @param t - namespace-bound translate.
 * @returns display text.
 */
function reviewKindLabel(kind: string, t: TaskNotifyTranslate): string {
  if (kind === 'approval') return t('review.approval')
  if (kind === 'plan-review') return t('review.planReview')
  if (kind === 'question') return t('review.question')
  return kind
}

/** Fire every enabled channel for one completion event. */
export function notifyEvent(event: CompletionEvent, options: NotifyOptions, t: TaskNotifyTranslate): void {
  const title = titleOf(event, t)
  const body = bodyOf(event, t)
  showToast(title, body)
  if (options.browser) showBrowserNotification(title, body)
  if (options.sound) playSound()
}

/** Append one auto-dismissing toast card. */
function showToast(title: string, body: string): void {
  const host = ensureToastHost()
  while (host.children.length >= MAX_TOASTS) {
    const first = host.firstElementChild
    if (first === null) break
    first.remove()
  }
  const toast = document.createElement('div')
  toast.setAttribute('role', 'status')
  toast.style.cssText = [
    'pointer-events:auto',
    'box-sizing:border-box',
    'min-width:220px',
    'max-width:340px',
    'padding:10px 14px',
    'border:1px solid var(--dsw-alias-border-l2, #30363d)',
    'border-radius:10px',
    // `--dsw-alias-label-tertiary` was dropped in DSH 0.2's theme token set;
    // the tokens used here are all present in the 0.2 alias table.
    'background:var(--dsw-alias-bg-overlay, #161b22)',
    'color:var(--dsw-alias-label-primary, #e6edf3)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
    'font:13px/18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  ].join(';') + ';'
  const titleEl = document.createElement('div')
  titleEl.textContent = title
  titleEl.style.cssText = 'font-weight:600;margin-bottom:2px;'
  const bodyEl = document.createElement('div')
  bodyEl.textContent = body
  bodyEl.style.cssText = [
    'opacity:0.85',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';') + ';'
  toast.appendChild(titleEl)
  toast.appendChild(bodyEl)
  host.appendChild(toast)
  window.setTimeout(() => { toast.remove() }, TOAST_MS)
}

/** Send an OS-level notification, no-oping without permission or support. */
function showBrowserNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Some engines throw despite a granted permission (e.g. mobile); the
    // toast is already showing, so a failed OS notification is non-fatal.
  }
}

/**
 * Request browser-notification permission. Must be called from a user gesture
 * (the settings card's save handler does this when the toggle is enabled).
 * @returns the resulting permission state.
 */
export function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied')
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission)
  return Notification.requestPermission()
}

/** Play a short two-tone completion beep through the Web Audio API. */
function playSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctor === undefined) return
    if (audio === null) audio = new Ctor()
    const ctx = audio
    void ctx.resume().then(() => {
      if (ctx.state !== 'running') return
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
      gain.connect(ctx.destination)
      const notes: ReadonlyArray<readonly [number, number]> = [[0, 880], [0.12, 1174.66]]
      for (const [delay, freq] of notes) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        osc.start(now + delay)
        osc.stop(now + delay + 0.16)
      }
    })
  } catch {
    // Autoplay policies may block audio until a gesture; a missed beep is fine.
  }
}

/**
 * Unlock audio on the first user gesture. Web Audio starts suspended until a
 * gesture, so a reminder that fires before the user has clicked would
 * otherwise be silent even after they enable the sound toggle.
 */
export function ensureAudioUnlock(): void {
  if (typeof document === 'undefined') return
  const unlock = (): void => {
    // Request the OS notification permission on the first user gesture (the
    // browser only shows the prompt during a gesture). Idempotent: a no-op
    // once the permission is granted or denied.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        void Notification.requestPermission()
      } catch {
        // Non-fatal; the reminder still shows its in-page toast.
      }
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor !== undefined) {
        if (audio === null) audio = new Ctor()
        void audio.resume()
      }
    } catch {
      // Non-fatal; the beep simply stays muted until a later gesture.
    }
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
  document.addEventListener('pointerdown', unlock)
  document.addEventListener('keydown', unlock)
}
