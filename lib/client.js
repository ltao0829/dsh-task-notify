window.__ModuleLoader__.load({
	id: "@ltao0829/dsh-task-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/detect.ts
		/** Job states that count as "finished". */
		const SETTLED = new Set([
			"completed",
			"killed",
			"failed"
		]);
		/** Re-key the branded status map so plain session-id strings can read it. */
		function statusByStringKey(status) {
			const out = /* @__PURE__ */ new Map();
			for (const [id, value] of status) {
				const pending = value.pendingInteraction;
				out.set(id, {
					...value.running === void 0 ? {} : { running: value.running },
					...pending === void 0 ? {} : { pending: {
						key: pending.key,
						kind: pending.kind
					} }
				});
			}
			return out;
		}
		/**
		* Map the three runtime sources into the minimal detector view.
		*
		* `SessionStatus` wins over the list row wherever it has an opinion: it is the
		* live Client projection, while `SessionSummary.running` is the Host baseline
		* that status events update.
		* @param list - the Session Controller list snapshot.
		* @param status - the `uiSession.sessionStatus` snapshot.
		* @param jobs - the job-controller roster snapshot.
		* @returns the plain view.
		*/
		function toSnapshotView(list, status, jobs) {
			const live = statusByStringKey(status);
			const sessions = {};
			for (const [id, row] of Object.entries(list.byId)) {
				const observed = live.get(id);
				const pending = observed?.pending;
				sessions[id] = {
					running: observed?.running ?? row.running,
					...row.displayTitle === void 0 ? {} : { title: row.displayTitle },
					...pending === void 0 ? {} : { pending }
				};
			}
			const jobsBySession = {};
			for (const [sessionId, rows] of Object.entries(jobs.rows)) jobsBySession[sessionId] = rows.map((job) => ({
				id: job.id,
				kind: job.kind,
				label: job.label,
				status: job.status
			}));
			return {
				sessions,
				jobs: jobsBySession
			};
		}
		/**
		* Diff two snapshots into the events that happened between them.
		*
		* A null previous snapshot (the first observation) yields nothing, so a page
		* load never fires reminders for every historically-settled task. A session or
		* job first seen in `next` is likewise treated as pre-existing and silent.
		* @param prev - the previous snapshot, or null on the first observation.
		* @param next - the latest snapshot.
		* @returns newly-settled turns, jobs, and pending reviews.
		*/
		function diffCompletions(prev, next) {
			if (prev === null) return [];
			const events = [];
			for (const [sessionId, row] of Object.entries(next.sessions)) {
				const before = prev.sessions[sessionId];
				if (before === void 0) continue;
				if (before.running && !row.running) events.push({
					kind: "turn",
					sessionId,
					...row.title === void 0 ? {} : { title: row.title }
				});
				const pending = row.pending;
				if (pending !== void 0 && pending.key !== before.pending?.key) events.push({
					kind: "review",
					sessionId,
					pending: pending.kind,
					...row.title === void 0 ? {} : { title: row.title }
				});
			}
			for (const [sessionId, jobs] of Object.entries(next.jobs)) {
				const prevById = new Map((prev.jobs[sessionId] ?? []).map((job) => [job.id, job]));
				for (const job of jobs) {
					const before = prevById.get(job.id);
					if (before !== void 0 && !SETTLED.has(before.status) && SETTLED.has(job.status)) events.push({
						kind: "job",
						sessionId,
						job
					});
				}
			}
			return events;
		}
		//#endregion
		//#region src/client/notify.ts
		/** How long a toast stays on screen when no (or an invalid) duration is set. */
		const DEFAULT_TOAST_SECONDS = 5;
		const MIN_TOAST_SECONDS = 3;
		const MAX_TOAST_SECONDS = 15;
		/** Maximum stacked toasts before the oldest is dropped. */
		const MAX_TOASTS = 4;
		/** Fixed offsets of the toast column inside each screen corner. */
		const POSITION_CSS = {
			"bottom-right": ["right:16px", "bottom:16px"],
			"bottom-left": ["left:16px", "bottom:16px"],
			"top-right": ["right:16px", "top:16px"],
			"top-left": ["left:16px", "top:16px"]
		};
		/** Placeholders a custom template may use; anything else stays literal. */
		const TEMPLATE_PLACEHOLDER = /\{(title|session|kind)\}/g;
		let toastHost = null;
		let audio = null;
		/** Compose the toast column's stylesheet for one screen corner. */
		function hostStyle(position) {
			return [
				"position:fixed",
				...POSITION_CSS[position],
				"z-index:2147483000",
				"display:flex",
				"flex-direction:column",
				"gap:8px",
				"pointer-events:none"
			].join(";") + ";";
		}
		/** Locate or create the fixed toast column appended to document.body, docked to `position`. */
		function ensureToastHost(position) {
			const style = hostStyle(position);
			if (toastHost !== null && document.body.contains(toastHost)) {
				toastHost.style.cssText = style;
				return toastHost;
			}
			const host = document.createElement("div");
			host.setAttribute("data-task-notify-toasts", "");
			host.style.cssText = style;
			document.body.appendChild(host);
			toastHost = host;
			return host;
		}
		/** Human title for one completion event. */
		function titleOf(event, t) {
			if (event.kind === "turn") return t("event.turn");
			if (event.kind === "job") {
				if (event.job.status === "failed") return t("event.jobFailed");
				if (event.job.status === "killed") return t("event.jobKilled");
				return t("event.jobCompleted");
			}
			if (event.kind === "review") return t("event.review");
			return t("event.failure");
		}
		/** Human body for one completion event. */
		function bodyOf(event, t) {
			if (event.kind === "turn") return event.title ?? event.sessionId;
			if (event.kind === "job") return event.job.label === "" ? event.job.kind : event.job.kind + ": " + event.job.label;
			if (event.kind === "review") return (event.title ?? event.sessionId) + " · " + reviewKindLabel(event.pending, t);
			return (event.title ?? event.sessionId) + (event.message === "" ? "" : " · " + event.message);
		}
		/**
		* The value one template placeholder expands to.
		*
		* `{kind}` is the localized event label ("任务已完成" and friends), `{title}`
		* the most human-readable task label the event carries, `{session}` the raw
		* session id.
		*/
		function templateValue(part, event, t) {
			if (part === "session") return event.sessionId;
			if (part === "kind") return titleOf(event, t);
			if (event.kind === "job") return event.job.label === "" ? event.job.kind : event.job.label;
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
			if (kind === "approval") return t("review.approval");
			if (kind === "plan-review") return t("review.planReview");
			if (kind === "question") return t("review.question");
			return kind;
		}
		/** Fire every enabled channel for one completion event. */
		function notifyEvent(event, options, t) {
			const titleTemplate = options.templateTitle ?? "";
			const bodyTemplate = options.templateBody ?? "";
			const title = titleTemplate.trim() === "" ? titleOf(event, t) : renderTemplate(titleTemplate, event, t);
			const body = bodyTemplate.trim() === "" ? bodyOf(event, t) : renderTemplate(bodyTemplate, event, t);
			showToast(title, body, options.toastSeconds, options.toastPosition ?? "bottom-right");
			if (options.browser) showBrowserNotification(title, body);
			if (options.sound !== "off") playSound(options.sound, options.volume ?? 1, options.soundUrl ?? "");
		}
		/** Clamp a configured toast duration into the supported range. */
		function toastMs(seconds) {
			if (typeof seconds !== "number" || !Number.isFinite(seconds)) return DEFAULT_TOAST_SECONDS * 1e3;
			return Math.min(MAX_TOAST_SECONDS, Math.max(MIN_TOAST_SECONDS, Math.round(seconds))) * 1e3;
		}
		/** Append one auto-dismissing toast card. */
		function showToast(title, body, seconds, position) {
			const host = ensureToastHost(position);
			while (host.children.length >= MAX_TOASTS) {
				const first = host.firstElementChild;
				if (first === null) break;
				first.remove();
			}
			const toast = document.createElement("div");
			toast.setAttribute("role", "status");
			toast.style.cssText = [
				"pointer-events:auto",
				"box-sizing:border-box",
				"min-width:220px",
				"max-width:340px",
				"padding:10px 14px",
				"border:1px solid var(--dsw-alias-border-l2, #30363d)",
				"border-radius:10px",
				"background:var(--dsw-alias-bg-overlay, #161b22)",
				"color:var(--dsw-alias-label-primary, #e6edf3)",
				"box-shadow:0 8px 24px rgba(0,0,0,0.35)",
				"font:13px/18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
			].join(";") + ";";
			const titleEl = document.createElement("div");
			titleEl.textContent = title;
			titleEl.style.cssText = "font-weight:600;margin-bottom:2px;";
			const bodyEl = document.createElement("div");
			bodyEl.textContent = body;
			bodyEl.style.cssText = [
				"opacity:0.85",
				"white-space:nowrap",
				"overflow:hidden",
				"text-overflow:ellipsis"
			].join(";") + ";";
			toast.appendChild(titleEl);
			toast.appendChild(bodyEl);
			host.appendChild(toast);
			window.setTimeout(() => {
				toast.remove();
			}, toastMs(seconds));
		}
		/** Send an OS-level notification, no-oping without permission or support. */
		function showBrowserNotification(title, body) {
			if (typeof Notification === "undefined") return;
			if (Notification.permission !== "granted") return;
			try {
				new Notification(title, { body });
			} catch {}
		}
		/**
		* Request browser-notification permission. Must be called from a user gesture
		* (the settings card's save handler does this when the toggle is enabled).
		* @returns the resulting permission state.
		*/
		function requestBrowserNotificationPermission() {
			if (typeof Notification === "undefined") return Promise.resolve("denied");
			if (Notification.permission !== "default") return Promise.resolve(Notification.permission);
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
			if (url.trim() === "") {
				playTone("double", volume);
				return;
			}
			try {
				const audio = new Audio(url);
				audio.volume = clampVolume(volume);
				const played = audio.play();
				if (played !== void 0) played.catch(() => {});
			} catch {}
		}
		/**
		* Play the built-in beep through the Web Audio API: a single 880 Hz tone or
		* the classic two-tone (880 Hz then 1174.66 Hz), scaled by `volume`.
		*/
		function playTone(mode, volume) {
			try {
				const Ctor = window.AudioContext ?? window.webkitAudioContext;
				if (Ctor === void 0) return;
				if (audio === null) audio = new Ctor();
				const ctx = audio;
				const peak = Math.max(1e-4, .16 * clampVolume(volume));
				ctx.resume().then(() => {
					if (ctx.state !== "running") return;
					const now = ctx.currentTime;
					const gain = ctx.createGain();
					gain.gain.setValueAtTime(1e-4, now);
					gain.gain.exponentialRampToValueAtTime(peak, now + .02);
					gain.gain.exponentialRampToValueAtTime(1e-4, now + .28);
					gain.connect(ctx.destination);
					const schedule = mode === "single" ? [[0, 880]] : [[0, 880], [.12, 1174.66]];
					for (const [delay, freq] of schedule) {
						const osc = ctx.createOscillator();
						osc.type = "sine";
						osc.frequency.value = freq;
						osc.connect(gain);
						osc.start(now + delay);
						osc.stop(now + delay + .16);
					}
				});
			} catch {}
		}
		/** Play the configured sound; `'off'` never reaches the audio paths. */
		function playSound(mode, volume, url) {
			if (mode === "off") return;
			if (mode === "custom") {
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
		function ensureAudioUnlock() {
			if (typeof document === "undefined") return;
			const unlock = () => {
				if (typeof Notification !== "undefined" && Notification.permission === "default") try {
					Notification.requestPermission();
				} catch {}
				try {
					const Ctor = window.AudioContext ?? window.webkitAudioContext;
					if (Ctor !== void 0) {
						if (audio === null) audio = new Ctor();
						audio.resume();
					}
				} catch {}
				document.removeEventListener("pointerdown", unlock);
				document.removeEventListener("keydown", unlock);
			};
			document.addEventListener("pointerdown", unlock);
			document.addEventListener("keydown", unlock);
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* The `task-notify` namespace dictionaries: copy for the reminder channels and
		* the plugin settings page.
		*
		* DSH 0.2 types a slot's `t` seat from the namespace its registration declares,
		* so this module also owns the `LocaleNamespaceMap` merge that makes the key
		* union below the compile-time contract of every `t(...)` call site.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"settings.title": "任务完成提醒",
			"settings.description": "任务或后台作业完成时弹出提醒。",
			"settings.enabled": "启用提醒",
			"settings.enabledHint": "关闭后不弹出任何完成提醒。",
			"settings.turn": "对话任务完成提醒",
			"settings.turnHint": "助手一轮任务（思考或工具调用结束）完成时提醒。",
			"settings.job": "后台任务完成提醒",
			"settings.jobHint": "后台命令或子代理作业结束时提醒。",
			"settings.allSessions": "监听全部会话的后台任务",
			"settings.allSessionsHint": "默认只监听本页面打开后活跃过的会话；开启后为会话列表中每个会话各开一条后台任务流，提醒更全但连接更多。",
			"settings.review": "需要审核时提醒",
			"settings.reviewHint": "任务运行中等待你审批 / 评审计划 / 回答提问时提醒。",
			"settings.failure": "失败时提醒",
			"settings.failureHint": "对话任务报错或后台任务失败 / 被终止时提醒。",
			"settings.browser": "浏览器系统通知",
			"settings.browserHint": "任务完成时发送操作系统通知（需授权）。",
			"settings.soundMode": "提示音",
			"settings.soundModeHint": "选择完成提醒的提示音样式。",
			"settings.soundOff": "无",
			"settings.soundSingle": "单音",
			"settings.soundDouble": "双音",
			"settings.soundCustom": "自定义音频",
			"settings.soundUrl": "音频 URL",
			"settings.soundUrlHint": "提示音为\"自定义音频\"时播放的地址；留空或加载失败时回退为双音。",
			"settings.volume": "音量",
			"settings.toastPosition": "弹窗位置",
			"settings.toastPositionHint": "页面内提醒弹窗停靠的屏幕角落。",
			"settings.toastBottomRight": "右下",
			"settings.toastBottomLeft": "左下",
			"settings.toastTopRight": "右上",
			"settings.toastTopLeft": "左上",
			"settings.toastSeconds": "停留时长（秒）",
			"settings.toastSecondsHint": "弹窗显示 3–15 秒后自动消失。",
			"settings.templateTitle": "自定义标题模板",
			"settings.templateBody": "自定义正文模板",
			"settings.templateHint": "留空使用内置文案。支持占位符：{title}（任务标题）、{session}（会话 ID）、{kind}（事件类型）。",
			"settings.quietEnabled": "免打扰时段",
			"settings.quietEnabledHint": "该时间段内不触发任何提醒；支持跨零点的时段（如 22:00 到 08:00）。",
			"settings.quietFrom": "开始",
			"settings.quietTo": "结束",
			"settings.mutedSessions": "静音的会话",
			"settings.mutedSessionsHint": "每行一个会话 ID；这些会话不触发任何提醒。",
			"event.turn": "任务已完成",
			"event.jobCompleted": "后台任务已完成",
			"event.jobFailed": "后台任务失败",
			"event.jobKilled": "后台任务被终止",
			"event.review": "需要你的审核",
			"event.failure": "任务失败",
			"review.approval": "操作审批",
			"review.planReview": "计划评审",
			"review.question": "提问"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"settings.title": "Task completion reminder",
			"settings.description": "Pop up a reminder when a task or background job completes.",
			"settings.enabled": "Enable reminders",
			"settings.enabledHint": "When off, no completion reminder is shown.",
			"settings.turn": "Turn completion reminder",
			"settings.turnHint": "Remind when an agent turn (thinking or tool use) finishes.",
			"settings.job": "Background job reminder",
			"settings.jobHint": "Remind when a background command or subagent job settles.",
			"settings.allSessions": "Watch background jobs in every session",
			"settings.allSessionsHint": "By default only sessions active since this page opened are watched; enabling this opens one job stream per session in the list — broader coverage, more connections.",
			"settings.review": "Review-needed reminder",
			"settings.reviewHint": "Remind when a running task waits for approval, plan review, or a question answer.",
			"settings.failure": "Failure reminder",
			"settings.failureHint": "Remind when an agent turn errors or a background job fails or is killed.",
			"settings.browser": "Browser notification",
			"settings.browserHint": "Also send an OS-level notification (requires permission).",
			"settings.soundMode": "Sound",
			"settings.soundModeHint": "Choose the sound a completion reminder plays.",
			"settings.soundOff": "None",
			"settings.soundSingle": "Single tone",
			"settings.soundDouble": "Two-tone",
			"settings.soundCustom": "Custom audio",
			"settings.soundUrl": "Audio URL",
			"settings.soundUrlHint": "Played when the sound mode is \"custom audio\"; an empty or unloadable URL falls back to the two-tone.",
			"settings.volume": "Volume",
			"settings.toastPosition": "Toast position",
			"settings.toastPositionHint": "Which screen corner in-page reminder toasts dock to.",
			"settings.toastBottomRight": "Bottom right",
			"settings.toastBottomLeft": "Bottom left",
			"settings.toastTopRight": "Top right",
			"settings.toastTopLeft": "Top left",
			"settings.toastSeconds": "Duration (seconds)",
			"settings.toastSecondsHint": "Toasts auto-dismiss after 3–15 seconds.",
			"settings.templateTitle": "Custom title template",
			"settings.templateBody": "Custom body template",
			"settings.templateHint": "Leave empty for the built-in copy. Placeholders: {title} (task title), {session} (session ID), {kind} (event type).",
			"settings.quietEnabled": "Quiet hours",
			"settings.quietEnabledHint": "No reminders fire inside this time window; windows may cross midnight (e.g. 22:00 to 08:00).",
			"settings.quietFrom": "Start",
			"settings.quietTo": "End",
			"settings.mutedSessions": "Muted sessions",
			"settings.mutedSessionsHint": "One session ID per line; these sessions never trigger a reminder.",
			"event.turn": "Turn finished",
			"event.jobCompleted": "Background job finished",
			"event.jobFailed": "Background job failed",
			"event.jobKilled": "Background job was killed",
			"event.review": "Your review is needed",
			"event.failure": "Task failed",
			"review.approval": "Approval",
			"review.planReview": "Plan review",
			"review.question": "Question"
		};
		/** Dictionary namespace owned by this plugin. */
		const NS = "task-notify";
		//#endregion
		//#region src/client/settings.ts
		const DEFAULTS = {
			enabled: true,
			turn: true,
			job: true,
			allSessions: false,
			review: true,
			failure: true,
			browser: true,
			soundMode: "off",
			soundUrl: "",
			volume: 1,
			toastPosition: "bottom-right",
			toastSeconds: 5,
			templateTitle: "",
			templateBody: "",
			quietEnabled: false,
			quietFrom: "22:00",
			quietTo: "08:00",
			mutedSessions: []
		};
		/** Current storage key — the record shape is defined by {@link TaskNotifySettings}. */
		const STORAGE_KEY = "dsh.taskNotify.v3";
		/**
		* Retired v2 record: the eight booleans with the same names and semantics as
		* today. Read once for the v2 → v3 migration, then removed.
		*/
		const LEGACY_KEY = "dsh.taskNotify.v2";
		const SOUND_MODES = [
			"off",
			"single",
			"double",
			"custom"
		];
		const TOAST_POSITIONS = [
			"bottom-right",
			"bottom-left",
			"top-right",
			"top-left"
		];
		/** Coerce a stored boolean, falling back to the default for non-boolean junk. */
		function bool(value, fallback) {
			return typeof value === "boolean" ? value : fallback;
		}
		/** Coerce a stored string, falling back to the default for non-string junk. */
		function str(value, fallback) {
			return typeof value === "string" ? value : fallback;
		}
		/** Clamp a stored number into `min`–`max`, falling back when absent or junk. */
		function num(value, fallback, min, max) {
			return Math.min(max, Math.max(min, typeof value === "number" && Number.isFinite(value) ? value : fallback));
		}
		function whitelist(value, allowed, fallback) {
			return allowed.includes(value) ? value : fallback;
		}
		function strArray(value) {
			return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
		}
		/**
		* Force a parsed record into a fully-typed settings object.
		*
		* Every field is checked instead of trusted: localStorage can be hand-edited
		* or carry an older shape, and a bad value must degrade to the default rather
		* than break the reminder page or the watcher.
		*/
		function sanitize(parsed) {
			return {
				enabled: bool(parsed.enabled, DEFAULTS.enabled),
				turn: bool(parsed.turn, DEFAULTS.turn),
				job: bool(parsed.job, DEFAULTS.job),
				allSessions: bool(parsed.allSessions, DEFAULTS.allSessions),
				review: bool(parsed.review, DEFAULTS.review),
				failure: bool(parsed.failure, DEFAULTS.failure),
				browser: bool(parsed.browser, DEFAULTS.browser),
				soundMode: whitelist(parsed.soundMode, SOUND_MODES, DEFAULTS.soundMode),
				soundUrl: str(parsed.soundUrl, DEFAULTS.soundUrl),
				volume: num(parsed.volume, DEFAULTS.volume, 0, 1),
				toastPosition: whitelist(parsed.toastPosition, TOAST_POSITIONS, DEFAULTS.toastPosition),
				toastSeconds: num(parsed.toastSeconds, DEFAULTS.toastSeconds, 3, 15),
				templateTitle: str(parsed.templateTitle, DEFAULTS.templateTitle),
				templateBody: str(parsed.templateBody, DEFAULTS.templateBody),
				quietEnabled: bool(parsed.quietEnabled, DEFAULTS.quietEnabled),
				quietFrom: str(parsed.quietFrom, DEFAULTS.quietFrom),
				quietTo: str(parsed.quietTo, DEFAULTS.quietTo),
				mutedSessions: strArray(parsed.mutedSessions)
			};
		}
		/** Map the retired v2 record onto the v3 shape: the boolean sound toggle becomes its mode. */
		function migrateV2(parsed) {
			return sanitize({
				...parsed,
				soundMode: parsed.sound === true ? "double" : "off"
			});
		}
		function parse(raw, legacy) {
			if (raw === null) return {
				...DEFAULTS,
				mutedSessions: []
			};
			try {
				const parsed = JSON.parse(raw);
				return legacy ? migrateV2(parsed) : sanitize(parsed);
			} catch {
				return {
					...DEFAULTS,
					mutedSessions: []
				};
			}
		}
		function load() {
			if (typeof localStorage === "undefined") return {
				...DEFAULTS,
				mutedSessions: []
			};
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw !== null) return parse(raw, false);
				const legacy = localStorage.getItem(LEGACY_KEY);
				if (legacy === null) return {
					...DEFAULTS,
					mutedSessions: []
				};
				const migrated = parse(legacy, true);
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
					localStorage.removeItem(LEGACY_KEY);
				} catch {}
				return migrated;
			} catch {
				return {
					...DEFAULTS,
					mutedSessions: []
				};
			}
		}
		let current = load();
		const listeners = /* @__PURE__ */ new Set();
		function persist() {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
			} catch {}
		}
		/** Read the current settings snapshot (stable reference until a change). */
		function getSettings() {
			return current;
		}
		/** Set one field, persist, and notify subscribers. */
		function setSetting(key, value) {
			current = {
				...current,
				[key]: value
			};
			persist();
			for (const listener of listeners) listener();
		}
		/** Subscribe to settings changes; returns the disposer. */
		function subscribeSettings(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** `HH:MM` → minutes since midnight, or `null` when malformed. */
		function parseClock(value) {
			const match = /^(\d{2}):(\d{2})$/.exec(value);
			if (match === null) return null;
			const hours = Number(match[1]);
			const minutes = Number(match[2]);
			if (hours > 23 || minutes > 59) return null;
			return hours * 60 + minutes;
		}
		/**
		* Whether `now` (local time) falls inside the settings' quiet window.
		*
		* A disabled, malformed, or zero-length window is never quiet — a broken
		* clock string degrades to "reminders on" instead of silencing them.
		* A window whose start is after its end (e.g. `22:00`–`08:00`) crosses
		* midnight and matches either side.
		* @param settings - settings snapshot supplying the quiet window.
		* @param now - injection point for tests; defaults to the current time.
		* @returns true when reminders should be suppressed.
		*/
		function isQuietTime(settings, now = /* @__PURE__ */ new Date()) {
			if (!settings.quietEnabled) return false;
			const from = parseClock(settings.quietFrom);
			const to = parseClock(settings.quietTo);
			if (from === null || to === null || from === to) return false;
			const minutes = now.getHours() * 60 + now.getMinutes();
			return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
		}
		//#endregion
		//#region src/client/TaskNotifySettingsCard.tsx
		/**
		* The task-notify settings page: always-visible controls over the
		* localStorage-backed settings store, contributed to the Plugins settings
		* section's `settings.plugins.tab` seat.
		*
		* DSH 0.2 replaced the old `settings.plugin.item` card list with three seats —
		* a whole page (`settings.section`), a page inside the Plugins section
		* (`settings.plugins.tab`), or one row in General (`settings.general.item`).
		* This plugin owns a page, so it renders its toggles and customization fields
		* as a form rather than as a single `<li>` card. Controls are native elements
		* styled with DSH 0.2 theme tokens: the client bundle may only require the
		* frozen platform module table, so no additional component library is pulled
		* in here.
		*/
		const ROWS = [
			{
				key: "enabled",
				label: "settings.enabled",
				hint: "settings.enabledHint"
			},
			{
				key: "turn",
				label: "settings.turn",
				hint: "settings.turnHint"
			},
			{
				key: "job",
				label: "settings.job",
				hint: "settings.jobHint"
			},
			{
				key: "allSessions",
				label: "settings.allSessions",
				hint: "settings.allSessionsHint"
			},
			{
				key: "review",
				label: "settings.review",
				hint: "settings.reviewHint"
			},
			{
				key: "failure",
				label: "settings.failure",
				hint: "settings.failureHint"
			},
			{
				key: "browser",
				label: "settings.browser",
				hint: "settings.browserHint"
			}
		];
		const SOUND_OPTIONS = [
			{
				value: "off",
				label: "settings.soundOff"
			},
			{
				value: "single",
				label: "settings.soundSingle"
			},
			{
				value: "double",
				label: "settings.soundDouble"
			},
			{
				value: "custom",
				label: "settings.soundCustom"
			}
		];
		const POSITION_OPTIONS = [
			{
				value: "bottom-right",
				label: "settings.toastBottomRight"
			},
			{
				value: "bottom-left",
				label: "settings.toastBottomLeft"
			},
			{
				value: "top-right",
				label: "settings.toastTopRight"
			},
			{
				value: "top-left",
				label: "settings.toastTopLeft"
			}
		];
		const MIN_SECONDS = 3;
		const MAX_SECONDS = 15;
		/** Clamp a typed duration; out-of-range or junk input falls back to the default 5. */
		function clampSeconds(raw) {
			const value = Number(raw);
			if (raw === "" || !Number.isFinite(value)) return 5;
			return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)));
		}
		/** One labelled field block: label, optional hint, then the control(s). */
		function Field(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: styles.label,
						children: props.label
					}),
					props.hint !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: styles.hint,
						children: props.hint
					}) : null,
					props.children
				]
			});
		}
		/**
		* Render the task-notify settings page.
		* @param props - locale copy injected by the slot renderer.
		* @returns the settings page body.
		*/
		function TaskNotifySettingsCard(props) {
			const { t } = props;
			const settings = (0, react.useSyncExternalStore)(subscribeSettings, getSettings);
			const [mutedDraft, setMutedDraft] = (0, react.useState)(() => getSettings().mutedSessions.join("\n"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: styles.page,
				"aria-label": t("settings.title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles.title,
						children: t("settings.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles.desc,
						children: t("settings.description")
					}),
					ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: styles.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							style: styles.checkbox,
							checked: settings[row.key],
							onChange: (event) => {
								const on = event.target.checked;
								setSetting(row.key, on);
								if (row.key === "browser" && on) requestBrowserNotificationPermission();
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: styles.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.label,
								children: t(row.label)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.hint,
								children: t(row.hint)
							})]
						})]
					}, row.key)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
						label: t("settings.soundMode"),
						hint: t("settings.soundModeHint"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								style: styles.input,
								value: settings.soundMode,
								onChange: (event) => setSetting("soundMode", event.target.value),
								children: SOUND_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: option.value,
									children: t(option.label)
								}, option.value))
							}),
							settings.soundMode === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: t("settings.soundUrl"),
								hint: t("settings.soundUrlHint"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "url",
									style: styles.input,
									value: settings.soundUrl,
									placeholder: "https://example.com/ding.mp3",
									onChange: (event) => setSetting("soundUrl", event.target.value)
								})
							}) : null,
							settings.soundMode !== "off" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: `${t("settings.volume")} ${Math.round(settings.volume * 100)}%`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "range",
									style: styles.range,
									min: 0,
									max: 1,
									step: .05,
									value: settings.volume,
									onChange: (event) => setSetting("volume", Number(event.target.value))
								})
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("settings.toastPosition"),
						hint: t("settings.toastPositionHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							style: styles.input,
							value: settings.toastPosition,
							onChange: (event) => setSetting("toastPosition", event.target.value),
							children: POSITION_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option.value,
								children: t(option.label)
							}, option.value))
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("settings.toastSeconds"),
						hint: t("settings.toastSecondsHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							style: styles.input,
							min: MIN_SECONDS,
							max: MAX_SECONDS,
							step: 1,
							value: settings.toastSeconds,
							onChange: (event) => {
								const value = Number(event.target.value);
								if (event.target.value !== "" && value >= MIN_SECONDS && value <= MAX_SECONDS) setSetting("toastSeconds", Math.round(value));
							},
							onBlur: (event) => setSetting("toastSeconds", clampSeconds(event.target.value))
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("settings.templateTitle"),
						hint: t("settings.templateHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: styles.input,
							value: settings.templateTitle,
							onChange: (event) => setSetting("templateTitle", event.target.value)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("settings.templateBody"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: styles.input,
							value: settings.templateBody,
							onChange: (event) => setSetting("templateBody", event.target.value)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: styles.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							style: styles.checkbox,
							checked: settings.quietEnabled,
							onChange: (event) => setSetting("quietEnabled", event.target.checked)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: styles.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.label,
								children: t("settings.quietEnabled")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.hint,
								children: t("settings.quietEnabledHint")
							})]
						})]
					}),
					settings.quietEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.inlineFields,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: styles.inlineField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.hint,
								children: t("settings.quietFrom")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "time",
								style: styles.input,
								value: settings.quietFrom,
								onChange: (event) => setSetting("quietFrom", event.target.value)
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: styles.inlineField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.hint,
								children: t("settings.quietTo")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "time",
								style: styles.input,
								value: settings.quietTo,
								onChange: (event) => setSetting("quietTo", event.target.value)
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("settings.mutedSessions"),
						hint: t("settings.mutedSessionsHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							style: styles.input,
							rows: 3,
							value: mutedDraft,
							onChange: (event) => {
								setMutedDraft(event.target.value);
								setSetting("mutedSessions", event.target.value.split("\n").map((line) => line.trim()).filter((line) => line !== ""));
							}
						})
					})
				]
			});
		}
		const styles = {
			page: {
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				minWidth: 0,
				maxWidth: "560px"
			},
			title: {
				fontSize: "14px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			desc: {
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
			},
			row: {
				display: "flex",
				alignItems: "flex-start",
				gap: "8px",
				cursor: "pointer",
				minWidth: 0
			},
			checkbox: {
				marginTop: "2px",
				flexShrink: 0
			},
			rowText: {
				display: "flex",
				flexDirection: "column",
				gap: "2px",
				minWidth: 0
			},
			field: {
				display: "flex",
				flexDirection: "column",
				gap: "4px",
				minWidth: 0
			},
			label: {
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)"
			},
			hint: {
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
			},
			input: {
				boxSizing: "border-box",
				width: "100%",
				maxWidth: "280px",
				padding: "5px 8px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary, #e6edf3)",
				background: "var(--dsw-alias-bg-overlay, #161b22)",
				border: "1px solid var(--dsw-alias-border-l2, #30363d)",
				borderRadius: "8px"
			},
			range: {
				width: "200px",
				accentColor: "var(--dsw-alias-label-primary, #e6edf3)"
			},
			inlineFields: {
				display: "flex",
				gap: "12px",
				paddingLeft: "24px"
			},
			inlineField: {
				display: "flex",
				flexDirection: "column",
				gap: "2px"
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Services required by this plugin. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"uiSession",
			"jobs"
		];
		/** Presentation options derived from the settings snapshot. */
		function optionsFor(cfg) {
			return {
				browser: cfg.browser,
				sound: cfg.soundMode,
				soundUrl: cfg.soundUrl,
				volume: cfg.volume,
				toastPosition: cfg.toastPosition,
				toastSeconds: cfg.toastSeconds,
				templateTitle: cfg.templateTitle,
				templateBody: cfg.templateBody
			};
		}
		/** Whether a reminder for this session must not fire right now. */
		function suppressed(cfg, sessionId) {
			return isQuietTime(cfg) || cfg.mutedSessions.includes(sessionId);
		}
		/**
		* Register the reminder watcher and its settings page.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "task-notify: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: NS,
				order: 10,
				label: () => t("settings.title"),
				locale: NS
			}, TaskNotifySettingsCard));
			const sessions = ctx.sessions;
			const ui = ctx.uiSession;
			const jobs = ctx.jobs;
			ensureAudioUnlock();
			const activeSessions = /* @__PURE__ */ new Set();
			const jobWatchers = /* @__PURE__ */ new Map();
			/** Open and release job rosters so exactly `targets` are watched. */
			const syncJobWatchers = (targets) => {
				for (const [id, stop] of [...jobWatchers]) {
					if (targets.has(id)) continue;
					stop();
					jobWatchers.delete(id);
				}
				for (const id of targets) {
					if (jobWatchers.has(id)) continue;
					jobWatchers.set(id, jobs.watchRows(id));
				}
			};
			const errorSeen = /* @__PURE__ */ new Map();
			const errorUnsubs = /* @__PURE__ */ new Map();
			const syncErrorWatchers = () => {
				const list = sessions.list.getSnapshot();
				const ids = new Set(list.ids);
				for (const [id, unsubscribe] of [...errorUnsubs]) {
					if (ids.has(id)) continue;
					unsubscribe();
					errorUnsubs.delete(id);
					errorSeen.delete(id);
				}
				for (const id of ids) {
					if (errorUnsubs.has(id)) continue;
					const binding = sessions.binding(id);
					if (binding === void 0) continue;
					const face = binding.session;
					const onSnapshot = () => {
						const error = face.getSnapshot().lastAgentError;
						const before = errorSeen.get(id);
						errorSeen.set(id, error);
						if (before === void 0 || before !== null || error === null) return;
						const cfg = getSettings();
						if (!cfg.enabled || !cfg.failure) return;
						if (suppressed(cfg, id)) return;
						notifyEvent({
							kind: "failure",
							sessionId: id,
							title: sessions.list.getSnapshot().byId[id]?.displayTitle ?? id,
							message: error
						}, optionsFor(cfg), t);
					};
					errorUnsubs.set(id, face.subscribe(onSnapshot));
					onSnapshot();
				}
			};
			let prev = null;
			let inited = false;
			/** One reconcile pass over the three sources. */
			const reconcileOnce = () => {
				const list = sessions.list.getSnapshot();
				const status = ui.sessionStatus.getSnapshot();
				const cfg = getSettings();
				const inList = new Set(Object.keys(list.byId));
				for (const id of activeSessions) if (!inList.has(id)) activeSessions.delete(id);
				const statusRunning = /* @__PURE__ */ new Map();
				for (const [id, value] of status) if (value.running !== void 0) statusRunning.set(id, value.running);
				for (const id of inList) if (statusRunning.get(id) ?? list.byId[id]?.running ?? false) activeSessions.add(id);
				syncJobWatchers(cfg.allSessions ? inList : activeSessions);
				syncErrorWatchers();
				const next = toSnapshotView(list, status, jobs.state.getSnapshot());
				if (!inited) {
					prev = next;
					inited = true;
					return;
				}
				const events = diffCompletions(prev, next);
				prev = next;
				if (events.length === 0 || !cfg.enabled) return;
				for (const event of events) {
					if (event.kind === "turn" && !cfg.turn) continue;
					if (event.kind === "review" && !cfg.review) continue;
					if (event.kind === "failure" && !cfg.failure) continue;
					if (event.kind === "job") {
						const failed = event.job.status === "failed" || event.job.status === "killed";
						if (failed && !cfg.failure) continue;
						if (!failed && !cfg.job) continue;
					}
					if (suppressed(cfg, event.sessionId)) continue;
					notifyEvent(event, optionsFor(cfg), t);
				}
			};
			let reconciling = false;
			let queued = false;
			const reconcile = () => {
				if (reconciling) {
					queued = true;
					return;
				}
				reconciling = true;
				try {
					reconcileOnce();
				} finally {
					reconciling = false;
				}
				if (queued) {
					queued = false;
					reconcile();
				}
			};
			ctx.effect(() => {
				const unsubscribers = [
					sessions.list.subscribe(reconcile),
					ui.sessionStatus.subscribe(reconcile),
					jobs.state.subscribe(reconcile)
				];
				reconcile();
				return () => {
					for (const unsubscribe of unsubscribers) unsubscribe();
					for (const stop of jobWatchers.values()) stop();
					jobWatchers.clear();
					for (const unsubscribe of errorUnsubs.values()) unsubscribe();
					errorUnsubs.clear();
					errorSeen.clear();
				};
			}, "task-notify: watcher");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map