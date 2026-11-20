/**
 * dsh-task-notify host half: native Linux notification backend.
 *
 * The browser half renders in-page toasts, sound, and (on other platforms)
 * web notifications. On Linux this host half owns the OS-notification channel
 * through `notify-send` (with a `gdbus` D-Bus fallback if `notify-send` is
 * unavailable), so reminders fire from a headless deployment, a closed tab,
 * or regardless of browser web-notification quirks. The client half suppresses
 * its own browser notification on Linux desktops, leaving one OS channel.
 *
 * Settings cross the HTTP bridge the browser already shares with the host:
 * the client POSTs its localStorage settings (and UI language) to
 * `/api/task-notify/settings` on startup and on every change. Until the first
 * POST, defaults apply.
 *
 * Scope boundaries:
 * - No audio or urgency control on Linux native notifications.
 * - Review-kind events (plan approval / question) are not mirrored host-side;
 *   the browser half covers them while a tab is open.
 * - Turn/failure events for subagent sessions are skipped; their outcome is
 *   announced by the parent's background-job notification.
 * @module @ltao0829/dsh-task-notify
 */

import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export const name = 'task-notify'

/** No required host services; the settings bridge is registered when connection exists. */
export const inject = [] as const

/** POST target the client settings bridge writes to. */
const ROUTE_PATH = '/api/task-notify/settings'

/** Settings subset the native backend honors, sanitized from bridge POSTs. */
interface NativeSettings {
  enabled: boolean
  turn: boolean
  job: boolean
  failure: boolean
  browser: boolean
  allSessions: boolean
  quietEnabled: boolean
  quietFrom: string
  quietTo: string
  templateTitle: string
  templateBody: string
  mutedSessions: string[]
}

const DEFAULT_SETTINGS: NativeSettings = {
  enabled: true,
  turn: true,
  job: true,
  failure: true,
  browser: true,
  allSessions: false,
  quietEnabled: false,
  quietFrom: '22:00',
  quietTo: '08:00',
  templateTitle: '',
  templateBody: '',
  mutedSessions: [],
}

/** Event text mirroring the client half's `task-notify` locale dictionaries. */
const TEXT = {
  zh: {
    turn: '任务已完成',
    jobCompleted: '后台任务已完成',
    jobFailed: '后台任务失败',
    jobKilled: '后台任务被终止',
    failure: '任务失败',
  },
  en: {
    turn: 'Turn finished',
    jobCompleted: 'Background job finished',
    jobFailed: 'Background job failed',
    jobKilled: 'Background job was killed',
    failure: 'Task failed',
  },
} as const

type Lang = keyof typeof TEXT

/** One completion event, shaped after the client half's CompletionEvent. */
interface NativeEvent {
  kind: 'turn' | 'job' | 'failure'
  sessionId: string
  /** Best human-readable session label (title, cwd basename, or id). */
  title?: string
  job?: { kind: string; label: string; status: string }
  message?: string
}

/** Minimal structural projections; the real objects come from dsh-session/dsh-agent. */
interface NativeSession {
  id?: string
  header?: { cwd?: string; origin?: 'subagent' }
}

interface NativeAgent {
  id?: string
  session?: NativeSession
}

interface SessionEventPayload {
  type: string
  data?: {
    owner?: string
    kind?: string
    label?: string
    status?: string
  }
}

interface HostContext {
  on(event: 'agent/status', listener: (payload: { agent: NativeAgent; status: string }) => void): void
  on(event: 'agent/disposed', listener: (payload: { agent: NativeAgent }) => void): void
  on(event: 'agent/error', listener: (payload: { agent: NativeAgent; error: unknown }) => void): void
  on(event: 'session/event', listener: (session: NativeSession, event: SessionEventPayload) => void): void
  get(name: 'sessionTitle'): { get(session: NativeSession): { title?: string } | undefined } | undefined
  get(name: 'connection'): { fetch: { register(route: unknown): () => Promise<void> } } | undefined
  effect?(callback: () => void | (() => void), label?: string): void
}

const TEMPLATE_PLACEHOLDER = /\{(title|session|kind)\}/g
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Coerce one bridge payload into a full settings object. Unknown or malformed
 * fields fall back to defaults; a non-object or array payload yields
 * `undefined` (caller keeps the previous settings).
 */
