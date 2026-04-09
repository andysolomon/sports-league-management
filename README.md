# Sports League Management System

A full-stack sports league management platform combining a Salesforce backend (Apex + LWC) with a Next.js frontend. The system manages leagues, divisions, teams, players, and seasons through both a Salesforce Lightning Experience app and an external web application with role-based access control.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Web App (apps/web)                                     │
│  Clerk Auth ─► BFF API Routes ─► Salesforce REST API            │
│  shadcn/ui + Tailwind CSS + Playwright E2E                      │
├─────────────────────────────────────────────────────────────────┤
│  Ink TUI (apps/tui)                                             │
│  Clerk API Keys ─► /api/cli/* BFF Routes ─► Salesforce REST API │
│  Browse, bulk import, debug — terminal operator console          │
├─────────────────────────────────────────────────────────────────┤
│  Shared Packages                                                │
│  @sports-management/shared-types    TypeScript DTOs              │
│  @sports-management/api-contracts   Zod runtime validation       │
├─────────────────────────────────────────────────────────────────┤
│  Salesforce Platform                                             │
│  sportsmgmt (Core)        Apex services, REST API, LWC, objects  │
│  sportsmgmt-football      Sport-specific extension (scaffolded)  │
└─────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
├── apps/
│   ├── web/                   Next.js 15 frontend (Clerk + Salesforce JWT)
│   └── tui/                   Ink 7 terminal UI (internal operator console)
├── packages/
│   ├── shared-types/          TypeScript DTO interfaces
│   └── api-contracts/         Zod validation schemas
├── sportsmgmt/                Salesforce core package (5 custom objects, Apex, LWC)
├── sportsmgmt-football/       Salesforce football extension (scaffolded)
├── scripts/                   Scratch org setup, data seeding, E2E runner
├── config/                    Scratch org definitions
├── data/                      Seed data (JSON import plans)
└── docs/                      Sprint plans, guides, market insights
```

**Tooling:** pnpm workspaces + Turborepo for task orchestration, Corepack for pnpm version management.

## Prerequisites

- Node.js 18+
- pnpm 9+ (via Corepack: `corepack enable`)
- Salesforce CLI (`sf`)
- A Salesforce Dev Hub org
- A Clerk application (for the web frontend)

## Quick Start

```bash
# Install dependencies
pnpm install

# Create and configure a scratch org
node scripts/create-scratch-org.js sports-dev 7

# Deploy Salesforce metadata
sf project deploy start

# Seed test data
node scripts/seed-data.js

# Start the web app
pnpm --filter @sports-management/web dev
```

The web app runs at `http://localhost:3000`. See [apps/web/README.md](apps/web/README.md) for environment variable setup.

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

### Salesforce Development

```bash
# Deploy all metadata
sf project deploy start

# Deploy specific components
sf project deploy start --source-dir sportsmgmt/main/default/classes
sf project deploy start --source-dir sportsmgmt/main/default/lwc

# Run all Apex tests (233 tests)
sf apex test run --wait 10 --code-coverage --result-format human

# Run specific test classes
sf apex test run --tests DivisionServiceTest,TeamRepositoryTest --wait 10
```

### Web App Development

```bash
# Dev server
pnpm --filter @sports-management/web dev

# Type checking
pnpm --filter @sports-management/web type-check

# Build
pnpm --filter @sports-management/web build
```

### Testing

```bash
# Apex tests (233 tests, 82% org-wide coverage)
sf apex test run --wait 10 --code-coverage --result-format human

# LWC Jest tests (37 tests across 5 suites)
pnpm exec jest --config jest.config.js

# TUI tests (88 tests)
pnpm --filter @sports-management/tui test:unit

# Web app tests (74 tests)
pnpm --filter @sports-management/web test:unit

# E2E tests — Playwright (81 tests across 14 specs)
pnpm --filter @sports-management/web test:e2e          # Headless
pnpm --filter @sports-management/web test:e2e:headed    # Visible browser
pnpm --filter @sports-management/web test:e2e:report    # With HTML report

# Convenience script (checks org, loads seed data, runs E2E)
./scripts/run-e2e-tests.sh [org-alias] [--headed] [--report]
```

### Code Quality

```bash
pnpm run lint              # ESLint (LWC/Aura)
pnpm run prettier          # Format all files
pnpm run prettier:verify   # Check formatting
```

## Data Model

```
League__c (1) ──── (n) Division__c
League__c (1) ──── (n) Team__c
League__c (1) ──── (n) Season__c
Team__c   (1) ──── (n) Player__c
Division__c (1) ── (n) Team__c (via lookup)
```

**Core Objects:** League, Division, Team, Player, Season — each with full CRUD through both Apex REST endpoints and LWC controllers.

## Permission Sets

| Permission Set | Access Level |
|---|---|
| `Sports_League_Management_Access` | App visibility only |
| `League_Administrator` | Full CRUD on all 5 objects |
| `Team_Manager` | CRUD on Team/Player, Read on League/Division/Season |
| `Data_Viewer` | Read-only on all 5 objects |
| `External_App_Integration` | API access for the web frontend |

## Package Management

The Salesforce solution ships as two unlocked packages:

- **Sports Management Core** (`sportsmgmt`) — Base framework, all 5 objects, services, REST API
- **Sports Management Football** (`sportsmgmt-football`) — Football-specific extensions (depends on Core)

```bash
# Create package versions
./scripts/package-management.sh create-versions --wait 15

# Validate deployment
sf project deploy validate --source-dir sportsmgmt
```

## Documentation

| Document | Description |
|---|---|
| [apps/tui/README.md](apps/tui/README.md) | TUI setup, commands, keyboard shortcuts, architecture |
| [apps/web/README.md](apps/web/README.md) | Web app setup, architecture, auth, Salesforce integration |
| [sportsmgmt/README.md](sportsmgmt/README.md) | Core Salesforce package — objects, Apex classes, LWC |
| [sportsmgmt-football/README.md](sportsmgmt-football/README.md) | Football extension package |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/guides/E2E_TESTING_GUIDE.md](docs/guides/E2E_TESTING_GUIDE.md) | E2E testing setup and patterns |
| [docs/guides/USER_SETUP.md](docs/guides/USER_SETUP.md) | User and permission configuration |
| [docs/guides/SF_CLI_AND_OBJECT_REFERENCE_GUIDE.md](docs/guides/SF_CLI_AND_OBJECT_REFERENCE_GUIDE.md) | Salesforce CLI reference |

## Automation Scripts

| Script | Purpose |
|---|---|
| `scripts/create-scratch-org.js` | Full scratch org setup with users and permissions |
| `scripts/setup-users.js` | User creation and role-based permission set assignment |
| `scripts/seed-data.js` | Generate test data (leagues, teams, players, seasons) |
| `scripts/run-e2e-tests.sh` | Run Playwright E2E tests against a scratch org |
| `scripts/package-management.sh` | Package version creation and deployment |
