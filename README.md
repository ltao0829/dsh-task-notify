# dsh-task-notify

**Lifecycle notification layer for AI coding agents, currently supporting DeepSeek Harness.**

[![CI](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![npm downloads](https://img.shields.io/npm/dm/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](./LICENSE)

**English** · [简体中文](./README.zh-CN.md)

AI coding agents increasingly run long-lived, autonomous tasks: a turn can take minutes, and the human has usually moved to another window. This project adds the missing **notification layer** on top of an agent's task lifecycle, so the moment an agent **completes**, **fails**, settles a **background job**, or starts **waiting for a human** (approval / plan review / question), you get an in-page toast, an OS-level desktop notification, and an optional sound.

> **Inspired by Codex's desktop-notification UX — not a Codex integration. Not affiliated with or sponsored by OpenAI.** Today the project ships as a DeepSeek Harness (DSH) plugin. Its lifecycle-detection core is host-agnostic and is designed to grow into adapters for other coding agents.

## Why this exists

Long-running agent tasks invert the normal attention model: instead of watching a terminal, users submit a task and switch away. UI-only status indicators (a spinner in a background tab) fail exactly when they matter most — when the user is *not looking*. `dsh-task-notify` turns lifecycle transitions into interruptible, OS-level signals, closing the feedback loop between an autonomous agent and a distracted human.

## Demo

> Recordings are not in the repository yet, so the table below lists the three clips by name instead of embedding them. The capture plan (scenes, tooling, size budget) and the exact markup to restore are in [`docs/demo-guide.md`](./docs/demo-guide.md).

| Turn completed | Review needed | Background job failed |
| --- | --- | --- |
| `docs/demo-turn.gif` | `docs/demo-review.gif` | `docs/demo-failure.gif` |

## Features

- **Turn completion** — fires when an agent turn (thinking or tool use) finishes.
- **Background job** — fires when a background command or subagent job settles (`completed`, `failed`, `killed`).
- **Review needed** — fires when a running task waits for approval, plan review, or a question answer.
- **Failure** — fires when an agent turn errors or a background job fails / is killed.
- **Three channels** — OS-level browser notification, in-page toast, optional two-tone beep.
- **Per-event config** — every trigger and channel can be toggled independently.
- **Customizable** — title/body templates, sound style and volume, toast corner and duration, quiet hours, per-session mute.

## Requirements

| Requirement | Notes |
| --- | --- |
| **DeepSeek Harness** | `0.2.0-rc.2` or newer `0.2.x` — the compatibility gate reads `peerDependencies`, and every DSH peer is pinned to `^0.2.0-rc.2` |
| **Node.js** | `>=22.0.0` (CI runs Node 22 and 24; the shipped desktop runtime embeds Node 24) |
| **pnpm** | Needed only when installing through the `dsh plugin` CLI. The desktop app installs with the pnpm it bundles |

## Install

```sh
# from npm — name the range, see the cooldown note below
dsh plugin --profile <profile> add @ltao0829/dsh-task-notify@^0.2.0

# or from Git, pinned to a release tag
dsh plugin --profile <profile> add git+https://github.com/ltao0829/dsh-task-notify.git#v0.2.0
```

`<profile>` is the DSH profile to install into — `web` for a `dsh web` server, `desktop` for the desktop app. Installing adds the package to the profile and registers its bundle patch, which inserts the single `task-notify` row that mounts both halves of the plugin.

On the **desktop app**, install from the app's own **Settings → Plugins** surface. The `desktop` profile is owned by the Electron application — a live profile applies plugin changes immediately and needs no restart, and `dsh --profile desktop …` refuses to run that profile from a second CLI process.

After installing into a `dsh web` server, restart it and refresh the page. On the first click/keypress the browser asks for notification permission — allow it to receive desktop notifications.

> **The version line must match your DSH line.** `0.2.x` requires **DeepSeek Harness 0.2**; the `0.1.x` line requires DSH 0.1.x. They cannot be mixed in either direction: DSH 0.2's compatibility gate refuses the `0.1.x` line outright, and DSH 0.1.x cannot load the `0.2.x` line.
>
> The `0.1.x` line is **discontinued**. npm carries only `0.1.0`; the later `0.1.1` and `0.1.2` fixes exist in the Git history but were never tagged or published. If you are still on DSH 0.1.x, upgrade DSH to 0.2 and install `0.2.x`.

> **Why the version range, not the bare name.** pnpm 11 ships a **24-hour supply-chain cooldown** (`minimumReleaseAge` defaults to `24 * 60` minutes). A version published less than a day ago is invisible to version resolution, so `dsh plugin add @ltao0829/dsh-task-notify` would silently resolve to the *previous* release and be rejected as incompatible. Naming a version or range makes pnpm record a `minimumReleaseAgeExclude` entry and install it straight away; the bare name starts resolving correctly once the release is a day old.

### Uninstall

```sh
dsh plugin --profile <profile> remove @ltao0829/dsh-task-notify
# desktop app: remove it from Settings → Plugins
```

This drops the package and its bundle entry, so the `task-notify` row disappears from the composed profile. The browser-side record in `localStorage` (`dsh.taskNotify.v3`) is not part of the profile: clear that key if you want a reinstall to start from defaults.

## Configuration

The settings page lives in the **Plugins** section of DSH's settings UI (the `settings.plugins.tab` seat added in DSH 0.2), as a page titled *Task completion reminder*. Values are stored locally in `localStorage` under `dsh.taskNotify.v3`. A leftover `v2` record is migrated once — every toggle is kept and the old sound toggle becomes the two-tone mode — and the `v2` key is then removed:

| Switch | Default | Meaning |
| --- | --- | --- |
| Enable reminders | on | master switch |
| Turn completion reminder | on | an agent turn finishes |
| Background job reminder | on | a background command / subagent job settles |
| Watch background jobs in every session | off | open a job stream for every session in the list instead of only the sessions active since this page loaded |
| Review-needed reminder | on | a running task waits for approval / plan review / question |
| Failure reminder | on | a turn errors or a job fails / is killed |
| Browser notification | on | also send an OS-level notification (needs permission) |

### Sound, toasts, and quiet hours

| Setting | Default | Meaning |
| --- | --- | --- |
| Sound | None | None / single tone / two-tone / custom audio |
| Audio URL | empty | played when the mode is *custom audio*; an empty or unloadable URL falls back to the two-tone |
| Volume | 100% | applies to every sound style |
| Toast position | Bottom right | any of the four screen corners |
| Duration (seconds) | 5 | 3–15 seconds before a toast auto-dismisses |
| Custom title / body template | empty | placeholders `{title}` (task title), `{session}` (session ID), `{kind}` (event type); empty uses the built-in localized copy |
| Quiet hours | off | suppress every reminder inside a local-time window; windows may cross midnight (e.g. 22:00 → 08:00) |
| Muted sessions | empty | one session ID per line; these sessions never trigger a reminder |

The in-page toast has no switch — it is the always-available channel, and the fallback whenever a notification is denied or a beep is blocked. Template output is rendered as plain text, so a template cannot inject markup.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Toast shows, but no OS notification | `Notification.permission` is not `granted`; the plugin no-ops rather than failing | Grant the permission. Browsers only prompt during a user gesture, so click once in the page — or toggle **Browser notification** off and on, which asks explicitly |
| No beep | Web Audio starts suspended until a user gesture | Click or press a key once in the page; audio is unlocked on the first gesture |
| Nothing at all | Master switch or the specific trigger is off | Check **Enable reminders** and the per-event toggles |
| No reminder around the hours you set | Quiet hours are enabled and the current local time falls inside the window | Disable **Quiet hours** or adjust the window; sessions on the **Muted sessions** list stay silent too |
| A turn that already finished produced no reminder | The first snapshot after a page load only establishes a baseline | Expected — history is never replayed on refresh |
| Background-job reminders arrive for the session you are watching but not others | By default only Sessions observed running since this page loaded hold a `job.list` stream | Turn on **Watch background jobs in every session** |
| A failed turn produces no reminder | `lastAgentError` exists only on a retained Session face | Expected — the plugin covers the Sessions the workspace already keeps open and does not retain extra Sessions just to watch for errors |
| Install rejected as incompatible | `0.1.x` plugin against DSH 0.2, or the reverse | Match the lines — see the pairing note under [Install](#install) |
| The bare package name installs an older release | pnpm 11's 24-hour `minimumReleaseAge` cooldown | Name the range: `@^0.2.0` |

## Architecture

```text
              coding agent
                   │
                   ▼
     host adapter  (DeepSeek Harness today;
                   Claude Code / Codex / OpenCode later)
                   │
                   ▼
   session snapshots (N-1 vs N)
                   │
                   ▼
   lifecycle detector  ──►  events: turn | job | review | failure
                   │
                   ▼
   notification dispatcher
         │          │          │
         ▼          ▼          ▼
       OS          toast      sound
   notification
```

The detector (`src/detect.ts`) is a **pure function**: a snapshot goes in, lifecycle events come out. It knows nothing about DSH or the DOM, which is what makes additional coding-agent adapters a matter of implementing a new snapshot provider rather than rewriting the notification core.

### Data sources on DSH 0.2

DSH 0.2 replaced the single `sessions.list` store that carried `jobsBySession` and a per-row `pendingInteraction`. The watcher now folds three independent client sources into one snapshot:

| Source | Service | Supplies |
| --- | --- | --- |
| Session catalog | `ctx.sessions.list` | ids, titles, the Host baseline running flag, retention |
| Client status projection | `ctx.uiSession.sessionStatus` | live `running`, the pending interaction (`key` + `kind`), unread completion |
| Job rosters | `ctx.jobs.state` | every watched Session's `JobView` rows, fed by one `job.list` stream per Session |

Consequences worth knowing:

- The **first snapshot only establishes a baseline** — refreshing the page never replays history, and a Session or job roster first seen later is likewise treated as pre-existing.
- A pending interaction is tracked by its **opaque request key**, so a replacement request (approval followed by a question) reminds again while a reconnect replay of the same request stays silent.
- `job.list` is a **per-Session** stream. By default the plugin opens one for each Session observed running since this page loaded — a Session that never ran here cannot hold a job whose completion this page is waiting on. "Watch every session" switches to the whole catalog at the cost of one stream per Session.
- Turn-failure detection reads `lastAgentError`, which exists only on a **retained** Session face. The plugin therefore covers the Sessions the workspace already keeps open and does not retain extra Sessions just to watch for errors.

### Notification channels

The toast mounts directly on `document.body` with no React root and no slot registration, so a reminder still works on screens with no Conversation seat (no Session selected, settings panel open, and so on). At most four toasts stack, each for five seconds. The browser notification is sent only when permission is already `granted`, and the beep resumes a suspended `AudioContext` on first use — every channel degrades quietly rather than throwing.

## Project layout

```text
src/index.ts                          host half — inert loader anchor
src/detect.ts                         pure lifecycle detector (three-source fold + diff)
src/client/index.ts                   browser half — watcher, job-stream and failure watchers, registrations
src/client/notify.ts                  toast / OS notification / sound
src/client/locales.ts                 zh + en dictionaries and the namespace merge
src/client/settings.ts                localStorage-backed settings store
src/client/TaskNotifySettingsCard.tsx settings page (settings.plugins.tab)
tests/*.spec.ts                       detector, lifecycle, settings, notification, manifest, apply() tests
```

## Security & Privacy

- No external server, no cloud backend.
- No telemetry, no analytics, no tracking.
- No API key required.
- Notifications are generated **locally in the browser**.
- Settings are stored locally in `localStorage` only.
- The plugin **does not upload or exfiltrate conversation content**.

The plugin runs with the permissions of your DSH process, like any other DSH plugin.

## Roadmap

This section is the single source of truth for planned work; [`CHANGELOG.md`](./CHANGELOG.md) records what has shipped. Per-item scope, dependencies, risks, and acceptance criteria are in [`docs/roadmap-plan.md`](./docs/roadmap-plan.md).

### Current

- [x] Turn-completion notifications
- [x] Background-job notifications
- [x] Approval / plan-review / question notifications
- [x] Failure notifications
- [x] OS notification + toast + sound
- [x] npm distribution (`@ltao0829/dsh-task-notify`)
- [x] CI/CD (typecheck + test + build + pack dry-run)

### Near term

- [ ] Demo recordings for the README
- [x] npm download metrics (shields.io badge, npm public API only)
- [ ] Adoption tracking over time (weekly download trend)
- [ ] Cross-platform notification backend
- [x] Notification customization
- [x] Test coverage measurement and a raise-only regression gate
- [ ] Raise coverage of the watcher and the notification renderer

### Long term

- [ ] Agent-agnostic lifecycle API
- [ ] Additional coding-agent adapters (Claude Code, Codex, OpenCode, …)
- [ ] Reusable notification core

## Related projects

- [dsh-launcher](https://github.com/ltao0829/dsh-launcher) — one-click launcher for DeepSeek Harness Web.

Together these form a small suite of tooling for AI coding-agent workflows.

Also from the same author: [buaa-auto-auth](https://github.com/ltao0829/buaa-auto-auth) — daily campus-network (SRun) re-authentication for one Windows machine.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Compatibility & Disposable Profile Verification

- **Node.js**: `>=22.0.0` (CI matrix: Node 22 and 24)
- **DeepSeek Harness**: `^0.2.0-rc.2`

DSH 0.2 stopped reading the retired `dsh.compatibility` block. Before a profile imports a plugin, `evaluatePluginCompatibility` (`@deepseek-ai/dsh-app-boot`) checks every `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` entry in **`peerDependencies`** against the single runtime version, with prereleases participating in ranges. This package therefore pins every DSH peer to `^0.2.0-rc.2` and mirrors the same range in `engines.dsh`; `tests/manifest.spec.ts` fails the build if any peer drifts.

> Version `0.2.0` is a **breaking re-target**, not an incremental release: the 0.1.x line is built against the retired `@deepseek-ai/dsh-client-runtime` and the `settings.plugin.item` seat, neither of which exists in DSH 0.2. Only `0.1.0` was ever published to npm; `0.1.1` and `0.1.2` are Git-history-only.

### Isolated Verification Command

To verify plugin installation, configuration composition, web service startup, and cleanup in an isolated disposable DSH profile without touching your existing `~/.dsh`:

```sh
pnpm run verify:profile
```

The check waits up to 90 seconds for first-time DSH profile preparation. Set
`DSH_WEB_START_TIMEOUT_MS` to a positive millisecond value when a runner needs
a different limit. Plugin installation has a separate five-minute default,
configurable with `DSH_PLUGIN_INSTALL_TIMEOUT_MS`.

Evidence report: [`docs/verification-evidence.md`](./docs/verification-evidence.md).

> **Note on limitations**: Catalog validation and disposable profile acceptance verify the plugin lifecycle contract and standard Web profile boot. System-level OS notifications require user-granted browser notification permissions. The disposable-profile run installs the packed tarball into a throwaway `DSH_HOME`; it proves the plugin is *accepted and loaded*, and the client bundle's externals are additionally checked to be platform modules only. It does not drive a real browser, so in-page notification behaviour is covered by the jsdom suites instead.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run coverage
pnpm run build
pnpm run verify:profile
```

`pnpm run build` must run before `pnpm test`: `tests/bundle.spec.ts` asserts that the emitted `lib/client.js` requires only frozen platform modules. `lib/` is committed, so a source change is not complete until the rebuilt artifacts are included.

## License

[BSD-3-Clause](./LICENSE)
