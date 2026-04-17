# v0.3.0-launch — Pre-launch checklist

**Last updated:** 2026-04-08
**Target soft launch:** by 2026-05-08
**Status:** in progress

This is the canonical readiness gate for the v0.3.0-launch milestone. Every box below must be checked before inviting beta users. Items marked **HITL** require manual action.

---

## Functional readiness

- [ ] **Marketing landing page** — Visit https://sprtsmng.andrewsolomon.dev/. Hero, How It Works, Features, Screenshots, Pricing, Footer all render. CTAs work for both signed-in and signed-out states. (#50)
- [ ] **SEO foundation** — `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/icon`, `/apple-icon`, `/manifest.webmanifest` all return 200. (#51)
- [ ] **Legal pages** — `/terms` and `/privacy` accessible without auth, content reviewed, "NOT LEGAL ADVICE" disclaimer banner present. (#52)
- [ ] **Welcome email** — Sign up a test user through the production landing page. Welcome email arrives within 60 seconds. (#53)
- [ ] **Stripe end-to-end** — As the test user, click "Upgrade to Plus" → complete checkout with `4242 4242 4242 4242` → confirm dashboard shows Plus tier badge → confirm receipt email arrives.
- [ ] **All E2E tests pass against production** — `pnpm run test:e2e` against the production base URL. (15 spec files, ~50 tests.)

## Performance

- [ ] **Lighthouse Performance ≥ 90** — Run on https://sprtsmng.andrewsolomon.dev/ in Chrome DevTools, mobile profile. Record actual score here: __
- [ ] **Lighthouse Accessibility ≥ 90** — Same. Record: __
- [ ] **Lighthouse SEO ≥ 95** — Same. Record: __
- [ ] **Lighthouse Best Practices ≥ 90** — Record: __
- [ ] **No console errors** on the landing page in browser devtools (open in incognito, hard reload)
- [ ] **No hydration warnings** in the browser console

## Observability

- [ ] **Vercel Analytics shows pageviews** — Visit production from 2-3 different devices/IPs, wait 5 minutes, check the Analytics tab in the Vercel dashboard.
- [ ] **Speed Insights collecting Core Web Vitals** — Same.
- [ ] **Health endpoint** — `curl https://sprtsmng.andrewsolomon.dev/api/health` returns 200 with `salesforce: "connected to ..."`.
- [ ] **Vercel runtime logs** — Trigger an action that logs (a webhook fire, an API error). Confirm the structured JSON entry shows up in `vercel logs`.

## Security

- [ ] **Clerk production keys in production scope** — `vercel env ls | grep CLERK` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` should be `pk_live_*` / `sk_live_*` in Production. (Currently `pk_test_*` per the SSL workaround from earlier — see "Known deferrals" below.)
- [ ] **Vercel/local auth parity check passes** — From repo root run `pnpm check:web-env-parity`. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_USERNAME`, and `SF_PRIVATE_KEY` should match between `apps/web/.env.local` and Vercel Production. `NEXT_PUBLIC_APP_URL` is expected to differ.
- [ ] **Clerk instance and scopes are intentional** — The Clerk publishable/secret keys in Vercel Production must point at the same Clerk instance used locally for the soft-launch path, and that secret key must be allowed to read org memberships and user metadata used by `resolveOrgContext()`.
- [ ] **Salesforce org parity is intentional** — The Vercel Production `SF_*` values should point at the same Salesforce org as local unless a different production org is explicitly documented here and has all required metadata deployed.
- [ ] **Stripe test keys in production scope (intentional for v1)** — `sk_test_*` is correct for soft launch. We'll flip to `sk_live_*` after the soft launch retrospective in a separate story.
- [ ] **Resend domain verified** — `welcome@sprtsmng.andrewsolomon.dev` shows green in https://resend.com/domains and a test send returns 200, not 403.
- [ ] **Clerk webhook signing secret set** — `vercel env ls | grep CLERK_WEBHOOK` returns the var in both Production and Preview scopes.
- [ ] **`.env.local` not committed** — `git ls-files apps/web/.env.local` returns nothing.
- [ ] **Middleware allowlist correct** — `apps/web/src/middleware.ts` includes `/`, `/sign-in`, `/sign-up`, `/terms`, `/privacy`, `/api/health`, `/api/stripe/webhook`, `/api/webhooks/clerk`, `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/twitter-image`, `/icon`, `/apple-icon`, `/manifest.webmanifest`.

## Email deliverability

- [ ] **Welcome email lands in inbox, not spam** — Test from a Gmail account.
- [ ] **Receipt email lands in inbox** — Trigger via Stripe test purchase. (Note: this email has been silently failing for ~3 weeks until the Resend domain verification step above completes.)
- [ ] **Reply-to address works** — Reply to the welcome email; confirm it routes to a real inbox you can read.

## Beta launch

- [ ] **Feedback channels live** — `feedback@sprtsmng.andrewsolomon.dev` mailto in marketing footer works. GitHub issue template `.github/ISSUE_TEMPLATE/beta-feedback.yml` exists and renders correctly at https://github.com/andysolomon/sports-league-management/issues/new/choose.
- [ ] **Beta user list assembled** — 10-20 names + email addresses in `docs/launch/beta-users.md` (gitignored or private).
- [ ] **Onboarding email drafted** — See `soft-launch-plan.md` in this directory.
- [ ] **Wave 1 invited** — Send onboarding email to 5 users. Track in `beta-users.md`.
- [ ] **Wave 1 feedback collected** — Wait 3-5 days, review responses, file any bugs as GitHub issues.
- [ ] **Wave 2 invited** — Remaining beta users.
- [ ] **Soft launch retrospective** — After 2 weeks, write up findings in `docs/launch/soft-launch-retrospective.md`.

---

## Go / no-go gates

**All items above must be checked before public launch.** For soft launch (closed beta to 10-20 users), the following items can be deferred and tracked as known issues:

### Critical (block soft launch)
- Welcome email broken
- Stripe checkout broken
- Auth broken
- Landing page won't render
- `/api/health` returns 503

### Cosmetic (document and ship)
- Lighthouse 88 instead of 90 (note in retrospective)
- Single console warning that doesn't break functionality
- Slow first-contentful-paint on cold start (acceptable for serverless)

---

## Known deferrals (for the post-soft-launch retrospective)

These were intentionally not done in v0.3.0-launch and need their own stories:

1. **Clerk live keys on the production custom domain.** The Clerk production instance has SSL provisioning issues at `clerk.sprtsmng.andrewsolomon.dev`. Currently using a separate dev Clerk project (`pk_test_*`) for the production deployment. Track in a follow-up issue.
2. **Stripe live keys.** Soft launch runs on Stripe test mode so beta users do not get charged. Flip after retrospective.
3. **Lawyer-reviewed legal copy.** Boilerplate ships with a "NOT LEGAL ADVICE" disclaimer banner. Public launch needs counsel review of `/terms` and `/privacy`.
4. **OG image asset polish.** Generated programmatically; could use a designer pass.
5. **Real screenshots in marketing page.** Already have v1 captures from production. Could be retaken at higher resolution / with branding overlays.

---

## Verification commands (copy-paste reference)

```bash
# Functional smoke checks
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://sprtsmng.andrewsolomon.dev/
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://sprtsmng.andrewsolomon.dev/sign-in
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://sprtsmng.andrewsolomon.dev/terms
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://sprtsmng.andrewsolomon.dev/privacy
curl -s https://sprtsmng.andrewsolomon.dev/api/health | python3 -m json.tool
curl -s https://sprtsmng.andrewsolomon.dev/sitemap.xml
curl -s https://sprtsmng.andrewsolomon.dev/robots.txt

# Vercel env audit
vercel env ls | grep -E "CLERK|STRIPE|RESEND|SF_"
pnpm check:web-env-parity

# Run E2E suite
cd apps/web && pnpm run test:e2e

# Lighthouse (Chrome DevTools → Lighthouse panel → mobile, performance, accessibility, SEO, best-practices)
```
