window.__ModuleLoader__.load({
	id: "@linxin666/dsh-task-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/detect.ts
		/** Job states that count as "finished". */
		const SETTLED = /* @__PURE__ */ new Set([
			"completed",
			"killed",
			"failed"
		]);
		/**
		* Map the runtime's SessionListState into the minimal detector view.
		* @param list - the sessions-list snapshot.
		* @returns the plain view.
		*/
		function toSnapshotView(list) {
			const sessions = {};
			for (const [id, row] of Object.entries(list.byId)) sessions[id] = {
				running: row.running,
				...row.displayTitle === void 0 ? {} : { title: row.displayTitle }
			};
			const jobs = {};
			for (const [sessionId, rows] of Object.entries(list.jobsBySession)) jobs[sessionId] = rows.map((job) => ({
				id: job.id,
				kind: job.kind,
				label: job.label,
				status: job.status
			}));
			return {
				sessions,
				jobs
			};
		}
		/**
		* Diff two snapshots into the completions that happened between them.
		* A null previous snapshot (the first observation) yields nothing so that a
		* page load never fires reminders for every historically-settled task.
		* @param prev - the previous snapshot, or null on the first observation.
		* @param next - the latest snapshot.
		* @returns newly-settled turns and jobs, in stable iteration order.
		*/
		function diffCompletions(prev, next) {
			if (prev === null) return [];
			const events = [];
			for (const [sessionId, row] of Object.entries(next.sessions)) {
				const before = prev.sessions[sessionId];
				if (before !== void 0 && before.running && !row.running) events.push({
					kind: "turn",
					sessionId,
					...row.title === void 0 ? {} : { title: row.title }
				});
			}
			for (const [sessionId, jobs] of Object.entries(next.jobs)) {
				const prevJobs = prev.jobs[sessionId] ?? [];
				const prevById = new Map(prevJobs.map((job) => [job.id, job]));
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
		function titleOf(event) {
			return event.kind === "turn" ? "任务已完成" : "后台任务已完成";
		}
		/** Human body for one completion event. */
		function bodyOf(event) {
			if (event.kind === "turn") return event.title ?? event.sessionId;
			return event.job.label === "" ? event.job.kind : event.job.kind + ": " + event.job.label;
		}
		/** Fire every enabled channel for one completion event. */
		function notifyEvent(event, options) {
			showToast(titleOf(event), bodyOf(event));
			if (options.browser) showBrowserNotification(titleOf(event), bodyOf(event));
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
				"background:var(--dsw-alias-bg-layer-2, #161b22)",
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
		* (the settings card save handler does this when the toggle is enabled).
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
		* The `task-notify` namespace dictionaries: copy for the reminder channels
		* and the plugin settings card (the `web-ui.plugin.item` seat).
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
			"settings.browser": "浏览器系统通知",
			"settings.browserHint": "任务完成时发送操作系统通知（需授权）。",
			"settings.sound": "提示音",
			"settings.soundHint": "任务完成时播放提示音。",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.readOnly": "当前部署的设置只读。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.expand": "展开设置",
			"settings.collapse": "收起设置",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃",
			"settings.unsaved": "未保存",
			"settings.saveFailed": "部署未接受这些值，已保留供你修改。",
			"settings.invalidNumber": "请输入数字，留空则使用默认值。"
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
			"settings.browser": "Browser notification",
			"settings.browserHint": "Also send an OS-level notification (requires permission).",
			"settings.sound": "Sound",
			"settings.soundHint": "Also play a short beep on completion.",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.expand": "Show settings",
			"settings.collapse": "Hide settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default."
		};
		/** Dictionary namespace owned by this plugin. */
		const NS = "task-notify";
		//#endregion
		//#region src/client/settings.ts
		const STORAGE_KEY = "dsh.taskNotify.v1";
		const DEFAULTS = {
			enabled: true,
			turn: true,
			job: true,
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
		* The task-notify settings card: five always-visible toggles over the
		* localStorage-backed settings store. Renders unconditionally (no settings
		* namespace dependency), so it always appears in the Web UI plugin group.
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
		* Render the task-notify card.
		* @param props - locale copy.
		* @returns the card.
		*/
		function TaskNotifySettingsCard(props) {
			const { t } = props;
			const settings = (0, react.useSyncExternalStore)(subscribeSettings, getSettings);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: styles.card,
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
			card: {
				listStyle: "none",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: "8px",
				background: "var(--dsw-alias-bg-layer-3)",
				padding: "12px 14px",
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				minWidth: 0
			},
			title: {
				fontSize: "14px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			desc: {
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)"
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
			"sessions"
		];
		/**
		* Register the reminder watcher and its settings card.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "task-notify: dictionaries");
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "task-notify-settings",
				order: 150,
				locale: NS
			}, TaskNotifySettingsCard));
			ensureAudioUnlock();
			const sessions = ctx.sessions;
			let prev = null;
			let inited = false;
			const applySnapshot = () => {
				const next = toSnapshotView(sessions.list.getSnapshot());
				if (!inited) {
					prev = next;
					inited = true;
					return;
				}
				const events = diffCompletions(prev, next);
				prev = next;
				if (events.length === 0) return;
				const cfg = getSettings();
				if (!cfg.enabled) return;
				for (const event of events) {
					if (event.kind === "turn" && !cfg.turn) continue;
					if (event.kind === "job" && !cfg.job) continue;
					notifyEvent(event, {
						browser: cfg.browser,
						sound: cfg.sound
					});
				}
			};
			ctx.effect(() => {
				const unsubscribe = sessions.list.subscribe(applySnapshot);
				applySnapshot();
				return unsubscribe;
			}, "task-notify: watcher");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map