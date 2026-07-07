# Bulletproof local testing (WSM-000235)

The one-page guide to running the web e2e suite (and dogfooding) locally without
the Convex/port/auth friction that used to derail it.

## TL;DR — the golden path

```bash
# One command. Brings up a clean local backend, seeds, and runs Playwright.
apps/web/scripts/local-e2e.sh                      # full suite
apps/web/scripts/local-e2e.sh gamecast.spec.ts     # one spec
apps/web/scripts/local-e2e.sh -g "offseason draft" # by title
HEADED=1 apps/web/scripts/local-e2e.sh gamecast.spec.ts
```

For a manual dogfood, keep `npx convex dev` running and `pnpm --filter
@sports-management/web dev`, then sign in with the dev Clerk test-code fixture
(any `…+clerk_test@example.com` user, verification code **`424242`** — this
works on the `pk_test_` dev instance, *not* prod).

## The one rule that makes it bulletproof

**Use a STABLE deploy key against your cloud dev deployment — the same way CI
does.** Its admin key is issued once and never rotates, so local e2e can never
drift.

`apps/web/.env.local` (recommended — Option B):

```ini
NEXT_PUBLIC_CONVEX_URL=https://<your-dev>.convex.cloud
CONVEX_ADMIN_KEY=<stable deploy key>   # Convex dashboard → Settings → Deploy Keys
E2E_CLERK_USER_ID=user_...
E2E_CLERK_ORG_ID=org_...
E2E_CLERK_USER_ID_B=user_...
E2E_CLERK_ORG_ID_B=org_...
```

Why this and not a local anonymous backend: **server components and the seed
both call admin-keyed *internal* Convex functions, so `CONVEX_ADMIN_KEY` is
required even locally** (without a matching key every dashboard page and every
seed 500s with `BadAdminKey`). A local anonymous backend works too, but its
admin key **rotates every time it is re-provisioned** (`convex dev` restart,
`rm -rf .convex`, port increments) — and a *stale* key in `.env.local` was the
single root cause of this session's "`BadAdminKey` everywhere" spiral. A cloud
dev deploy key removes that whole failure class: set it once, never touch it.

### If you must use a local anonymous backend

Keep `CONVEX_ADMIN_KEY` in sync with the backend's current key **every time you
re-provision it**. The seed and `local-e2e.sh` now fail fast with a clear
`BadAdminKey → re-sync the key` message (WSM-000235) instead of a wall of
mystery 500s, but you still have to re-sync it yourself — which is exactly why
the cloud dev deployment is recommended.

## What the harness guarantees

`apps/web/scripts/local-e2e.sh` is idempotent and does, in order:

1. **Preflight** — fails fast with remediation if `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_ADMIN_KEY` or the `E2E_CLERK_*` vars are absent (checks *presence*, never prints secret values).
2. **Backend** — for a local URL, reuses the backend if up else starts `npx convex dev` and waits (cloud dev is always up, so this is skipped).
3. **Seed flag** — `convex env set CONVEX_ENABLE_E2E_SEED 1` on that backend.
4. **Port hygiene** — frees port `3000` so Playwright's `webServer` serves *this*
   checkout's code (avoids the stale-bundle trap where `reuseExistingServer`
   attaches to another worktree's server).
5. **Run** — `playwright test` with your args.

## Gotchas this replaces (all hit during the offseason epic)

| Symptom | Cause | Now |
|---|---|---|
| `BadAdminKey` on every page / seed | `CONVEX_ADMIN_KEY` mismatched the backend (stale after re-provision) | stable cloud-dev deploy key; seed fails fast with a re-sync message |
| Test passes on old code | `reuseExistingServer` attached to a stale `:3000` | script frees `:3000` first |
| Schema flaps / lost changes | several worktrees each running `convex dev` on the same anon backend, racing pushes | run **one** backend; don't boot `convex dev` per worktree |
| `e2e_seed_disabled` | `CONVEX_ENABLE_E2E_SEED` not set on the backend | script sets it |
| Clerk sign-in 15s timeout in `auth.setup` | cold Next compile | script/webServer warm the server before auth runs |

## Worktree note

Run the **one** local backend from your primary checkout. Extra git worktrees
share the same local Convex deployment — do **not** start a second `convex dev`
against it, or their schema pushes race. Point every worktree's `.env.local` at
the same Convex URL + key and run `local-e2e.sh` from whichever worktree you're
testing; it manages port `3000` for you.

## CI parity

CI is the source of truth (`main` requires the **Playwright (apps/web)** check).
This harness runs the exact same specs/config as CI against a local backend, so
green locally ⇒ green in CI, minus environment drift. If a spec is green locally
but red in CI (or vice-versa), suspect data/seed differences, not the harness.
