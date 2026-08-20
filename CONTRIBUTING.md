# Contributing to dsh-task-notify

Thanks for your interest! This is a small, focused plugin. Good contributions improve lifecycle detection, notification channels, documentation, and tests.

## Getting started

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

All three scripts must pass before you open a pull request.

## What we're looking for

- **Bug reports** with reproduction steps and environment details.
- **Tests** for any detection or logic change.
- **Documentation** fixes (README, this file, docs/).
- **Adapter ideas** — see the Roadmap section of the README.

## Conventions

- TypeScript in strict mode.
- Keep `src/detect.ts` **pure and host-agnostic** — no DOM, no DSH imports.
- Add unit tests under `tests/` for any logic change.
- Follow the existing commit style: imperative, lowercase subject.

## Pull request process

1. Fork the repository and create a feature branch.
2. Make focused, minimal changes.
3. Add or update tests.
4. Run `pnpm run typecheck`, `pnpm test`, and `pnpm run build`.
5. Open a pull request describing **what** changed and **why**.

## Code of conduct

Be respectful. Keep discussions technical and constructive. Harassment of any kind is not tolerated.
