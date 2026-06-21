# GHSA Activation Runbook (Coach Path) — Soft Launch

Status: **activation enabled.** This document describes how to seed the GHSA
league and walk a high-school coach through seed → claim → roster.

> **Verdict (TL;DR):** The coach path is **functional end-to-end through the
> product** as of WSM-000109 activation work (this change). Flow:
> 1. Admin: `/dashboard/import` → **Seed GHSA football (413 teams)** (creates the
>    league + 56 regions + 413 empty teams).
> 2. Admin: `/dashboard/leagues/<id>` → turn on **Public viewer** and **Claimable
>    by coaches** (the claimable toggle is new — it wires the previously
>    UI-less `setLeagueClaimable`).
> 3. Coach: `/dashboard/discover` → find their school → claim → fills the roster
>    (with HS grade/squad).
>
> The claim + roster code was already sound; the missing piece was a way to mark a
> seeded league claimable from the product, now added. The earlier blockers are
> resolved (see **Status of audit findings**). A custom 413-seeding script is **no
> longer required** — the in-product button + settings toggles complete it.

---

## Preconditions

- **Deploy Convex from merged `main`, not a feature branch.** The Convex prod
  deployment is shared; deploying from a feature branch overwrites it. Merge the
  PR first, then deploy Convex from `main`.
- **Admin-keyed, server-side model.** All `sports:*` write mutations are
  `internalMutation` (WSM-000096) and reject unauthenticated calls. Writes are
  authenticated with a Convex **admin key** set server-side — there is no Convex
  `auth.config`/end-user auth on the data layer. The server resolves its client
  in `apps/web/src/lib/convex-client.ts`, which requires:
  - `NEXT_PUBLIC_CONVEX_URL` — the target deployment URL.
  - `CONVEX_ADMIN_KEY` — required for any non-local deployment; without it every
    write throws.
- **Pick the target deployment deliberately.** "prod vs preview" is selected
  purely by which `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_ADMIN_KEY` pair you point at.
  For a script run, export the prod deployment's URL + admin key. For a preview
  smoke test, use the preview deployment's pair. **Do not run a write against
  prod until you have rehearsed it against preview.**
- Verify admin auth is live before seeding: `GET /api/health` runs an `adminPing`
  probe that resolves only if the admin-keyed client authenticates.

---

## What gets seeded

The prebuilt payload lives at `apps/web/public/seed/ghsa-2024-26.json`.

- League: **"Georgia GHSA Football (2024-26)"**
- **56 regions** (modeled as `divisions`)
- **413 teams** (empty — `players: []` on every team; rosters are filled by
  coaches, by design)
- 0 players

It **parses and conforms to `LeagueImportSchema`** (`packages/api-contracts/src/import-schema.ts`)
— verified by running the schema's `safeParse` against the file. The payload
schema has **no** `claimable` / `isPublic` / `orgId` fields; claimability is a
property of the league record, set separately (see below).

---

## Seeding the GHSA league into a target environment

There are two code paths. **They are not equivalent** — pick based on the gaps below.

### Path A — Admin-keyed script (the correct mechanism for claimable seeding)

The repo's pattern for a public, claimable template league is
`apps/web/scripts/seed-ghsa-cobb.mts`. It does the three things the coach path
requires, in order:

1. `sports:upsertLeague` with `orgId: null` → league is created with `isPublic: true`.
2. `sports:setLeaguePublic { isPublic: true }`.
3. `sports:setLeagueClaimable { claimable: true }` — **this is the flag that
   makes teams claimable by coaches** (WSM-000109).

Then it upserts divisions and teams.

Run (dry-run first; `--write` to commit):

```bash
# Preview deployment first
NEXT_PUBLIC_CONVEX_URL=<preview-convex-url> \
CONVEX_ADMIN_KEY=<preview-admin-key> \
npx tsx apps/web/scripts/seed-ghsa-cobb.mts          # dry run
NEXT_PUBLIC_CONVEX_URL=<preview-convex-url> \
CONVEX_ADMIN_KEY=<preview-admin-key> \
npx tsx apps/web/scripts/seed-ghsa-cobb.mts --write  # commit

# Only after preview verification — point the SAME command at prod's URL + key.
```

