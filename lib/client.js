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
		/** How long a toast stays on screen. */
		const TOAST_MS = 5e3;
		/** Maximum stacked toasts before the oldest is dropped. */
		const MAX_TOASTS = 4;
		let toastHost = null;
		let audio = null;
		/** Locate or create the fixed toast column appended to document.body. */
		function ensureToastHost() {
			if (toastHost !== null && document.body.contains(toastHost)) return toastHost;
			const host = document.createElement("div");
			host.setAttribute("data-task-notify-toasts", "");
			host.style.cssText = [
				"position:fixed",
				"right:16px",
				"bottom:16px",
				"z-index:2147483000",
				"display:flex",
				"flex-direction:column",
				"gap:8px",
				"pointer-events:none"
			].join(";") + ";";
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
		* Human label for a pending-interaction kind.
		*
		* The kind is a domain-owned open string (ui-approval, ui-plan,
		* ui-user-questions each merge their own), so an unrecognized domain falls back
		* to the wire word rather than to a wrong translation.
		* @param kind - the pending interaction's domain discriminator.
		* @param t - namespace-bound translate.
		* @returns display text.
		*/
		function reviewKindLabel(kind, t) {
			if (kind === "approval") return t("review.approval");
			if (kind === "plan-review") return t("review.planReview");
			if (kind === "question") return t("review.question");
			return kind;
		}
		/** Fire every enabled channel for one completion event. */
		function notifyEvent(event, options, t) {
			const title = titleOf(event, t);
			const body = bodyOf(event, t);
			showToast(title, body);
			if (options.browser) showBrowserNotification(title, body);
			if (options.sound) playSound();
		}
		/** Append one auto-dismissing toast card. */
		function showToast(title, body) {
			const host = ensureToastHost();
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
			}, TOAST_MS);
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
		/** Play a short two-tone completion beep through the Web Audio API. */
		function playSound() {
			try {
				const Ctor = window.AudioContext ?? window.webkitAudioContext;
				if (Ctor === void 0) return;
				if (audio === null) audio = new Ctor();
				const ctx = audio;
				ctx.resume().then(() => {
					if (ctx.state !== "running") return;
					const now = ctx.currentTime;
					const gain = ctx.createGain();
					gain.gain.setValueAtTime(1e-4, now);
					gain.gain.exponentialRampToValueAtTime(.16, now + .02);
					gain.gain.exponentialRampToValueAtTime(1e-4, now + .28);
					gain.connect(ctx.destination);
					for (const [delay, freq] of [[0, 880], [.12, 1174.66]]) {
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
			"settings.sound": "提示音",
			"settings.soundHint": "任务完成时播放提示音。",
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
			"settings.sound": "Sound",
			"settings.soundHint": "Also play a short beep on completion.",
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
		/**
		* Bumped from `dsh.taskNotify.v1`: DSH 0.2 added `allSessions`, and a v1
		* record silently inherits the new default instead of being migrated.
		*/
		const STORAGE_KEY = "dsh.taskNotify.v2";
		const DEFAULTS = {
			enabled: true,
			turn: true,
			job: true,
			allSessions: false,
			review: true,
			failure: true,
			browser: true,
			sound: false
		};
		let current = load();
		const listeners = /* @__PURE__ */ new Set();
		function load() {
			if (typeof localStorage === "undefined") return { ...DEFAULTS };
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw === null) return { ...DEFAULTS };
				const parsed = JSON.parse(raw);
				return {
					...DEFAULTS,
					...parsed
				};
			} catch {
				return { ...DEFAULTS };
			}
		}
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
		//#endregion
		//#region src/client/TaskNotifySettingsCard.tsx
		/**
		* The task-notify settings page: always-visible toggles over the
		* localStorage-backed settings store, contributed to the Plugins settings
		* section's `settings.plugins.tab` seat.
		*
		* DSH 0.2 replaced the old `settings.plugin.item` card list with three seats —
		* a whole page (`settings.section`), a page inside the Plugins section
		* (`settings.plugins.tab`), or one row in General (`settings.general.item`).
		* This plugin owns a page, so it renders its toggles as a form rather than as a
		* single `<li>` card.
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
			},
			{
				key: "sound",
				label: "settings.sound",
				hint: "settings.soundHint"
			}
		];
		/**
		* Render the task-notify settings page.
		* @param props - locale copy injected by the slot renderer.
		* @returns the settings page body.
		*/
		function TaskNotifySettingsCard(props) {
			const { t } = props;
			const settings = (0, react.useSyncExternalStore)(subscribeSettings, getSettings);
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
					}, row.key))
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
			label: {
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)"
			},
			hint: {
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
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
						notifyEvent({
							kind: "failure",
							sessionId: id,
							title: sessions.list.getSnapshot().byId[id]?.displayTitle ?? id,
							message: error
						}, {
							browser: cfg.browser,
							sound: cfg.sound
						}, t);
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
					notifyEvent(event, {
						browser: cfg.browser,
						sound: cfg.sound
					}, t);
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