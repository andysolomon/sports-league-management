# Web App E2E Testing Guide (apps/web)

> This covers the **Next.js web app** Playwright suite in `apps/web/e2e/`
> (TypeScript specs, Clerk auth, Convex backend). It is **not** the legacy
> Salesforce-Lightning e2e suite at the repo-root `e2e/` — that one uses scratch
> orgs + `frontdoor.jsp` + `c-*` component locators and is documented separately
> in [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md).

The web suite is **24 spec files** (`apps/web/e2e/tests/*.ts`). A green CI run is
~93 passing / ~22 skipped (quarantined specs tracked in #419).

## What it tests against

- **Auth:** [Clerk](https://clerk.com) — a real test user, signed in once.
- **Backend:** [Convex](https://convex.dev) — locally a seedable dev deployment;
  in CI a hermetic in-runner backend (see [CI](#ci)).
- **App:** the Next.js dev server (`pnpm dev`, port 3000), auto-started by
  Playwright's `webServer`.

## Local quick start

```bash
cd apps/web
pnpm exec playwright install chromium      # first time only

# .env.local must have (dev deployment + Clerk test instance):
#   NEXT_PUBLIC_CONVEX_URL      (dev deployment URL)
#   CONVEX_ADMIN_KEY            (dev deployment admin key — used to seed)
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
#   E2E_CLERK_USER_ID, E2E_CLERK_ORG_ID  (+ _B variants for multi-user specs)
# And on the dev Convex deployment: CONVEX_ENABLE_E2E_SEED=1

pnpm test:e2e            # headless (chromium + api + health projects)
pnpm test:e2e:headed     # visible browser
pnpm test:e2e:report     # + open the HTML report
```

> ⚠️ If your `.env.local` is pointed at a **local anonymous** Convex backend
> (`CONVEX_DEPLOYMENT=anonymous:...`, `127.0.0.1:3212`) from CI experiments,
> restore your dev-deployment values first or the seed harness won't reach a
> seedable backend. See [DEPLOY.md](../development/DEPLOY.md#envlocal-gotcha).

## Architecture (WSM-000172 / WSM-000187)

### Projects (`e2e/playwright.config.ts`)

| Project | storageState | Purpose |
| --- | --- | --- |
| `setup` | — | Runs `auth.setup.ts`: signs in **once** via Clerk, persists the session to `e2e/.auth/user.json`. |
| `health` | ✅ reuses `user.json` | Smoke gate; a dependency of `chromium`. |
| `chromium` | ✅ reuses `user.json` | The authed suite (all specs except health/visual/api). |
| `api` | ❌ none | Runs `api-auth.spec.ts` **unauthenticated** — asserts protected BFF routes return **401**. |
| `visual` | — | `/dev/visual/*` component screenshots. **Non-blocking** (no committed Linux baselines). |

- **Sign in once, not per test.** `auth.setup.ts` does one Clerk sign-in and
  writes `storageState`; every authed spec reuses it (replaced ~110 per-test
  sign-ins that rate-limited Clerk). Each test still calls
  `setupClerkTestingToken()` to bypass bot detection and refresh the short-lived
  JWT. Serial run (`workers: 1`), `retries: 2` in CI.

### Canonical data fixture (`convex/e2eSeed.ts` + `e2e/helpers/seed-canonical.ts`)

- `global-setup.ts` seeds the fixed dataset **once** via the
  `e2eSeed:createCanonicalFixture` mutation (idempotent, org-scoped): one league
  ("National Football League") with the `test-data.ts` teams/players/seasons/
  divisions. It writes the resulting `leagueId` to `e2e/.canonical-fixture.json`.
- Data-dependent specs read that file (`readCanonicalFixture()`) and set the
  `activeLeagueId` cookie via `setActiveLeague()` in `beforeEach`, so the
  active-league-scoped dashboard pages render exactly that league's data.
- The seed mutations are gated on `CONVEX_ENABLE_E2E_SEED=1` set **on the target
  deployment** — a safety interlock so they can never run against prod.

## CI

`.github/workflows/e2e.yml` — runs on `pull_request` → `main`, **secret-gated**
(absent secrets → the job skips and still passes, so it can't falsely block a PR).

Two jobs:

- **`Playwright (apps/web)`** — blocking. Gates PRs.
- **`Visual regression`** — **non-blocking** (`continue-on-error`); OS-specific
  screenshot baselines aren't committed for Linux, so it must not gate.

### In-runner local Convex backend (WSM-000172, #428)

CI does **not** push to or test against the shared cloud dev deployment. Instead
it runs a **hermetic anonymous Convex backend inside the runner**:

- `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --local` downloads the
  precompiled backend, deploys the PR's functions, and serves locally.
- The step writes the generated `127.0.0.1` URL + admin key to a file; the test
  step `source`s it so the dev server and seed harness hit the local backend, not
  the cloud.

Why: prod is over the Convex free-tier function-call ceiling and the suite was a
heavy consumer; a per-run local backend is zero cloud calls **and** removes the
shared-deployment drift/clobber that made the suite flaky (each run gets a
backend matching its own code).

Required repo **secrets**: `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CONVEX_ADMIN_KEY`, `E2E_CLERK_USER_ID`(`_B`),
`E2E_CLERK_ORG_ID`(`_B`). Required **variables**: `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT` (the cloud values still gate
the job and back the non-blocking visual job; the blocking job overrides them
with the local backend at run time).

## Gotchas

- **A `/dashboard/*` route that calls `notFound()` returns HTTP 200, not 404** —
  the layout shell streams (flushing 200 headers) before the page resolves.
  Assert the rendered not-found UI, not `response.status()` (WSM-000190). Public
  `/leagues/*` routes render fully server-side and *can* return 404.
- **Responsive DOM duplicates:** desktop/mobile variants both render; scope with
  `.filter({ visible: true })` / `.first()`.
- **Quarantined specs** use `test.fixme` and are tracked in #419.
