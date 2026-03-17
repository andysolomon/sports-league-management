# Sprint 2025.09 — External React Frontend

## Sprint Details

- **Sprint Name:** 2025.09 - Sports League Development Team
- **Team:** Sports League Development Team
- **Start Date:** 2026-04-13
- **End Date:** 2026-04-24
- **Total Story Points:** 32

## Epic

**External React Frontend** — Introduce a public-facing React/Next.js application alongside the existing Salesforce Lightning Experience, enabling fans and external users to view league data via Google sign-in (Clerk) while keeping Salesforce as the system of record and operator-only admin tool.

## Stories

### W-000028: [Infrastructure] Migrate to pnpm Monorepo with Turborepo (3 pts)

Convert the repo from npm to a pnpm monorepo managed by Turborepo, enabling shared packages between the Salesforce project and the new frontend app.

**Acceptance Criteria:**
- `pnpm-workspace.yaml` with `apps/*` and `packages/*` workspaces
- `turbo.json` with build/dev/lint/type-check/test tasks
- `.npmrc` with `shamefully-hoist=true`
- Root `package.json` updated with `packageManager` field
- `package-lock.json` removed, `pnpm-lock.yaml` generated
- All existing tooling still works: `pnpm run test:unit`, `pnpm run lint`, `sf project deploy start`

**Implementation Plan:**
1. Install pnpm globally and run `pnpm import` to convert `package-lock.json` to `pnpm-lock.yaml`
2. Create `pnpm-workspace.yaml` defining `apps/*` and `packages/*` workspaces
3. Add `turbo.json` with pipeline tasks: build, dev, lint, type-check, test
4. Add `.npmrc` with `shamefully-hoist=true` for Salesforce CLI compatibility
5. Update root `package.json` with `packageManager` field pointing to pnpm version
6. Remove `package-lock.json`, verify `pnpm install` succeeds
7. Validate all existing scripts: `pnpm run test:unit`, `pnpm run lint`, `sf project deploy start`

### W-000029: [Frontend] Scaffold Next.js App with Clerk Auth (5 pts)

Create the Next.js 15 app shell with Clerk authentication, establishing the foundation for all frontend pages.

**Acceptance Criteria:**
- `apps/web/` with Next.js 15, React 19, TypeScript, Tailwind CSS v4
- Clerk SDK (`@clerk/nextjs`) configured for authentication (Google, email, etc. via Clerk dashboard)
- `ClerkProvider` wrapping the app in root layout
- Clerk middleware (`clerkMiddleware()`) protecting authenticated routes
- jsforce connection singleton with JWT bearer flow for Salesforce integration
- `.env.local.example` with Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and Salesforce env vars
- `pnpm dev` starts app on localhost:3000
- `pnpm turbo build` succeeds from root

**Implementation Plan:**
1. Scaffold Next.js 15 app in `apps/web/` with TypeScript and Tailwind CSS v4
2. Install `@clerk/nextjs` and configure `ClerkProvider` in root layout
3. Add `clerkMiddleware()` in `apps/web/middleware.ts` to protect authenticated routes
4. Create jsforce connection singleton (`lib/salesforce.ts`) using JWT bearer flow
5. Create `.env.local.example` documenting all required environment variables
6. Wire up Turborepo — verify `pnpm dev` and `pnpm turbo build` work from root

### W-000030: [Backend] Create Apex REST Endpoints and Integration Permission Set (8 pts)

Build read-only Apex REST API endpoints for all core objects and an integration permission set for the external app's connected app user.

**Acceptance Criteria:**
- REST resources: Team, Division, Player, Season, League (read-only `@HttpGet`)
- URL pattern: `/services/apexrest/sportsmgmt/v1/{entity}`
- `RestResponseDto` with DTO inner classes (API-friendly field names)
- `External_App_Integration` permission set (read on all 5 objects, Apex class access)
- All REST classes use `with sharing` and delegate to existing service layer
- Test classes with 90%+ coverage
- Org-wide coverage stays above 90%

**Implementation Plan:**
1. Create `RestResponseDto` class with standardized response wrapper and DTO inner classes for each entity
2. Create REST resource classes: `TeamRestResource`, `DivisionRestResource`, `PlayerRestResource`, `SeasonRestResource`, `LeagueRestResource`
3. Each REST class: `@RestResource(urlMapping='/sportsmgmt/v1/teams/*')`, `@HttpGet`, delegates to existing service/repository layer
4. Create `External_App_Integration.permissionset-meta.xml` with read access on all 5 objects and Apex class access for REST classes
5. Write test classes with mock HTTP requests, covering positive/negative/bulk scenarios
6. Deploy and verify org-wide coverage stays above 90%

### W-000031: [Frontend] Implement Read-Only Dashboard Pages (8 pts)

Build the main dashboard UI with server-side data fetching from Salesforce via the Apex REST endpoints.

