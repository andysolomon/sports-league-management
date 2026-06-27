# Clerk production-instance cutover (WSM-000168 / #386)

**Status: launch blocker.** Production currently initializes Clerk with a
**development** instance (`pk_test_…` / `sk_test_…`, frontend API
`present-mouse-98.clerk.accounts.dev`). Clerk dev instances have strict rate
limits and are not for production — under real signup/login traffic, auth (the
top of the funnel) will throttle or fail. Preview and Production share this one
dev instance today.

This cutover moves **Production** to a Clerk **production** instance. It's an
ops task (Clerk dashboard + DNS + Vercel env) — most steps require a human in
the Clerk dashboard. Verify each with the preflight at the end.

## Prerequisites
- Owner access to the Clerk dashboard and the DNS for `andrewsolomon.dev`.
- Vercel CLI logged in (`vercel whoami`), linked to the `sprtsmng` project.
- Google OAuth console access (the app offers Google sign-in).

## Steps

### 1. Create the Clerk production instance
Clerk dashboard → the app → top-left instance switcher → **Production**. Clerk
provisions a separate prod instance with its own `pk_live_…` / `sk_live_…` keys
and **its own user pool** (dev users do NOT carry over).

### 2. Add the domain + DNS
In the prod instance → **Domains**, add `sprtsmng.andrewsolomon.dev`. Clerk lists
**CNAME records** (typically `clerk`, `accounts`, plus `clkmail`/`clk._domainkey`
mail records). Add them at the DNS provider for `andrewsolomon.dev` and wait for
Clerk to show **Verified** (can take minutes to hours).

### 3. Configure Google OAuth for prod
In the prod instance → **SSO connections → Google**, supply production Google
OAuth client credentials and add Clerk's prod redirect URL to the Google console
(the dev OAuth client won't work against the prod instance).

### 4. Confirm sign-in methods
Prod instance → **User & Authentication → Email/Password** — ensure password
(and/or email-code) is enabled, matching the dev instance, so existing flows and
the seeded test users work.

### 5. Swap the Vercel Production env vars
Copy the prod **publishable** + **secret** keys, then overwrite the Production
env (they currently hold `pk_test_`/`sk_test_`):

```bash
cd apps/web   # repo root works too; project is linked
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes
printf 'pk_live_XXXX' | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env rm CLERK_SECRET_KEY production --yes
printf 'sk_live_XXXX' | vercel env add CLERK_SECRET_KEY production
```

Leave **Preview** on the dev instance (preview/local keep using `pk_test_`).

### 6. Redeploy production
Deploy web from the repo root (the prod domain auto-assigns to the latest):

```bash
vercel --prod --yes
```

### 7. Re-seed the test users onto the prod instance (optional)
The prod instance has an empty user pool. To recreate the role test users there,
run the seed against the **live** secret key:

```bash
CLERK_SECRET_KEY=sk_live_XXXX \
NEXT_PUBLIC_CONVEX_URL=https://terrific-aardvark-395.convex.cloud \
CONVEX_ADMIN_KEY=<prod deploy key> \
npx tsx apps/web/scripts/seed-test-users.mts --write
```

(Org + league names are tagged `(live)` so they don't collide with the existing
`(dev)` ones in the shared Convex.)

## Verify
1. **Preflight gate** — must pass:
   ```bash
   pnpm run check:launch
   ```
   It pulls the Production env and asserts both Clerk keys are `pk_live_`/`sk_live_`
   (exits non-zero with this runbook's pointer if not).
2. **No dev-keys console warning** — load `https://sprtsmng.andrewsolomon.dev`,
   open the console; the "Clerk has been loaded with development keys" warning
   must be **gone**.
3. **Sign in** as a test user (or a real account) against the live instance.

Once `check:launch` passes and the console warning is gone, #386 is resolved.

## Rollback
If sign-in breaks, restore the dev keys in Vercel Production (re-add the
`pk_test_`/`sk_test_` values) and redeploy — the dev instance is unchanged.
