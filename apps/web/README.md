# Sports League Management — Web App

External-facing Next.js application for sports league management, backed by Convex for runtime app data.

## Tech Stack

- **Next.js 15** (App Router) with React 19
- **TypeScript** with strict mode
- **Clerk** for authentication and authorization
- **Convex** for application data, sync state, and invite/subscription storage
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) for the component library
- **Lucide React** for icons
- **Sonner** for toast notifications
- **Zod** for runtime validation (via `@sports-management/api-contracts`)
- **Playwright** for E2E testing (81 tests across 14 specs)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (managed via Corepack)
- A Convex deployment URL and admin key
- A Clerk application

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (client-side) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `CONVEX_ADMIN_KEY` | Server-only Convex admin key used by Next.js server code |
| `SF_LOGIN_URL` / `SF_CLIENT_ID` / `SF_USERNAME` / `SF_PRIVATE_KEY` | Legacy migration-only Salesforce envs for backfill scripts |

### Vercel parity

For protected dashboard routes to behave the same locally and in production,
keep the following values aligned between `apps/web/.env.local` and Vercel
Production:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_ADMIN_KEY`

`NEXT_PUBLIC_APP_URL` should intentionally differ by environment.

From the repo root, you can audit local versus Vercel Production without
printing secrets:

```bash
pnpm check:web-env-parity
```

The public health endpoint also exposes non-secret identity markers that make
drift easier to spot during debugging:

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
curl -s https://sprtsmng.vercel.app/api/health | python3 -m json.tool
```

### Running Locally

```bash
# From repo root
pnpm install
pnpm --filter @sports-management/web dev
```

The app starts at `http://localhost:3000`.

## Architecture

### App Router Structure

```
src/app/
├── page.tsx                    # Public landing page
├── layout.tsx                  # Root layout with ClerkProvider
├── (auth)/
│   ├── sign-in/[[...sign-in]]/ # Clerk sign-in page
│   └── sign-up/[[...sign-up]]/ # Clerk sign-up page
├── api/                        # BFF API routes (server-side)
│   ├── leagues/route.ts
│   ├── divisions/route.ts
│   ├── teams/route.ts & [id]/route.ts
│   ├── players/route.ts & [id]/route.ts
│   └── seasons/route.ts
└── dashboard/                  # Protected dashboard pages
    ├── layout.tsx              # Sidebar + mobile header layout
    ├── page.tsx                # Overview with 5 stat cards
    ├── leagues/page.tsx        # League hierarchy (cards → divisions → teams)
    ├── teams/page.tsx          # Team grid with cards
    ├── teams/[id]/page.tsx     # Team detail with roster + CRUD
    ├── players/page.tsx        # All players DataTable
    ├── seasons/page.tsx        # Seasons DataTable
    └── divisions/page.tsx      # Divisions DataTable
```

### Key Components

| Component | Location | Purpose |
|---|---|---|
| `DataTable` | `src/components/data-table.tsx` | Reusable table with search, sort, pagination (pageSize 10) |
| `StatusBadge` | `src/components/status-badge.tsx` | Color-coded status badges (Active=green, Injured=yellow, etc.) |
| `Sidebar` | `src/app/dashboard/_components/sidebar.tsx` | Desktop nav with 6 items and Lucide icons |
| `MobileHeader` | `src/app/dashboard/_components/mobile-header.tsx` | Hamburger menu with Sheet overlay (`lg:hidden`) |
| `PlayerForm` | `src/app/dashboard/_components/player-form.tsx` | Add/Edit player Dialog modal |
| `TeamEditForm` | `src/app/dashboard/_components/team-edit-form.tsx` | Edit team Dialog modal |
| `DeleteConfirm` | `src/app/dashboard/_components/delete-confirm.tsx` | AlertDialog for delete confirmation |

### Authentication and Authorization

- **Clerk middleware** protects all routes except `/`, `/sign-in`, `/sign-up`
- **API routes** verify `userId` from Clerk session before processing requests
- **Team mutations** check `managedTeamIds` in Clerk user `publicMetadata` via `authorizeTeamMutation()`

### Convex Integration

The app uses Convex as its runtime backend:

1. `convex/schema.ts` — Canonical schema for leagues, divisions, teams, players, seasons, subscriptions, and sync config
2. `convex/sports.ts` — Query and mutation functions for the sports domain
3. `lib/data-api.ts` — Server-side adapter that keeps the Next.js route/page surface stable while calling Convex over `ConvexHttpClient`
4. `lib/org-context.ts` — Clerk org memberships plus Convex-backed public-league subscriptions
5. `lib/salesforce.ts` — Legacy migration-only helper used by backfill scripts while moving data off Salesforce

### Data Flow

```
Browser → Next.js Page/API Route → Clerk Auth Check → Convex Data Adapter → Convex Queries/Mutations
```

### Shared Packages

- **`@sports-management/shared-types`** — TypeScript DTOs (`LeagueDto`, `TeamDto`, `PlayerDto`, `SeasonDto`, `DivisionDto`), input types, and `ApiResponse<T>` envelope
- **`@sports-management/api-contracts`** — Zod schemas for runtime validation of all DTOs and mutation inputs

## Testing

### E2E Tests (Playwright)

81 tests across 14 spec files covering:

| Spec File | Coverage |
|---|---|
| `api-auth.spec.ts` | API route auth enforcement (401 without session) |
| `navigation.spec.ts` | Sidebar links, active styling, accessibility |
| `mobile-navigation.spec.ts` | Hamburger menu, Sheet overlay, responsive breakpoints |
| `dashboard-overview.spec.ts` | 5 stat cards, counts, navigation, styling |
| `leagues.spec.ts` | League hierarchy cards, division badges, team links |
| `teams.spec.ts` | Team grid, card details, links |
| `team-detail.spec.ts` | Team info, roster table, player data |
| `team-edit.spec.ts` | Edit Team dialog, form validation, error handling |
| `players.spec.ts` | Players table, column data |
| `player-crud.spec.ts` | Add/Edit/Delete player, toasts, validation, errors |
| `seasons.spec.ts` | Seasons table, status values |
| `divisions.spec.ts` | Divisions table, league name resolution |
| `data-table.spec.ts` | Search, sort, pagination controls |
| `status-badges.spec.ts` | Badge colors, date formatting, founded year |

```bash
pnpm --filter @sports-management/web test:e2e          # Headless
pnpm --filter @sports-management/web test:e2e:headed    # Visible browser
pnpm --filter @sports-management/web test:e2e:report    # With HTML report
```

**Configuration:** `e2e/playwright.config.ts` — Chromium only, 1 worker (serial), 60s timeout, auto-starts dev server on port 3000.

**Auth:** Tests use `@clerk/testing/playwright` with `setupClerkTestingToken()` for authenticated access.

**Test data:** Constants in `e2e/helpers/test-data.ts` match what `seed-data.js` creates (2 leagues, 4 teams, 12 players, 3 seasons).

## Deployment

Configured for Vercel via `vercel.json`. Set all environment variables in the Vercel project settings.