function sanitize(raw: unknown): NativeSettings | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const src = raw as Record<string, unknown>
  const bool = (key: keyof NativeSettings): boolean =>
    typeof src[key] === 'boolean' ? (src[key] as boolean) : DEFAULT_SETTINGS[key] as boolean
  const str = (key: 'quietFrom' | 'quietTo', fallback: string): string => {
    const value = src[key]
    return typeof value === 'string' && HH_MM.test(value) ? value : fallback
  }
  const text = (key: 'templateTitle' | 'templateBody'): string =>
    typeof src[key] === 'string' ? (src[key] as string) : ''
  const muted = src.mutedSessions
  return {
    enabled: bool('enabled'),
    turn: bool('turn'),
    job: bool('job'),
    failure: bool('failure'),
    browser: bool('browser'),
    allSessions: bool('allSessions'),
    quietEnabled: bool('quietEnabled'),
    quietFrom: str('quietFrom', DEFAULT_SETTINGS.quietFrom),
    quietTo: str('quietTo', DEFAULT_SETTINGS.quietTo),
    templateTitle: text('templateTitle'),
    templateBody: text('templateBody'),
    mutedSessions: Array.isArray(muted) ? muted.filter((v): v is string => typeof v === 'string') : [],
  }
}

/** Minutes since midnight for a valid `HH:MM` string, or `null` on failure. */
function parseClockMinutes(hm: string): number | null {
  const match = HH_MM.exec(hm)
  if (match === null) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Mirrors the client half's `isQuietTime` (zero-length disables; overnight wraps midnight). */
function isQuiet(s: NativeSettings, now = new Date()): boolean {
  if (!s.quietEnabled) return false
  const from = parseClockMinutes(s.quietFrom)
  const to = parseClockMinutes(s.quietTo)
  if (from === null || to === null || from === to) return false
  const current = now.getHours() * 60 + now.getMinutes()
  return from < to ? current >= from && current < to : current >= from || current < to
}

/** One-line error message for a notification body. */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return String(error)
  } catch {
    return ''
  }
}

/** Dispatch notification via D-Bus org.freedesktop.Notifications as fallback. */
function sendDbusNotification(title: string, body: string): void {
  try {
    const child = spawn(
      'gdbus',
      [
        'call',
        '--session',
        '--dest',
        'org.freedesktop.Notifications',
        '--object-path',
        '/org/freedesktop/Notifications',
        '--method',
        'org.freedesktop.Notifications.Notify',
        'dsh',
        '0',
        '',
        title,
        body,
        '[]',
        '{}',
        '6000',
      ],
      { stdio: 'ignore' },
    )
    child.on('error', () => {})
  } catch {
    // Missing gdbus or session bus: degrade to silence.
  }
}

/** Send one native desktop notification via `notify-send`, falling back to D-Bus on ENOENT. */
function sendLinuxNotification(title: string, body: string): void {
  try {
    const child = spawn('notify-send', ['-a', 'dsh', '-t', '6000', title, body], { stdio: 'ignore' })
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        sendDbusNotification(title, body)
      }
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendDbusNotification(title, body)
    }
  }
}

