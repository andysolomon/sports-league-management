# Production Deploy Runbook (apps/web)

> **Status:** Canonical. Covers how the **web app** (`apps/web`) + its **Convex**
> backend reach production. For versioning/tagging/semantic-release see
> [RELEASE_STRATEGY.md](./RELEASE_STRATEGY.md); this doc is about *deploying*, not
> versioning. Salesforce package deploys are separate (see the root README).

Production is **two independent pipelines**, not one. This trips people up, so
internalize it:

| Surface | How it deploys | Trigger | Automatic? |
| --- | --- | --- | --- |
| **Web** (Next.js) | Vercel Git integration → **production** | every commit on `main` | ✅ automatic |
| **Convex** (functions + schema) | manual `npx convex deploy` → prod deployment | run by a human from merged `main` | ❌ manual |

- **Vercel project:** `prj_WxGOmhPZj3Y3cNHGPo6KVChOESFB` (team `andrewsolomonedus-projects`), custom domain **`sprtsmng.andrewsolomon.dev`**. The build command is plain `next build` — there is **no** `convex deploy` inside the Vercel build, and no Convex deploy in CI. Merging to `main` publishes the web automatically; nothing publishes Convex.
- **Convex deployments:** prod = **`terrific-aardvark-395`**, dev = `laudable-reindeer-759`.

## The deploy-order rule (why this matters)

Because the web auto-promotes the instant a PR merges, **merging a PR that calls a
new/changed Convex function publishes the web before Convex is updated.** If the
prod Convex functions don't match, the live route errors (a missing function, or
the return-validator drift class — see
[reference: Convex return-validator drift]).

**Therefore: deploy Convex to prod *before or immediately after* the web goes
live, from the same `main` SHA.** In practice:

1. Merge the PR(s) to `main`.
2. If other merges are in flight, pause them for the minute this takes (so web
   and Convex land from the same `main`).
3. Deploy Convex from `main` (below).
4. Verify (below).

## Deploying Convex to prod

Run from merged `main`, from `apps/web`, using your Convex **device auth**
(interactive login already done via the Convex dashboard/CLI):

```bash
cd apps/web && CONVEX_DEPLOYMENT=prod:terrific-aardvark-395 npx convex deploy
```

`convex deploy` pushes **functions + schema only** — it does **not** touch prod
data. Convex shows a diff and asks to confirm the push to production; confirm it.

### ⚠️ `.env.local` gotcha (post-WSM-000172 / #428)

After the local-Convex CI work, `apps/web/.env.local` may be left pointing at a
**local anonymous backend**:

```
CONVEX_DEPLOYMENT=anonymous:anonymous-web
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3212
```

In that state a bare `npx convex deploy` will **not** target prod. The explicit
`CONVEX_DEPLOYMENT=prod:terrific-aardvark-395` above overrides it (a shell-set env
var beats the `.env.local` value). If the CLI still complains about the
deployment/project link, move the file aside for the deploy:

```bash
cd apps/web && mv .env.local .env.local.bak && npx convex deploy --prod ; mv .env.local.bak .env.local
```

(Restore your normal dev `.env.local` afterward so local dev talks to the dev
deployment again.)

There is **no** production `CONVEX_DEPLOY_KEY` checked into the repo or the local
env — prod deploys use device auth. A deploy key would only be used in a CI
context (not currently wired).

## Verifying a prod deploy

After both surfaces are live, confirm they match:

```bash
# Health + a graceful-error probe (a bogus id must 404, not 500)
curl -s -o /dev/null -w "%{http_code}\n" https://sprtsmng.andrewsolomon.dev/api/health          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://sprtsmng.andrewsolomon.dev/                     # 200
curl -s -o /dev/null -w "%{http_code}\n" \
  https://sprtsmng.andrewsolomon.dev/leagues/x/games/y/live-score                                # 404 (not 500)
```

Then check Vercel runtime errors for a "function not found" / validator signature
(project `prj_WxGOmhPZj3Y3cNHGPo6KVChOESFB`, team `team_1h9Xca1fcyThRFdpK9runicq`)
— via the Vercel MCP `get_runtime_errors` or the dashboard. Zero new errors after
the deploy = web and Convex are consistent.

## Rollback

- **Web:** Vercel → the project's Deployments → promote a previous production
  deployment (recent `main` deploys are marked `isRollbackCandidate`).
- **Convex:** re-run `convex deploy` from an earlier known-good `main` commit.
  There is no one-click Convex rollback; redeploy the prior code.

## Related

- [RELEASE_STRATEGY.md](./RELEASE_STRATEGY.md) — versioning, tags, semantic-release
- [WEB_E2E_TESTING_GUIDE.md](../guides/WEB_E2E_TESTING_GUIDE.md) — the pre-merge gate
- [launch/clerk-prod-cutover.md](../launch/clerk-prod-cutover.md) — Clerk prod instance cutover (separate)