> **Important:** `seed-ghsa-cobb.mts` only seeds the **16 Cobb County schools**
> from a hardcoded array — it does **not** read `ghsa-2024-26.json` and does
> **not** produce the 413-team league. There is currently **no script that seeds
> the full 413-team payload with `setLeaguePublic` + `setLeagueClaimable`.** A
> human must either (a) extend/adapt this script to read
> `apps/web/public/seed/ghsa-2024-26.json`, or (b) run Path B and then manually
> set the league public + claimable (note: there is no UI for the claimable flag
> — see blockers). **Do not improvise the prod write; this is a code gap to fix
> before launch.**

### Path B — In-product "Seed GHSA" button / `POST /api/cli/import` (recommended; seeds 413, then flip the toggles)

> **This is now the recommended path.** The button seeds the full 413-team league;
> then, in the new league's settings, turn on **Public viewer** and **Claimable by
> coaches** to complete activation. The mechanical detail below still holds — the
> seed alone does not set the flags; the settings toggles do.

- UI: `/dashboard/import` → "Seed GHSA football" button
  (`apps/web/src/app/dashboard/import/_components/import-form.tsx`). It loads
  `/seed/ghsa-2024-26.json`, validates it client-side against `LeagueImportSchema`,
  shows a preview, and `POST`s the raw payload to `/api/cli/import`.
- API: `POST /api/cli/import`
  (`apps/web/src/app/api/cli/import/route.ts`). Accepts a Clerk **session token
  or API key**, validates against `LeagueImportSchema`, then calls
  `bulkImportLeague(payload, userId)`.

**This path does NOT make the league claimable.** In
`bulkImportLeague` (`apps/web/src/lib/data-api.ts`), because the GHSA league
doesn't pre-exist and `orgIdOverride` is not passed, the function **creates a new
Clerk org** and seeds the league under that org. `sports:upsertLeague` then sets
`isPublic = (orgId === null)` → **`isPublic: false`**, and **`claimable` is never
set** (defaults to absent/false). The `upsertTeam` mutation likewise sets no
claim-related fields. Result: a private, non-claimable league that does not
appear in Discover and cannot be claimed.

> After seeding, open the league settings and enable **Public viewer** +
> **Claimable by coaches** — that is what makes the teams discoverable and
> claimable. (Button copy now reads "413 teams" and directs the admin to these
> toggles.)

---

## Verification steps

After seeding, confirm the data landed and is claimable:

1. **Counts.** Query the target deployment (admin-keyed) for the league:
   - `sports:getLeagueByName { name: "Georgia GHSA Football (2024-26)" }` → returns the league id.
   - `sports:listDivisions { leagueIds: [id] }` → expect **56**.
   - `sports:listTeamsByLeague { leagueId: id }` → expect **413**.
   - Or use `sports:healthSummary` for org-wide totals as a sanity cross-check.
2. **Public.** `sports:getLeagueVisibility { leagueId }` → `{ isPublic: true }`.
   (Required for the league to appear in `getPublicLeagues()` / Discover.)