**Acceptance Criteria:**
- Dashboard layout with sidebar navigation
- Pages: Teams (card grid), Team Detail (with player roster), Players, Seasons, Divisions
- Server-side data fetching via jsforce calling Apex REST endpoints
- BFF API routes for client-side fetches with session auth checks
- Unauthenticated users redirected to sign-in
- `pnpm build` succeeds

**Implementation Plan:**
1. Create dashboard layout component with sidebar navigation (Teams, Players, Seasons, Divisions)
2. Build BFF API routes under `apps/web/app/api/` that call Salesforce REST via jsforce, with Clerk session validation
3. Implement Teams page with card grid layout, fetching from `/api/teams`
4. Implement Team Detail page at `/teams/[id]` showing team info and player roster
5. Implement Players, Seasons, and Divisions list pages
6. Add Clerk middleware redirect for unauthenticated users
7. Verify `pnpm build` succeeds with no type errors

### W-000032: [Infrastructure] Extract Shared Types and API Contracts (3 pts)

Extract TypeScript interfaces and Zod validation schemas into shared workspace packages consumed by the frontend app.

**Acceptance Criteria:**
- `packages/shared-types/` with TypeScript interfaces matching Apex DTOs
- `packages/api-contracts/` with Zod validation schemas
- `apps/web` consumes both via `workspace:*` dependencies
- `pnpm turbo build` builds in correct dependency order
- `pnpm turbo type-check` passes across all packages

**Implementation Plan:**
1. Create `packages/shared-types/` with TypeScript interfaces mirroring `RestResponseDto` inner classes
2. Create `packages/api-contracts/` with Zod schemas for request/response validation
3. Update `apps/web/package.json` to depend on both via `workspace:*`
4. Update `turbo.json` to ensure correct build dependency order
5. Refactor `apps/web` to import types and schemas from shared packages
6. Verify `pnpm turbo build` and `pnpm turbo type-check` pass across all packages

### W-000033: [Frontend] Add Mutation Support for Team Managers (5 pts)

Add write operations (create/edit/delete) for players and team editing, with role-based authorization mapped from Clerk users.

**Acceptance Criteria:**
- `@HttpPost`, `@HttpPut`, `@HttpDelete` on Player and Team REST resources
- `External_App_Integration` permission set updated with Create/Edit/Delete on Player__c, Edit on Team__c
- BFF authorization layer mapping Clerk user to authorized team(s)
- Add/edit/delete player forms with Zod validation
- Edit team form for team managers
- Unauthorized mutations return 403
- All Apex tests pass

**Implementation Plan:**
1. Add `@HttpPost`, `@HttpPut`, `@HttpDelete` methods to `PlayerRestResource` and `TeamRestResource`
2. Update `External_App_Integration` permission set with Create/Edit/Delete on Player__c and Edit on Team__c
3. Create BFF authorization layer that maps Clerk user identity to authorized team(s)
4. Build player add/edit/delete forms with Zod validation in `apps/web`
5. Build team edit form for team managers
6. Add 403 responses for unauthorized mutation attempts in BFF routes
7. Write/update Apex tests for all new REST methods, verify all tests pass

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   External Users                     │
│               (Fans, Team Managers)                  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              Next.js App (apps/web/)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Clerk Auth   │  │ BFF API      │  │ Dashboard  │ │
│  │ (Google SSO) │  │ Routes       │  │ Pages      │ │
│  └─────────────┘  └──────┬───────┘  └────────────┘ │
└──────────────────────────┼──────────────────────────┘
                           │ jsforce (JWT bearer)
                           ▼
┌─────────────────────────────────────────────────────┐
│              Salesforce Org                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Apex REST API (/sportsmgmt/v1/*)               │ │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │ │
│  │  │ Teams  │ │ Players  │ │Seasons │ │  Divs  │ │ │
│  │  └────┬───┘ └────┬─────┘ └───┬────┘ └───┬────┘ │ │
│  │       └──────────┴───────────┴───────────┘      │ │
│  │              Service / Repository Layer          │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Lightning Experience (Operators Only)           │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Shared Packages (Monorepo)

```
sprtsmng/
├── apps/
│   └── web/                    # Next.js 15 frontend
├── packages/
│   ├── shared-types/           # TypeScript interfaces
│   └── api-contracts/          # Zod validation schemas
├── sportsmgmt/                 # Salesforce core package
├── sportsmgmt-football/        # Salesforce football package
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Phase Sequencing

| Phase | Story | Depends On | Points |
|-------|-------|------------|--------|
| 1 | W-000028 — pnpm Monorepo | — | 3 |
| 2 | W-000029 — Next.js + Clerk | W-000028 | 5 |
| 3 | W-000030 — Apex REST API | — | 8 |
| 4 | W-000031 — Dashboard Pages | W-000029, W-000030 | 8 |
| 5 | W-000032 — Shared Types | W-000029, W-000030 | 3 |
| 6 | W-000033 — Mutations | W-000031, W-000032 | 5 |