/**
 * Host entrypoint: Linux native notification backend.
 * On other platforms (or when passed a stub context without Cordis hooks),
 * this stays inert so the browser half owns notifications.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  if (process.platform !== 'linux') return
  if (
    ctx === null
    || typeof ctx !== 'object'
    || typeof (ctx as Partial<Context>).on !== 'function'
    || typeof (ctx as Partial<Context>).get !== 'function'
  ) {
    return
  }

  const hostCtx = ctx as unknown as HostContext
  let settings: NativeSettings = { ...DEFAULT_SETTINGS, mutedSessions: [] }
  let lang: Lang = 'en'
  /** Session ids with a live agent turn (no baseline = no completion event). */
  const running = new Set<string>()

  const titles = hostCtx.get('sessionTitle')

  const sessionTitleOf = (session: NativeSession | undefined): string => {
    const snapshot = session === undefined ? undefined : titles?.get(session)
    if (snapshot !== undefined && snapshot.title !== undefined && snapshot.title !== '') return snapshot.title
    const cwd = session?.header?.cwd
    if (typeof cwd === 'string' && cwd !== '') {
      const base = basename(cwd)
      if (base !== '') return base
    }
    return session?.id ?? ''
  }

  const isSubagentSession = (session: NativeSession | undefined): boolean =>
    session?.header?.origin === 'subagent'

  const t = (key: keyof typeof TEXT.en): string => TEXT[lang][key]

  const titleOf = (event: NativeEvent): string => {
    if (event.kind === 'turn') return t('turn')
    if (event.kind === 'job') {
      if (event.job?.status === 'failed') return t('jobFailed')
      if (event.job?.status === 'killed') return t('jobKilled')
      return t('jobCompleted')
    }
    return t('failure')
  }

  const bodyOf = (event: NativeEvent): string => {
    if (event.kind === 'turn') return event.title ?? event.sessionId
    if (event.kind === 'job') {
      return event.job?.label === '' || event.job?.label === undefined
        ? (event.job?.kind ?? '')
        : `${event.job.kind}: ${event.job.label}`
    }
    const message = event.message === '' || event.message === undefined ? '' : ` · ${event.message}`
    return `${event.title ?? event.sessionId}${message}`
  }

  const templateValue = (part: 'title' | 'session' | 'kind', event: NativeEvent): string => {
    if (part === 'session') return event.sessionId
    if (part === 'kind') return titleOf(event)
    if (event.kind === 'job') {
      return event.job?.label === '' || event.job?.label === undefined
        ? (event.job?.kind ?? '')
        : event.job.label
    }
    return event.title ?? event.sessionId
  }

  const renderTemplate = (template: string, event: NativeEvent): string =>
    template.replace(TEMPLATE_PLACEHOLDER, (_match, part: 'title' | 'session' | 'kind') => templateValue(part, event))

  /** Fire one native notification through notify-send / D-Bus; failures degrade silently. */
  const fire = (event: NativeEvent): void => {
    if (!settings.enabled || !settings.browser) return
    if (event.kind === 'turn' && !settings.turn) return
    if (event.kind === 'failure' && !settings.failure) return
    if (event.kind === 'job') {
      const failed = event.job?.status === 'failed' || event.job?.status === 'killed'
      if (failed ? !settings.failure : !settings.job) return
    }
    if (isQuiet(settings) || settings.mutedSessions.includes(event.sessionId)) return

    const titleTemplate = settings.templateTitle.trim()
    const bodyTemplate = settings.templateBody.trim()
    const title = titleTemplate === '' ? titleOf(event) : renderTemplate(settings.templateTitle, event)
    const body = bodyTemplate === '' ? bodyOf(event) : renderTemplate(settings.templateBody, event)
    sendLinuxNotification(title, body)
  }

  // One completed agent turn per running -> idle transition. Subagent turns
  // are skipped: the parent's background-job notification announces them.
  hostCtx.on('agent/status', ({ agent, status }) => {
    const id = agent.session?.id
    if (id === undefined) return
    if (status === 'running') {
      running.add(id)
      return
    }
    if (status === 'idle' && running.delete(id) && !isSubagentSession(agent.session)) {
      fire({ kind: 'turn', sessionId: id, title: sessionTitleOf(agent.session) })
    }
  })

  // An agent dying mid-turn must not leave a stale "running" baseline behind.
  hostCtx.on('agent/disposed', ({ agent }) => {
    const id = agent.session?.id
    if (id !== undefined) running.delete(id)
  })

  hostCtx.on('agent/error', ({ agent, error }) => {
    const id = agent.session?.id
    if (id === undefined || isSubagentSession(agent.session)) return
    fire({
      kind: 'failure',
      sessionId: id,
      title: sessionTitleOf(agent.session),
      message: extractMessage(error).slice(0, 160),
    })
  })

  hostCtx.on('session/event', (session, event) => {
    if (event.type !== 'job/settled' || event.data === undefined) return
    if (isSubagentSession(session) && !settings.allSessions) return
    fire({
      kind: 'job',
      sessionId: event.data.owner ?? session.id ?? '',
      title: sessionTitleOf(session),
      job: {
        kind: event.data.kind ?? '',
        label: event.data.label ?? '',
        status: event.data.status ?? 'completed',
      },
    })
  })

  // Settings bridge: only mountable where the connection service exists
  // (web deployments). Headless runs keep defaults; no bridge, no problem.
  const connection = hostCtx.get('connection')
  if (connection !== undefined) {
    const registerBridge = () => connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request: Request): Promise<Response> => {
        try {
          const body: unknown = await request.json()
          if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            return new Response('invalid body', { status: 400 })
          }
          const payload = body as Record<string, unknown>
          if (payload.lang === 'zh' || payload.lang === 'en') lang = payload.lang
          const next = sanitize(payload.settings)
          if (next !== undefined) settings = next
          return new Response('ok', { status: 200 })
        } catch {
          return new Response('invalid body', { status: 400 })
        }
      },
    })
    if (typeof hostCtx.effect === 'function') {
      hostCtx.effect(registerBridge, 'task-notify: settings bridge')
    } else {
      registerBridge()
    }
  }
}
