# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- npm distribution and download metrics
- Host-agnostic lifecycle interface (split the detection core from the DSH adapter)
- Additional coding-agent adapters (Claude Code, Codex, OpenCode, …)
- Cross-platform notification backends

## [0.2.0] - 2026-10-02

Re-targets the plugin at **DeepSeek Harness 0.2 (`0.2.0-rc.2`)**. This is a breaking release: DSH 0.2 removed the client packages and slots the 0.1.x line was built on.

### Changed

- **Detection now folds three DSH 0.2 client sources** instead of the retired single `sessions.list` store: `ctx.sessions.list` (catalog and Host baseline), `ctx.uiSession.sessionStatus` (live running state and the pending interaction), and `ctx.jobs.state` (per-Session job rosters).
- **Background jobs are watched per Session.** `IJobs.watchRows(sessionId)` opens one `job.list` stream per Session; the watcher opens one for every Session observed running since page load, and a new "watch every session" setting switches to the whole catalog.
- **A pending interaction is tracked by its opaque request key** rather than by presence alone, so a replacement request reminds again while a reconnect replay of the same request stays silent. The `kind` is now an open, domain-owned string, and an unrecognized kind falls back to the wire word instead of a wrong translation.
- **Settings moved to the `settings.plugins.tab` seat** (Plugins section, one page per contribution). The retired `settings.plugin.item` card list no longer exists, so the settings page renders toggles as a form rather than a single `<li>` card.
- **Client context types come from `@deepseek-ai/cordis`** plus the domain packages' declaration merges; `@deepseek-ai/dsh-client-runtime` was removed from DSH and is no longer referenced.
- **Host half is now inert.** The `schemastery` `Config` schema was dropped along with the dependency: the host half is a loader anchor and holds no settings.
- **Build externals track the 0.2 platform module table** (`@deepseek-ai/dsh-client-store` and `-ui-dockkit` in; `dsh-client-runtime`, `dsh-client-web-react`, and `dsh-client-schema-form` out).
- **Theme tokens refreshed for the 0.2 alias table**: the toast uses `--dsw-alias-bg-overlay`, and the settings page no longer uses the removed `--dsw-alias-label-tertiary`.
- Toast copy is localized through the plugin's own namespace instead of being hard-coded Chinese.

### Added

- Manifest contract tests (`tests/manifest.spec.ts`): `manifestVersion`, the web client platform, the `engines.dsh` range, per-peer range pinning, and patch/plugin identity agreement.
- `tests/client-apply.spec.ts`: drives `apply(ctx)` against a fake client context, covering the registrations and the watcher end-to-end — the seat the 0.1.1 keyed-slot regression escaped through.
- A "watch every session" setting with `zh`/`en` copy.

### Fixed

- Installation is accepted again by DSH 0.2's compatibility gate, which checks `peerDependencies` on `@deepseek-ai/dsh*` against the runtime version. The retired `dsh.compatibility` block and the 0.1.x peer ranges are gone; every DSH peer is pinned to `^0.2.0-rc.2`.

### Removed

- The `dsh.compatibility` manifest block (`dsh` and `dshReleases` tables), which DSH 0.2 no longer reads.
- The `schemastery` runtime dependency and the host `Config` schema.
- The `dsh.taskNotify.v1` storage key in favour of `dsh.taskNotify.v2`, so a DSH 0.2 install starts from clean defaults instead of inheriting a record written by the 0.1.x line.

## [0.1.2] - 2026-09-13

### Fixed

- Remove the obsolete host-side `installSettingsSection` integration, which is not exported by `@deepseek-ai/dsh-settings` in DSH `0.1.5`. Notification preferences remain browser-local as designed.
- Make disposable-profile verification tolerate first-run setup time, probe the authenticated Web URL, report the actual HTTP status, surface pnpm failures, and always clean up the spawned process and temporary profile.

### Changed

- Expand `@deepseek-ai/dsh-*` `peerDependencies` range to `>=0.1.0-rc.6 <0.2.0 || ^0.1.1-rc.1 || ^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1 || ^0.1.5-rc.1` to align with declared DSH releases including `0.1.5-alpha.2`, `0.1.5-rc.1`, and `0.1.5-rc.2`.
- Update `pnpm-lock.yaml` with aligned peerDependencies.

### Added

- Add disposable profile verification script (`scripts/verify-disposable-profile.cjs`) and integrate `verify:profile` into CI workflow.
- Add verification evidence report (`docs/verification-evidence.md`).

## [0.1.1] - 2026-09-13

### Fixed

- Register the settings card into the keyed `settings.plugin.item` slot with a `key` (the settings namespace) instead of a list-slot `id`. The previous wiring made the plugin fail to load with `keyed slot "settings.plugin.item" requires options.key` on dsh `0.1.1-rc.2` (#7).

### Changed

- Declare explicit DSH and Node.js compatibility under `dsh.compatibility` and `engines` in `package.json` for DSH Store catalog contract compliance.

## [0.1.0] - 2026-08-20

Initial release.

### Added

- Turn-completion reminder: fires when an agent turn (thinking or tool use) finishes.
- Background-job reminder: fires when a background command or subagent job settles (`completed` / `failed` / `killed`).
- Review-needed reminder: fires when a running task waits for approval, plan review, or a question answer.
- Failure reminder: fires when an agent turn errors (`lastAgentError`) or a background job fails / is killed.
- Three notification channels: OS-level browser notification, in-page toast, optional two-tone beep.
- Per-event configuration with seven independent toggles, persisted in `localStorage` (`dsh.taskNotify.v1`).
- Host half (`src/index.ts`) registering the `task-notify` settings section.
- Pure snapshot-diff detector (`src/detect.ts`) with Vitest unit tests (`tests/detect.spec.ts`, 15 tests).
- CI workflow (`.github/workflows/ci.yml`): typecheck + test + build on push and pull request.
- English `README.md` and Chinese `README.zh-CN.md` documentation.

### Security

- No external server, telemetry, analytics, or API key. Notifications are generated locally; settings live in `localStorage` only; conversation content is never uploaded.

## [0.0.0] - 2026-08-14

Initial development (pre-release commits).
