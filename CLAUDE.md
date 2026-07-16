# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository scope

This monorepo is **Next.js + Convex + TUI only**. Salesforce packages (Apex, LWC, scratch-org tooling) live in a separate repo: [sprts-salesforce](https://github.com/andysolomon/sprts-salesforce).

## Commands

### Development Workflow

```bash
# Install dependencies
pnpm install

# Web dev server
pnpm --filter @sports-management/web dev

# TUI
pnpm tui

# Type-check all workspace packages
pnpm turbo type-check

# Lint all workspace packages
pnpm turbo lint

# Build all workspace packages
pnpm turbo build
```

### Testing

```bash
# Web unit tests (Vitest)
pnpm --filter @sports-management/web test:unit

# TUI unit tests
pnpm --filter @sports-management/tui test:unit

# Web E2E (Playwright — Clerk + Convex)
pnpm --filter @sports-management/web test:e2e
pnpm --filter @sports-management/web test:e2e:headed
```

### Code Quality

```bash
pnpm check:css
pnpm check:env
pnpm check:launch
```

## Architecture

### Project Structure

- **`apps/web/`** — Next.js 15 frontend with Clerk auth and Convex backend
- **`apps/tui/`** — Ink 7 terminal operator console
- **`packages/shared-types/`** — TypeScript DTO interfaces
- **`packages/api-contracts/`** — Zod validation schemas
- **`scripts/`** — Env parity checks, GHSA seed helpers

### Package Manager

- **pnpm** workspaces with Turborepo (`turbo.json`)
- **Corepack** manages the pnpm version (`packageManager` field in `package.json`)
- Workspace directories: `apps/*`, `packages/*`

### Web App Patterns

- **Auth:** Clerk (session + API keys for CLI/TUI routes)
- **Data:** Convex mutations/queries via `apps/web/convex/`
- **BFF:** Next.js API routes in `apps/web/src/app/api/`
- **Validation:** Zod schemas from `@sports-management/api-contracts`

### Testing Strategy

- **Web unit:** Vitest in `apps/web/src/**/__tests__/`
- **Web E2E:** Playwright in `apps/web/e2e/` (Clerk testing tokens + Convex seed)
- **TUI:** Vitest in `apps/tui/`

## Development Guidelines

### Before Making Changes

1. Run targeted tests for the area you changed
2. For Convex changes, read `apps/web/convex/_generated/ai/guidelines.md` first
3. Follow existing patterns in the surrounding code

### Validation Expectations

- Web/Convex changes: `pnpm --filter @sports-management/web type-check` and relevant `test:unit` / `test:e2e`
- TUI changes: `pnpm --filter @sports-management/tui test:unit`
- Docs-only changes: no heavy test run needed

## Common Tasks

### Adding Web Features

1. Add Convex schema/functions in `apps/web/convex/`
2. Add shared types/contracts in `packages/` if needed
3. Add API routes or server components in `apps/web/src/`
4. Add Vitest and Playwright coverage as appropriate

### Deploy

See [docs/development/DEPLOY.md](docs/development/DEPLOY.md) — web via Vercel, Convex deploy is manual.
