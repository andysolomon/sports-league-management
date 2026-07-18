# Sports League Management — Web App

External-facing Next.js application for sports league management.

> **Backend:** **[Convex](https://convex.dev)** (see [CLAUDE.md](./CLAUDE.md) and the `convex/` directory). Deploy: [docs/development/DEPLOY.md](../../docs/development/DEPLOY.md). E2E: [docs/guides/WEB_E2E_TESTING_GUIDE.md](../../docs/guides/WEB_E2E_TESTING_GUIDE.md). Legacy Salesforce packages live in [sprts-salesforce](https://github.com/andysolomon/sprts-salesforce).

## Tech Stack

- **Next.js 15** (App Router) with React 19
- **TypeScript** with strict mode
- **Clerk** for authentication and authorization
- **Convex** for data storage and real-time queries/mutations
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) for the component library
- **Lucide React** for icons
- **Sonner** for toast notifications
- **Zod** for runtime validation (via `@sports-management/api-contracts`)
- **Playwright** for E2E testing (~93 passing across 24 specs — see [WEB_E2E_TESTING_GUIDE.md](../../docs/guides/WEB_E2E_TESTING_GUIDE.md))

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (managed via Corepack)
- A Convex deployment
- A Clerk application

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in Clerk + Convex values (see `.env.local.example` for the full list). Key variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (client-side) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |

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

Server components and API routes call Convex via `lib/data-api.ts` and generated Convex clients. Mutations and queries live in `convex/`.

### Data Flow

```
Browser → Next.js API Route → Clerk Auth Check → Convex queries/mutations
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

**Test data:** E2E specs seed a canonical NFL/MLS fixture via Convex (`e2e/helpers/seed-canonical.ts`).

## Deployment

Configured for Vercel via `vercel.json`. Set all environment variables in the Vercel project settings.
