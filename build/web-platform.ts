/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 *
 * The ids live in `./platform-modules.json` so the CommonJS verification script
 * can assert the shipped bundle's externals against the same list the build
 * treats as external — a JSON file is the one artifact both module systems can
 * read without a build step.
 *
 * Mirrors `PLATFORM_MODULES` in `@deepseek-ai/dsh-client-web@0.2.0-rc.2`
 * (`packages/client/web/src/platform.ts`), which is the shell's single source of
 * truth for the frozen module table. DSH 0.2 dropped
 * `@deepseek-ai/dsh-client-runtime`, `dsh-client-web-react`, and
 * `dsh-client-schema-form` from the table and added `dsh-client-store` and
 * `dsh-client-ui-dockkit`.
 * @module @ltao0829/dsh-task-notify/build/web-platform
 */
import platformModules from './platform-modules.json' with { type: 'json' }

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES: readonly string[] = platformModules

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof platformModules)[number]
