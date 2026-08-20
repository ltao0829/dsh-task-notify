# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- npm distribution and download metrics
- Host-agnostic lifecycle interface (split the detection core from the DSH adapter)
- Additional coding-agent adapters (Claude Code, Codex, OpenCode, …)
- Cross-platform notification backends

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
