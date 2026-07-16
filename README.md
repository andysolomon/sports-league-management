# Sports League Management System

A sports league management platform built as a pnpm + Turborepo monorepo: a **Next.js** web app with **Convex** backend, plus an **Ink TUI** operator console.

Salesforce packages (Apex, LWC, scratch-org tooling) now live in a separate repository: [andysolomon/sprts-salesforce](https://github.com/andysolomon/sprts-salesforce).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Web App (apps/web)                                     │
│  Clerk Auth ─► BFF API Routes ─► Convex                         │
│  shadcn/ui + Tailwind CSS + Playwright E2E                      │
├─────────────────────────────────────────────────────────────────┤
│  Ink TUI (apps/tui)                                             │
│  Clerk API Keys ─► /api/cli/* BFF Routes ─► Convex              │
│  Browse, bulk import, debug — terminal operator console          │
├─────────────────────────────────────────────────────────────────┤
│  Shared Packages                                                │
│  @sports-management/shared-types    TypeScript DTOs              │
│  @sports-management/api-contracts   Zod runtime validation       │
└─────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
├── apps/
│   ├── web/                   Next.js frontend (Clerk + Convex)
│   └── tui/                   Ink 7 terminal UI (internal operator console)
├── packages/
│   ├── shared-types/          TypeScript DTO interfaces
│   └── api-contracts/         Zod validation schemas
├── scripts/                   Env checks, GHSA seed helpers
└── docs/                      Guides, sprint plans, market insights
```

**Tooling:** pnpm workspaces + Turborepo for task orchestration, Corepack for pnpm version management.

## Prerequisites

- Node.js 20+
- pnpm 9+ (via Corepack: `corepack enable`)
- A Clerk application (for the web frontend)
- A Convex deployment (see [apps/web/CLAUDE.md](apps/web/CLAUDE.md))

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy env template and fill in Clerk + Convex values
cp apps/web/.env.example apps/web/.env.local

# Start the web app
pnpm --filter @sports-management/web dev
```

The web app runs at `http://localhost:3000`. See [apps/web/README.md](apps/web/README.md) for environment variable setup and [docs/development/DEPLOY.md](docs/development/DEPLOY.md) for production deploy.

### TUI (Terminal Operator Console)

```bash
# Authenticate (one-time: visit /cli-auth in browser, paste the API key)
pnpm tui login

# Launch interactive TUI
pnpm tui

# Or go directly to a screen
pnpm tui leagues
pnpm tui seasons
pnpm tui divisions

# Bulk import teams from CSV
pnpm tui import-teams ./teams.csv
```

See [apps/tui/README.md](apps/tui/README.md) for keyboard shortcuts, navigation, and CSV format.

## Development Workflow

### Web App Development

```bash
# Dev server
pnpm --filter @sports-management/web dev

# Type checking
pnpm --filter @sports-management/web type-check

# Unit tests (Vitest)
pnpm --filter @sports-management/web test:unit

# Build
pnpm --filter @sports-management/web build
```

### Testing

```bash
# TUI tests
pnpm --filter @sports-management/tui test:unit

# Web app unit tests
pnpm --filter @sports-management/web test:unit

# Web E2E — Playwright (Clerk + Convex)
pnpm --filter @sports-management/web test:e2e
pnpm --filter @sports-management/web test:e2e:headed
pnpm --filter @sports-management/web test:e2e:report
```

### Code Quality

```bash
pnpm turbo lint
pnpm turbo type-check
pnpm check:css
pnpm check:env
```

## Salesforce (moved out)

The original Salesforce DX packages (`sportsmgmt`, `sportsmgmt-football`), scratch-org scripts, and Lightning E2E suite have been extracted to [sprts-salesforce](https://github.com/andysolomon/sprts-salesforce). Use that repo for Apex, LWC, and `sf` CLI workflows.

## Documentation

| Document | Description |
|---|---|
| [apps/web/README.md](apps/web/README.md) | Web app setup, architecture, auth, testing |
| [apps/tui/README.md](apps/tui/README.md) | TUI setup, commands, keyboard shortcuts |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/development/DEPLOY.md](docs/development/DEPLOY.md) | Production deploy runbook (Vercel + Convex) |
| [docs/guides/WEB_E2E_TESTING_GUIDE.md](docs/guides/WEB_E2E_TESTING_GUIDE.md) | Web app Playwright E2E — Clerk + Convex |
