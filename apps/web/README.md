# Sports League Management — Web App

External-facing Next.js application for sports league management, backed by Salesforce via JWT bearer flow.

## Tech Stack

- **Next.js 15** (App Router) with React 19
- **TypeScript** with strict mode
- **Clerk** for authentication and authorization
- **jsforce** for Salesforce JWT bearer auth
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) for the component library
- **Lucide React** for icons
- **Sonner** for toast notifications
- **Zod** for runtime validation (via `@sports-management/api-contracts`)
- **Playwright** for E2E testing (81 tests across 14 specs)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (managed via Corepack)
- A Salesforce org with the `sportsmgmt` package deployed and a Connected App configured for JWT bearer flow
- A Clerk application

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (client-side) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) |
| `SF_LOGIN_URL` | Salesforce login endpoint (e.g., `https://login.salesforce.com`) |
| `SF_CLIENT_ID` | OAuth Connected App client ID |
| `SF_USERNAME` | Integration user email |
| `SF_PRIVATE_KEY` | RSA private key (PEM) for JWT signing |

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

### Salesforce Integration

The app connects to Salesforce via JWT bearer flow through jsforce:

1. `lib/salesforce.ts` — Manages OAuth2 JWT auth with 2-hour token caching
2. `lib/salesforce-api.ts` — Typed client calling Apex REST endpoints at `/services/apexrest/sportsmgmt/v1/*`
3. API routes act as a BFF layer, adding auth checks and Zod validation before forwarding to Salesforce

### Data Flow

```
Browser → Next.js API Route → Clerk Auth Check → Salesforce API Client → Apex REST → Salesforce
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
