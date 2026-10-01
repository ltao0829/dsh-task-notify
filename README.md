# dsh-task-notify

**Lifecycle notification layer for AI coding agents, currently supporting DeepSeek Harness.**

[![CI](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](./LICENSE)

AI coding agents increasingly run long-lived, autonomous tasks: a turn can take minutes, and the human has usually moved to another window. This project adds the missing **notification layer** on top of an agent's task lifecycle, so the moment an agent **completes**, **fails**, settles a **background job**, or starts **waiting for a human** (approval / plan review / question), you get an in-page toast, an OS-level desktop notification, and an optional sound.

> **Inspired by Codex's desktop-notification UX — not a Codex integration. Not affiliated with or sponsored by OpenAI.** Today the project ships as a DeepSeek Harness (DSH) plugin. Its lifecycle-detection core is host-agnostic and is designed to grow into adapters for other coding agents.

## Why this exists

Long-running agent tasks invert the normal attention model: instead of watching a terminal, users submit a task and switch away. UI-only status indicators (a spinner in a background tab) fail exactly when they matter most — when the user is *not looking*. `dsh-task-notify` turns lifecycle transitions into interruptible, OS-level signals, closing the feedback loop between an autonomous agent and a distracted human.

## Demo

> Placeholder — replace with short recordings (GIF or MP4, ~10–30 s each). See [`docs/demo-guide.md`](./docs/demo-guide.md).

| Turn completed | Approval required | Background job failed |
| --- | --- | --- |
| ![Turn completed](docs/demo-turn.gif) | ![Approval required](docs/demo-review.gif) | ![Job failed](docs/demo-failure.gif) |

## Features

- **Turn completion** — fires when an agent turn (thinking or tool use) finishes.
- **Background job** — fires when a background command or subagent job settles (`completed`, `failed`, `killed`).
- **Review needed** — fires when a running task waits for approval, plan review, or a question answer.
- **Failure** — fires when an agent turn errors or a background job fails / is killed.
- **Three channels** — OS-level browser notification, in-page toast, optional two-tone beep.
- **Per-event config** — every trigger and channel can be toggled independently.

## Install

Prerequisites: [Node.js](https://nodejs.org) `>=22` and [pnpm](https://pnpm.io).

```sh
# from npm — name the range, see the cooldown note below
dsh plugin --profile <profile> add @ltao0829/dsh-task-notify@^0.2.0

# or from Git, pinned to a release tag
dsh plugin --profile <profile> add git+https://github.com/ltao0829/dsh-task-notify.git#v0.2.0
```

`<profile>` is the DSH profile to install into — `web` for a `dsh web` server, `desktop` for the desktop app.

> **Version and DSH line must match.** `0.2.x` requires **DeepSeek Harness 0.2**; on DSH 0.1.x install `0.1.2` instead. The two lines cannot be mixed in either direction: DSH 0.2's compatibility gate refuses the 0.1.x line outright, and DSH 0.1.x cannot load the 0.2.x line.

> **Why the version range, not the bare name.** pnpm 11 ships a **24-hour supply-chain cooldown** (`minimumReleaseAge` defaults to `24 * 60` minutes). A version published less than a day ago is invisible to version resolution, so `dsh plugin add @ltao0829/dsh-task-notify` would silently resolve to the *previous* release and be rejected as incompatible. Naming a version or range makes pnpm record a `minimumReleaseAgeExclude` entry and install it straight away; the bare name starts resolving correctly once the release is a day old.

Restart `dsh web` and refresh the page. On the first click/keypress the browser asks for notification permission — allow it to receive desktop notifications.

## Configuration

The settings page lives in the **Plugins** section of DSH's settings UI (the `settings.plugins.tab` seat added in DSH 0.2). Values are stored locally in `localStorage` (`dsh.taskNotify.v2`):

| Toggle | Default | Meaning |
| --- | --- | --- |
| Enable reminders | on | master switch |
| Turn completion | on | an agent turn finishes |
| Background job | on | a background command / subagent job settles |
| Watch every session | off | open a job stream for every session in the list instead of only the sessions active since this page loaded |
| Review needed | on | a running task waits for approval / plan review / question |
| Failure | on | a turn errors or a job fails / is killed |
| Browser notification | on | also send an OS-level notification (needs permission) |
| Sound | off | also play a short beep |

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

### Current

- [x] Turn-completion notifications
- [x] Background-job notifications
- [x] Approval / plan-review / question notifications
- [x] Failure notifications
- [x] OS notification + toast + sound
- [x] npm distribution (`@ltao0829/dsh-task-notify`)
- [x] CI/CD (typecheck + test + build + pack dry-run)

### Near term

- [ ] npm download metrics / adoption tracking
- [ ] Cross-platform notification backend
- [ ] Notification customization
- [ ] Better test coverage

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

> Version `0.2.0` is a **breaking re-target**, not an incremental release: the 0.1.x line is built against the retired `@deepseek-ai/dsh-client-runtime` and the `settings.plugin.item` seat, neither of which exists in DSH 0.2.

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

> **Note on limitations**: Catalog validation and disposable profile acceptance verify the plugin lifecycle contract and standard Web profile boot. System-level OS notifications require user-granted browser notification permissions. The disposable-profile run installs the packed tarball into a throwaway `DSH_HOME`; it proves the plugin is *accepted and loaded*, and the client bundle's externals are additionally checked to be platform modules only.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run verify:profile
```

## License

[BSD-3-Clause](./LICENSE)
