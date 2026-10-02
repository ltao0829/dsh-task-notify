/**
 * Reminder rendering — a self-contained DOM toast plus optional browser
 * (OS-level) notification and a configurable sound.
 *
 * No React and no slot dependency: the toast mounts directly on document.body
 * so a reminder still works on screens with no Conversation seat (no Session
 * selected, settings panel open, and so on). DSH 0.2 exposes a `shell.overlay`
 * seat for frame-wide floating layers, but that seat is Session-agnostic only
 * in principle — occupying it costs a React root and a slot registration for
 * what is a transient, dismissable banner.
 *
 * Every option degrades quietly: a bad template falls back to the built-in
 * copy, a broken custom sound to silence, and every rendered string goes
 * through `textContent`, so a template can never inject markup.
 * @module @ltao0829/dsh-task-notify/client/notify
 */
/** How long a toast stays on screen when no (or an invalid) duration is set. */
const DEFAULT_TOAST_SECONDS = 5;
const MIN_TOAST_SECONDS = 3;
const MAX_TOAST_SECONDS = 15;
/** Maximum stacked toasts before the oldest is dropped. */
const MAX_TOASTS = 4;
/** Fixed offsets of the toast column inside each screen corner. */
const POSITION_CSS = {
    'bottom-right': ['right:16px', 'bottom:16px'],
    'bottom-left': ['left:16px', 'bottom:16px'],
    'top-right': ['right:16px', 'top:16px'],
    'top-left': ['left:16px', 'top:16px'],
};
/** Placeholders a custom template may use; anything else stays literal. */
const TEMPLATE_PLACEHOLDER = /\{(title|session|kind)\}/g;
let toastHost = null;
let audio = null;
/** Compose the toast column's stylesheet for one screen corner. */
function hostStyle(position) {
    return [
        'position:fixed',
        ...POSITION_CSS[position],
        'z-index:2147483000',
        'display:flex',
        'flex-direction:column',
        'gap:8px',
        'pointer-events:none',
    ].join(';') + ';';
}
/** Locate or create the fixed toast column appended to document.body, docked to `position`. */
function ensureToastHost(position) {
    const style = hostStyle(position);
    if (toastHost !== null && document.body.contains(toastHost)) {
        toastHost.style.cssText = style;
        return toastHost;
    }
    const host = document.createElement('div');
    host.setAttribute('data-task-notify-toasts', '');
    host.style.cssText = style;
    document.body.appendChild(host);
    toastHost = host;
    return host;
}
/** Human title for one completion event. */
function titleOf(event, t) {
    if (event.kind === 'turn')
        return t('event.turn');
    if (event.kind === 'job') {
        if (event.job.status === 'failed')
            return t('event.jobFailed');
        if (event.job.status === 'killed')
            return t('event.jobKilled');
        return t('event.jobCompleted');
    }
    if (event.kind === 'review')
        return t('event.review');
    return t('event.failure');
}
/** Human body for one completion event. */
function bodyOf(event, t) {
    if (event.kind === 'turn')
        return event.title ?? event.sessionId;
    if (event.kind === 'job')
        return event.job.label === '' ? event.job.kind : event.job.kind + ': ' + event.job.label;
    if (event.kind === 'review')
        return (event.title ?? event.sessionId) + ' · ' + reviewKindLabel(event.pending, t);
    return (event.title ?? event.sessionId) + (event.message === '' ? '' : ' · ' + event.message);
}
/**
 * The value one template placeholder expands to.
 *
 * `{kind}` is the localized event label ("任务已完成" and friends), `{title}`
 * the most human-readable task label the event carries, `{session}` the raw
 * session id.
 */
function templateValue(part, event, t) {
    if (part === 'session')
        return event.sessionId;
    if (part === 'kind')
        return titleOf(event, t);
    if (event.kind === 'job')
        return event.job.label === '' ? event.job.kind : event.job.label;
    return event.title ?? event.sessionId;
}
/**
 * Expand a custom template. Produces a plain string — the toast renders it
 * with `textContent`, so no template can inject markup. Unknown placeholders
 * (`{bogus}`) are left as written rather than silently dropped.
 */
