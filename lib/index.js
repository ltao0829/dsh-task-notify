import { spawn } from "node:child_process";
import { basename } from "node:path";
//#region src/index.ts
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
/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
const name = "task-notify";
/** No required host services; the settings bridge is registered when connection exists. */
const inject = [];
/** POST target the client settings bridge writes to. */
const ROUTE_PATH = "/api/task-notify/settings";
const DEFAULT_SETTINGS = {
	enabled: true,
	turn: true,
	job: true,
	failure: true,
	browser: true,
	allSessions: false,
	quietEnabled: false,
	quietFrom: "22:00",
	quietTo: "08:00",
	templateTitle: "",
	templateBody: "",
	mutedSessions: []
};
/** Event text mirroring the client half's `task-notify` locale dictionaries. */
const TEXT = {
	zh: {
		turn: "任务已完成",
		jobCompleted: "后台任务已完成",
		jobFailed: "后台任务失败",
		jobKilled: "后台任务被终止",
		failure: "任务失败"
	},
	en: {
		turn: "Turn finished",
		jobCompleted: "Background job finished",
		jobFailed: "Background job failed",
		jobKilled: "Background job was killed",
		failure: "Task failed"
	}
};
const TEMPLATE_PLACEHOLDER = /\{(title|session|kind)\}/g;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
/**
* Coerce one bridge payload into a full settings object. Unknown or malformed
* fields fall back to defaults; a non-object or array payload yields
* `undefined` (caller keeps the previous settings).
*/
function sanitize(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
	const src = raw;
	const bool = (key) => typeof src[key] === "boolean" ? src[key] : DEFAULT_SETTINGS[key];
	const str = (key, fallback) => {
		const value = src[key];
		return typeof value === "string" && HH_MM.test(value) ? value : fallback;
	};
	const text = (key) => typeof src[key] === "string" ? src[key] : "";
	const muted = src.mutedSessions;
	return {
		enabled: bool("enabled"),
		turn: bool("turn"),
		job: bool("job"),
		failure: bool("failure"),
		browser: bool("browser"),
		allSessions: bool("allSessions"),
		quietEnabled: bool("quietEnabled"),
		quietFrom: str("quietFrom", DEFAULT_SETTINGS.quietFrom),
		quietTo: str("quietTo", DEFAULT_SETTINGS.quietTo),
		templateTitle: text("templateTitle"),
		templateBody: text("templateBody"),
		mutedSessions: Array.isArray(muted) ? muted.filter((v) => typeof v === "string") : []
	};
}
/** Minutes since midnight for a valid `HH:MM` string, or `null` on failure. */
function parseClockMinutes(hm) {
	const match = HH_MM.exec(hm);
	if (match === null) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}