3. **Claimable.** `sports:getLeagueClaimable { leagueId }` → `true`.
   (Required for the Discover "Add to my teams" affordance and for the claim
   route's `requireForkableLeague` check to pass.)
4. **End-user smoke (preview).** Sign in as a fresh coach account → open
   `/dashboard/discover` → the GHSA league should be listed with teams showing an
   "Add" affordance (this only renders when both `isPublic` and `claimable` are
   true).

If steps 2 or 3 fail, the seed used Path B (or a script that skipped the flags)
and the coach path is blocked.

---

## Rollback / idempotency

- **`bulkImportLeague` upserts; it does not duplicate.** League is matched by
  name (`sports:upsertLeague` → `by_name`); divisions by name within league;
  teams by name within league (`upsertTeam`). Re-running the same payload
  **updates** existing records (city/stadium/division/logo for teams) and reports
  `updated` counts rather than creating duplicates. The script path is likewise
  idempotent (upsert-by-name for league/division/team).
- **Re-running is safe for the 413 set** — it will not create 826 teams.
- **Rollback of the whole league:** `deleteLeague` (`data-api.ts`) batches the
  cascade (`sports:deleteLeagueBatch`, ~10 teams/batch) so a 413-team delete stays
  inside Convex mutation limits. There is no per-team "undo" for a seed other than
  this full delete or a corrected re-import.
- **Caution (Path B side effect):** because Path B creates a Clerk **org** for the
  league, an accidental prod run via the button leaves a stray org behind even
  after `deleteLeague`. Prefer the admin-keyed script path with `orgId: null`.

---

## Coach onboarding flow (claim → roster)

Once the league is seeded **public + claimable**:

1. **Discover.** Coach signs in and opens `/dashboard/discover`
   (`apps/web/src/app/dashboard/discover/page.tsx`). It lists public leagues
   (`getPublicLeagues`) and marks each league `forkable = getLeagueClaimable(id)`.
   The GHSA league's 56 regions / 413 teams render as a conference→division→team
   tree.
2. **Claim.** Coach clicks "Add to my teams" on their school. The Discover client
   (`discover-leagues.tsx`) `POST`s `/api/teams/[id]/claim`
   (`apps/web/src/app/api/teams/[id]/claim/route.ts`). The route resolves an org
   the user admins — active org, else an existing admin org, else it **creates one
   automatically** (org-on-claim onboarding) — then calls `forkTeamToWorkspace`.
   - Server-side, `forkTeamToWorkspace` → `requireForkableLeague` enforces
     `isPublic && claimable` (throws "Team is not forkable" / HTTP 409 otherwise),
     then forks the reference team into the org's **private workspace** as an
     editable copy, stamping `ownerOrgId` and `sourceTeamId` on the new team.
   - The coach is redirected to the workspace copy at `/dashboard/teams/[newId]`.
   - (`/api/teams/[id]/unclaim` reverses it by deleting the private fork.)
3. **Roster.** On the workspace team the coach is now an org admin, so
   `canManageTeam` is true and editing is allowed. They fill the roster two ways:
   - **Player form** (`dashboard/_components/player-form.tsx`): includes the HS
     **Grade** (9–12) and **Squad** (Varsity/JV/Freshman) selectors;
     create/update flow validated by `CreatePlayerInputSchema` /
     `UpdatePlayerInputSchema` and persisted via `createPlayer` / `updatePlayer`
     (which carry `grade`/`squad` through to `sports:createPlayer`/`upsertPlayer`).
   - **CSV/JSON import** (`/dashboard/import`): `csv-import.ts` maps `grade` and
     `squad` columns into the payload; `PlayerImportSchema` validates `grade`
     (int 9–12) and `squad` (enum), and `bulkImportLeague` passes both to
     `upsertPlayer`. (Note: the CSV adapter only enforces `grade >= 9`; the
     `> 12` cap is caught downstream by the Zod schema as a validation error.)

The grade/squad path (task C) is **fully wired** through both entry points.

---

## Status of audit findings

3 of 5 audit findings are **resolved** by the activation change; the remaining 2
are non-blocking notes.

1. **RESOLVED — claimable from the product.** A **Claimable by coaches** toggle
   was added to league settings (`league-claimable-toggle.tsx` →
   `setLeagueClaimableAction` → existing `setLeagueClaimable`), alongside the
   public toggle. An admin can now make any seeded public league claimable
   without an admin-keyed mutation call. This unblocks the coach path: after the
   in-product Seed, the admin flips Public + Claimable and coaches can claim.
2. **RESOLVED (no longer required) — full-413 seed path.** The in-product button
   already seeds the full 413-team payload; with the new toggle setting the flags,
   a bespoke 413-seeding script is unnecessary. The Cobb script
   (`seed-ghsa-cobb.mts`) remains only as a self-contained example.
3. **RESOLVED — button copy.** Now reads **"413 teams"** and no longer claims the
   teams are claimable on import; it points the admin to the settings toggles.
4. **Minor (note) — Seed-button creates a Clerk org for the league.**
   `bulkImportLeague` (no `orgIdOverride`) creates a new Clerk org and an
   org-owned league (`isPublic: false` until toggled). This is harmless — an
   org-owned league that is public + claimable passes `requireForkableLeague`
   (which checks only `isPublic && claimable`) — but it does leave a stray org if
   the league is later deleted. For a perfectly clean public template, an
   admin-keyed `bulkImportLeague(payload, undefined, null)` (orgId null →
   `isPublic: true`) avoids the org; not required for launch.
5. **Minor — RESOLVED — CSV grade upper bound.** `csv-import.ts` now validates
   `grade` is `between 9 and 12` at the row level (was `>= 9` only).
