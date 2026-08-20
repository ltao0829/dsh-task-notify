# dsh-task-notify

**Task lifecycle notifications for AI coding agents — currently supporting DeepSeek Harness.**

[![CI](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/ltao0829/dsh-task-notify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ltao0829/dsh-task-notify)](https://www.npmjs.com/package/@ltao0829/dsh-task-notify)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](./LICENSE)

AI coding agents increasingly run long-lived, autonomous tasks: a turn can take minutes, and the human has usually moved to another window. This project adds the missing **notification layer** on top of an agent's task lifecycle, so the moment an agent **completes**, **fails**, settles a **background job**, or starts **waiting for a human** (approval / plan review / question), you get an in-page toast, an OS-level desktop notification, and an optional sound.

> **Inspired by Codex's desktop-notification UX — not a Codex integration.** Today the project ships as a DeepSeek Harness (DSH) plugin. Its lifecycle-detection core is host-agnostic and is designed to grow into adapters for other coding agents.

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

Prerequisites: [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```sh
# from Git
dsh plugin --profile web add git+https://github.com/ltao0829/dsh-task-notify.git

# from npm (once published)
dsh plugin --profile web add @ltao0829/dsh-task-notify
```

Restart `dsh web` and refresh the page. On the first click/keypress the browser asks for notification permission — allow it to receive desktop notifications.

## Configuration

The settings card lives in the plugin section of DSH's settings UI. Values are stored locally in `localStorage` (`dsh.taskNotify.v1`):

| Toggle | Default | Meaning |
| --- | --- | --- |
| Enable reminders | on | master switch |
| Turn completion | on | an agent turn finishes |
| Background job | on | a background command / subagent job settles |
| Review needed | on | a running task waits for approval / plan review / question |
| Failure | on | a turn errors or a job fails / is killed |
| Browser notification | on | also send an OS-level notification (needs permission) |
| Sound | off | also play a short beep |

## How it works

The watcher subscribes to the DSH sessions-list store and diffs consecutive snapshots. Detection is a **pure function** (`src/detect.ts`) that maps a snapshot into a minimal view and emits lifecycle events; the notification dispatcher then routes each event to the enabled channels.

```text
sessions store:  snapshot N-1 ──┐
                                ├── diff ──► lifecycle events
sessions store:  snapshot N   ──┘            turn | job | review | failure
                                                      │
                                        notification dispatcher
                                    ┌───────────┬───────────┐
                                    ▼           ▼           ▼
                                  toast    OS notification  sound
```

- The **first snapshot only establishes a baseline** — refreshing the page never replays history.
- `src/detect.ts` is host-agnostic (plain data in / plain data out) and is unit-tested in isolation.

## Project layout

```text
src/index.ts                         host half — registers the settings section
src/detect.ts                        pure lifecycle detector (snapshot diff)
src/client/index.ts                  browser half — watcher + failure watcher
src/client/notify.ts                 toast / OS notification / sound
src/client/settings.ts               localStorage-backed settings store
src/client/TaskNotifySettingsCard.tsx settings UI card
tests/detect.spec.ts                 unit tests for the detector
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

- [x] Turn-completion notifications
- [x] Background-job notifications
- [x] Approval / plan-review / question notifications
- [x] Failure notifications
- [x] OS notification + toast + sound
- [ ] npm distribution and download metrics
- [ ] Host-agnostic lifecycle interface (split the detection core from the DSH adapter)
- [ ] Additional coding-agent adapters (Claude Code, Codex, OpenCode, …)
- [ ] Cross-platform notification backends

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## License

[BSD-3-Clause](./LICENSE)
