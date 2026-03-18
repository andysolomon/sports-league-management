# Sports League Management — Web App

External-facing Next.js application for sports league management, backed by Salesforce via REST API.

## Tech Stack

- **Next.js 15** (App Router) with React 19
- **TypeScript** with strict mode
- **Clerk** for authentication
- **jsforce** for Salesforce JWT bearer auth
- **Tailwind CSS** for styling
- **Playwright** for E2E testing
- Shared workspace packages: `@sports-management/shared-types`, `@sports-management/api-contracts`

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
    ├── layout.tsx              # Sidebar + header layout
    ├── page.tsx                # Overview with stat cards
    ├── teams/page.tsx          # Team list
    ├── teams/[id]/page.tsx     # Team detail with roster
    ├── players/page.tsx        # All players table
    ├── seasons/page.tsx        # Seasons table
    └── divisions/page.tsx      # Divisions table
```

### Authentication & Authorization

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

- **`@sports-management/shared-types`** — TypeScript DTOs (`LeagueDto`, `TeamDto`, etc.), input types, and `ApiResponse<T>` envelope
- **`@sports-management/api-contracts`** — Zod schemas for runtime validation of all DTOs and inputs

## Testing

### E2E Tests (Playwright)

```bash
pnpm --filter @sports-management/web test:e2e          # Headless
pnpm --filter @sports-management/web test:e2e:headed    # Visible browser
pnpm --filter @sports-management/web test:e2e:report    # With HTML report
```

Tests live in `e2e/tests/` and cover navigation, dashboard, teams, players, seasons, divisions, and API auth.

## Deployment

Configured for Vercel via `vercel.json`. Set all environment variables in the Vercel project settings.