/** Mirrors the client half's `isQuietTime` (zero-length disables; overnight wraps midnight). */
function isQuiet(s, now = /* @__PURE__ */ new Date()) {
	if (!s.quietEnabled) return false;
	const from = parseClockMinutes(s.quietFrom);
	const to = parseClockMinutes(s.quietTo);
	if (from === null || to === null || from === to) return false;
	const current = now.getHours() * 60 + now.getMinutes();
	return from < to ? current >= from && current < to : current >= from || current < to;
}
/** One-line error message for a notification body. */
function extractMessage(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return String(error);
	} catch {
		return "";
	}
}
/** Dispatch notification via D-Bus org.freedesktop.Notifications as fallback. */
function sendDbusNotification(title, body) {
	try {
		spawn("gdbus", [
			"call",
			"--session",
			"--dest",
			"org.freedesktop.Notifications",
			"--object-path",
			"/org/freedesktop/Notifications",
			"--method",
			"org.freedesktop.Notifications.Notify",
			"dsh",
			"0",
			"",
			title,
			body,
			"[]",
			"{}",
			"6000"
		], { stdio: "ignore" }).on("error", () => {});
	} catch {}
}
/** Send one native desktop notification via `notify-send`, falling back to D-Bus on ENOENT. */
function sendLinuxNotification(title, body) {
	try {
		spawn("notify-send", [
			"-a",
			"dsh",
			"-t",
			"6000",
			title,
			body
		], { stdio: "ignore" }).on("error", (err) => {
			if (err.code === "ENOENT") sendDbusNotification(title, body);
		});
	} catch (err) {
		if (err.code === "ENOENT") sendDbusNotification(title, body);
	}
}
/**
* Host entrypoint: Linux native notification backend.
* On other platforms (or when passed a stub context without Cordis hooks),
* this stays inert so the browser half owns notifications.
* @param ctx - host plugin context.
*/
function apply(ctx) {
	if (process.platform !== "linux") return;
	if (ctx === null || typeof ctx !== "object" || typeof ctx.on !== "function" || typeof ctx.get !== "function") return;
	const hostCtx = ctx;
	let settings = {
		...DEFAULT_SETTINGS,
		mutedSessions: []
	};
	let lang = "en";
	/** Session ids with a live agent turn (no baseline = no completion event). */
	const running = /* @__PURE__ */ new Set();
	const titles = hostCtx.get("sessionTitle");
	const sessionTitleOf = (session) => {
		const snapshot = session === void 0 ? void 0 : titles?.get(session);
		if (snapshot !== void 0 && snapshot.title !== void 0 && snapshot.title !== "") return snapshot.title;
		const cwd = session?.header?.cwd;
		if (typeof cwd === "string" && cwd !== "") {
			const base = basename(cwd);
			if (base !== "") return base;
		}
		return session?.id ?? "";
	};
	const isSubagentSession = (session) => session?.header?.origin === "subagent";
	const t = (key) => TEXT[lang][key];
	const titleOf = (event) => {
		if (event.kind === "turn") return t("turn");
		if (event.kind === "job") {
			if (event.job?.status === "failed") return t("jobFailed");
			if (event.job?.status === "killed") return t("jobKilled");
			return t("jobCompleted");
		}
		return t("failure");
	};
	const bodyOf = (event) => {
		if (event.kind === "turn") return event.title ?? event.sessionId;
		if (event.kind === "job") return event.job?.label === "" || event.job?.label === void 0 ? event.job?.kind ?? "" : `${event.job.kind}: ${event.job.label}`;
		const message = event.message === "" || event.message === void 0 ? "" : ` · ${event.message}`;
		return `${event.title ?? event.sessionId}${message}`;
	};
	const templateValue = (part, event) => {
		if (part === "session") return event.sessionId;
		if (part === "kind") return titleOf(event);
		if (event.kind === "job") return event.job?.label === "" || event.job?.label === void 0 ? event.job?.kind ?? "" : event.job.label;
		return event.title ?? event.sessionId;
	};
	const renderTemplate = (template, event) => template.replace(TEMPLATE_PLACEHOLDER, (_match, part) => templateValue(part, event));
	/** Fire one native notification through notify-send / D-Bus; failures degrade silently. */
	const fire = (event) => {
		if (!settings.enabled || !settings.browser) return;
		if (event.kind === "turn" && !settings.turn) return;
		if (event.kind === "failure" && !settings.failure) return;
		if (event.kind === "job") {
			if (event.job?.status === "failed" || event.job?.status === "killed" ? !settings.failure : !settings.job) return;
		}
		if (isQuiet(settings) || settings.mutedSessions.includes(event.sessionId)) return;
		const titleTemplate = settings.templateTitle.trim();
		const bodyTemplate = settings.templateBody.trim();
		sendLinuxNotification(titleTemplate === "" ? titleOf(event) : renderTemplate(settings.templateTitle, event), bodyTemplate === "" ? bodyOf(event) : renderTemplate(settings.templateBody, event));
	};
	hostCtx.on("agent/status", ({ agent, status }) => {
		const id = agent.session?.id;
		if (id === void 0) return;
		if (status === "running") {
			running.add(id);
			return;
		}
		if (status === "idle" && running.delete(id) && !isSubagentSession(agent.session)) fire({
			kind: "turn",
			sessionId: id,
			title: sessionTitleOf(agent.session)
		});
	});
	hostCtx.on("agent/disposed", ({ agent }) => {
		const id = agent.session?.id;
		if (id !== void 0) running.delete(id);
	});
	hostCtx.on("agent/error", ({ agent, error }) => {
		const id = agent.session?.id;
		if (id === void 0 || isSubagentSession(agent.session)) return;
		fire({
			kind: "failure",
			sessionId: id,
			title: sessionTitleOf(agent.session),
			message: extractMessage(error).slice(0, 160)
		});
	});
	hostCtx.on("session/event", (session, event) => {
		if (event.type !== "job/settled" || event.data === void 0) return;
		if (isSubagentSession(session) && !settings.allSessions) return;
		fire({
			kind: "job",
			sessionId: event.data.owner ?? session.id ?? "",
			title: sessionTitleOf(session),
			job: {
				kind: event.data.kind ?? "",
				label: event.data.label ?? "",
				status: event.data.status ?? "completed"
			}
		});
	});
	const connection = hostCtx.get("connection");
	if (connection !== void 0) {
		const registerBridge = () => connection.fetch.register({
			path: ROUTE_PATH,
			methods: ["POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				try {
					const body = await request.json();
					if (body === null || typeof body !== "object" || Array.isArray(body)) return new Response("invalid body", { status: 400 });
					const payload = body;
					if (payload.lang === "zh" || payload.lang === "en") lang = payload.lang;
					const next = sanitize(payload.settings);
					if (next !== void 0) settings = next;
					return new Response("ok", { status: 200 });
				} catch {
					return new Response("invalid body", { status: 400 });
				}
			}
		});
		if (typeof hostCtx.effect === "function") hostCtx.effect(registerBridge, "task-notify: settings bridge");
		else registerBridge();
	}
}
//#endregion
export { apply, inject, name };
