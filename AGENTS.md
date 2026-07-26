# AGENTS.md

## Cursor Cloud specific instructions

Primary product is the Next.js web app in `apps/web` (backend: **Convex**, auth:
**Clerk**). The `sportsmgmt*` Salesforce packages are legacy (see
`apps/web/README.md`); the Salesforce toolchain (`sf` CLI + a Dev Hub org login)
is not provisioned in this environment. Standard commands live in the root
`README.md`, `CLAUDE.md`, and each `package.json`; only the non-obvious caveats
are below.

### Environment / build order
- The startup update script runs `pnpm install` and builds
  `@sports-management/api-contracts` (its `exports` point at `dist/`, so it must
  be compiled with `tsc` before the web app can type-check, test, build, or run).
  `@sports-management/shared-types` and `@sports-management/design-system`
  export TypeScript source directly and need no build.
- If you `pnpm install` again and see `Failed to resolve entry for package
  "@sports-management/api-contracts"` in vitest/tsc/next, rebuild it:
  `pnpm --filter @sports-management/api-contracts build`.
- Turbo tasks declare `dependsOn: ["^build"]`; running a package's script
  directly (e.g. `pnpm --filter @sports-management/web test:unit`) skips that,
  so build the shared lib first (the update script already does).

### Running the web app locally (`apps/web`)
- `apps/web/.env.local` is required (not committed). Copy `.env.local.example`
  and fill it in. Convex + Clerk keys must be present or the app 500s / redirects.
- Convex local backend: start it non-interactively with
  `CONVEX_AGENT_MODE=anonymous npx convex dev` from `apps/web`. Plain
  `npx convex dev` prompts for login/anonymous selection and will hang a
  non-interactive shell. This writes `CONVEX_DEPLOYMENT` and
  `NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local` and serves the DB on
  `:3210` and a local dashboard on `:6790`. The anonymous backend's admin key
  **rotates** on every re-provision — see `docs/development/LOCAL_TESTING.md`.
- Dev server: `pnpm --filter @sports-management/web dev` (port 3000).
- **Clerk gates the entire browser UI.** `ClerkProvider` wraps the root layout,
  so even public routes (`/`, `/local`) trigger a client-side Clerk dev
  handshake in the browser. A **real** `pk_test_`/`sk_test_` dev instance is
  required — placeholder keys make the browser redirect to an invalid Clerk host
  ("Invalid host"). The server still returns 200 (curl works); the redirect is
  client-side only. To exercise authenticated flows, sign in with a
  `…+clerk_test@example.com` user and verification code `424242` (dev instances
  only).
- Without Clerk keys you can still verify the backend end-to-end via the running
  Convex service: enable seeds with `npx convex env set CONVEX_ENABLE_E2E_SEED 1`,
  then `npx convex run e2eSeed:createCanonicalFixture '{"clerkOrgId": null}'`,
  and inspect tables with `npx convex data leagues|teams|players` or the
  dashboard at `:6790`.

### Tests
- Web unit tests (`pnpm --filter @sports-management/web test:unit`, Vitest +
  `convex-test`) and TUI unit tests (`pnpm --filter @sports-management/tui
  test:unit`) need no live services.
- Playwright E2E requires Convex + Clerk env vars; use
  `apps/web/scripts/local-e2e.sh` (see `docs/development/LOCAL_TESTING.md`).
