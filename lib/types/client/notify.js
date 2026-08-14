/**
 * Reminder rendering — a self-contained DOM toast plus optional browser
 * (OS-level) notification and a short Web Audio beep. No React and no slot
 * dependency: the toast mounts directly on document.body so the reminder works
 * even on screens without a conversation slot (no session selected).
 * @module @linxin666/dsh-task-notify/client/notify
 */
/** How long a toast stays on screen. */
const TOAST_MS = 5000;
/** Maximum stacked toasts before the oldest is dropped. */
const MAX_TOASTS = 4;
let toastHost = null;
let audio = null;
/** Locate or create the fixed toast column appended to document.body. */
function ensureToastHost() {
    if (toastHost !== null && document.body.contains(toastHost))
        return toastHost;
    const host = document.createElement('div');
    host.setAttribute('data-task-notify-toasts', '');
    host.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'z-index:2147483000',
        'display:flex',
        'flex-direction:column',
        'gap:8px',
        'pointer-events:none',
    ].join(';') + ';';
    document.body.appendChild(host);
    toastHost = host;
    return host;
}
/** Human title for one completion event. */
function titleOf(event) {
    if (event.kind === 'turn')
        return '任务已完成';
    if (event.kind === 'job')
        return '后台任务已完成';
    return '需要你的审核';
}
/** Human body for one completion event. */
function bodyOf(event) {
    if (event.kind === 'turn')
        return event.title ?? event.sessionId;
    if (event.kind === 'job')
        return event.job.label === '' ? event.job.kind : event.job.kind + ': ' + event.job.label;
    return (event.title ?? event.sessionId) + ' · ' + reviewKindLabel(event.pending);
}
/** Human label for a review kind. */
function reviewKindLabel(kind) {
    if (kind === 'approval')
        return '操作审批';
    if (kind === 'plan-review')
        return '计划评审';
    return '提问';
}
/** Fire every enabled channel for one completion event. */
export function notifyEvent(event, options) {
    showToast(titleOf(event), bodyOf(event));
    if (options.browser)
        showBrowserNotification(titleOf(event), bodyOf(event));
    if (options.sound)
        playSound();
}
/** Append one auto-dismissing toast card. */
function showToast(title, body) {
    const host = ensureToastHost();
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
        'background:var(--dsw-alias-bg-layer-2, #161b22)',
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
    window.setTimeout(() => { toast.remove(); }, TOAST_MS);
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
 * (the settings card save handler does this when the toggle is enabled).
 * @returns the resulting permission state.
 */
export function requestBrowserNotificationPermission() {
    if (typeof Notification === 'undefined')
        return Promise.resolve('denied');
    if (Notification.permission !== 'default')
        return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
}
/** Play a short two-tone completion beep through the Web Audio API. */
function playSound() {
    try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (Ctor === undefined)
            return;
        if (audio === null)
            audio = new Ctor();
        const ctx = audio;
        void ctx.resume().then(() => {
            if (ctx.state !== 'running')
                return;
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            gain.connect(ctx.destination);
            const notes = [[0, 880], [0.12, 1174.66]];
            for (const [delay, freq] of notes) {
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