function renderTemplate(template, event, t) {
    return template.replace(TEMPLATE_PLACEHOLDER, (_, part) => templateValue(part, event, t));
}
/** Human label for a pending-interaction kind. */
function reviewKindLabel(kind, t) {
    if (kind === 'approval')
        return t('review.approval');
    if (kind === 'plan-review')
        return t('review.planReview');
    if (kind === 'question')
        return t('review.question');
    return kind;
}
/** Fire every enabled channel for one completion event. */
export function notifyEvent(event, options, t) {
    const titleTemplate = options.templateTitle ?? '';
    const bodyTemplate = options.templateBody ?? '';
    const title = titleTemplate.trim() === '' ? titleOf(event, t) : renderTemplate(titleTemplate, event, t);
    const body = bodyTemplate.trim() === '' ? bodyOf(event, t) : renderTemplate(bodyTemplate, event, t);
    showToast(title, body, options.toastSeconds, options.toastPosition ?? 'bottom-right');
    if (options.browser)
        showBrowserNotification(title, body);
    if (options.sound !== 'off')
        playSound(options.sound, options.volume ?? 1, options.soundUrl ?? '');
}
/** Clamp a configured toast duration into the supported range. */
function toastMs(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds))
        return DEFAULT_TOAST_SECONDS * 1000;
    return Math.min(MAX_TOAST_SECONDS, Math.max(MIN_TOAST_SECONDS, Math.round(seconds))) * 1000;
}
/** Append one auto-dismissing toast card. */
function showToast(title, body, seconds, position) {
    const host = ensureToastHost(position);
    while (host.children.length >= MAX_TOASTS) {
        const first = host.firstElementChild;
        if (first === null)
            break;
        first.remove();
    }
    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
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
    ].join(';') + ';';
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-weight:600;margin-bottom:2px;';
    const bodyEl = document.createElement('div');
    bodyEl.textContent = body;
    bodyEl.style.cssText = [
        'opacity:0.85',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
    ].join(';') + ';';
    toast.appendChild(titleEl);
    toast.appendChild(bodyEl);
    host.appendChild(toast);
    window.setTimeout(() => { toast.remove(); }, toastMs(seconds));
}
/** Send an OS-level notification, no-oping without permission or support. */
function showBrowserNotification(title, body) {
    if (typeof Notification === 'undefined')
        return;
    if (Notification.permission !== 'granted')
        return;
    try {
        new Notification(title, { body });
    }
    catch {
        // Some engines throw despite a granted permission (e.g. mobile); the
        // toast is already showing, so a failed OS notification is non-fatal.
    }
}
/**
 * Request browser-notification permission. Must be called from a user gesture
 * (the settings card's save handler does this when the toggle is enabled).
 * @returns the resulting permission state.
 */
export function requestBrowserNotificationPermission() {
    if (typeof Notification === 'undefined')
        return Promise.resolve('denied');
    if (Notification.permission !== 'default')
        return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
}
/** Clamp a configured volume into the `0`–`1` range Web Audio and `<audio>` accept. */
function clampVolume(volume) {
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}
/**
 * Play a custom audio file. An empty URL falls back to the built-in two-tone;
 * an unloadable URL or an autoplay refusal degrades to silence — the toast is
 * already showing either way.
 */
function playCustomSound(url, volume) {
    if (url.trim() === '') {
        playTone('double', volume);
        return;
    }
    try {
        const audio = new Audio(url);
        audio.volume = clampVolume(volume);
        const played = audio.play();
        if (played !== undefined)
            void played.catch(() => { });
    }
    catch {
        // The engine refused the element; a missed beep is fine.
    }
}
/**
 * Play the built-in beep through the Web Audio API: a single 880 Hz tone or
 * the classic two-tone (880 Hz then 1174.66 Hz), scaled by `volume`.
 */
function playTone(mode, volume) {
    try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (Ctor === undefined)
            return;
        if (audio === null)
            audio = new Ctor();
        const ctx = audio;
        const peak = Math.max(0.0001, 0.16 * clampVolume(volume));
        void ctx.resume().then(() => {
            if (ctx.state !== 'running')
                return;
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            gain.connect(ctx.destination);
            const schedule = mode === 'single'
                ? [[0, 880]]
                : [[0, 880], [0.12, 1174.66]];
            for (const [delay, freq] of schedule) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                osc.connect(gain);
                osc.start(now + delay);
                osc.stop(now + delay + 0.16);
            }
        });
    }
    catch {
        // Autoplay policies may block audio until a gesture; a missed beep is fine.
    }
}
/** Play the configured sound; `'off'` never reaches the audio paths. */
function playSound(mode, volume, url) {
    if (mode === 'off')
        return;
    if (mode === 'custom') {
        playCustomSound(url, volume);
        return;
    }
    playTone(mode, volume);
}
/**
 * Unlock audio on the first user gesture. Web Audio starts suspended until a
 * gesture, so a reminder that fires before the user has clicked would
 * otherwise be silent even after they enable the sound toggle.
 */
export function ensureAudioUnlock() {
    if (typeof document === 'undefined')
        return;
    const unlock = () => {
        // Request the OS notification permission on the first user gesture (the
        // browser only shows the prompt during a gesture). Idempotent: a no-op
        // once the permission is granted or denied.
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
                void Notification.requestPermission();
            }
            catch {
                // Non-fatal; the reminder still shows its in-page toast.
            }
        }
        try {
            const Ctor = window.AudioContext ?? window.webkitAudioContext;
            if (Ctor !== undefined) {
                if (audio === null)
                    audio = new Ctor();
                void audio.resume();
            }
        }
        catch {
            // Non-fatal; the beep simply stays muted until a later gesture.
        }
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
}
