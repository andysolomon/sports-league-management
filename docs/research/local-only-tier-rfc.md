# RFC — Free No-Login Local-Only Tier (WSM-000137)

**Status:** Draft for review. Read before building #258. Pairs with the org-workspace data
model ([org-workspace-data-model-rfc](./org-workspace-data-model-rfc.md)), the import pipeline
(#248), and the "Free for one team, forever" landing promise.

## Decision log
- **2026-06-15 — Storage engine: Dexie** (§6 resolved). IndexedDB via Dexie, not raw IDB or
  localStorage. Added `dexie` (dep) + `fake-indexeddb` (dev, for node-env tests).
- **2026-06-15 — Entry path: `/local/**` parallel client-rendered route** (§4 resolved, Option A).
  The authed `/dashboard` SSR path is left untouched.
- **2026-06-15 — Migration trigger: explicit one-click prompt** on first sign-in (§8 resolved), not
  silent auto-import.
- **2026-06-15 — Slice 1 shipped.** `WorkspaceDataProvider` contract + `LocalWorkspaceProvider`
  (leagues/divisions/teams/players) over a versioned Dexie schema, with defaults and the
  jersey-duplicate policy mirrored from the server. 15 unit tests (CRUD, cascade delete, jersey
  policy, persistence-across-reopen). No UI yet — Slice 2 adds the `/local` shell.
- **2026-06-15 — Slice 2 shipped.** Public `/local` route (Clerk bypass) + client-rendered shell
  (local-mode banner) + team & roster CRUD against the provider + landing "Try it free" CTA.
  Satisfies AC #1 for the single-team core.
- **2026-06-15 — Slice 3 shipped.** Seasons, schedule (fixtures + results), and standings in local
  mode. **Standings use the server's existing pure `computeStandingsPure`** (imported directly), so
  local and synced standings cannot drift — the §11 risk is closed by sharing the one function, not
  porting it. Division create/assign UI added. `/local/schedule` page (season picker, fixtures,
  result entry, standings table). 9 new unit tests incl. an end-to-end standings computation.

## 1. Intent (from product)

> As a coach who wants to try the app with zero friction, I want a completely free tier where I
> **don't log in at all** and everything is saved **locally in my browser**, so I can manage a
> team without an account — and optionally upgrade to a synced account later without losing data.

Three acceptance criteria from the issue:
1. **Use with no account** — create team/roster/divisions/schedule; persists across reloads; no
   Clerk sign-in, no Convex calls.
2. **Clear boundary** — features that inherently need a server (org sharing, multi-user roles,
   public viewer links, Discover forks) are hidden or marked "requires an account."
3. **Upgrade without data loss** — on sign-up, offer a one-time import of the local workspace into
   a real org; then clear local mode.

## 2. The decisive constraint (why this is an epic, not a client swap)

**The entire dashboard fetches data server-side.** Pages are React Server Components that call
`src/lib/data-api.ts` directly (~46 files, ~150+ call sites), holding the Convex **admin key**.
Representative shape:

```ts
// src/app/dashboard/page.tsx (server component)
const { userId } = await auth();                     // Clerk, server-side
const orgContext = await resolveOrgContext(userId);
const [leagues, teams, players] = await Promise.all([ // all server-side, admin-keyed
  getLeagues(ids), getTeams(ids), getPlayers(ids),
]);
```

A server component runs on Vercel. **It cannot read the browser's IndexedDB/localStorage** — the
local data lives in the user's browser, and the server rendering the page has no access to it.

> **Therefore the tempting "swap the Convex client under the existing pages and local mode just
> works" approach does not work.** Those pages render on the server; there is nothing to swap that
> would give them the browser's data.

What a real local tier needs is a **parallel, client-rendered path**: pages that are
`"use client"`, read from a client-side provider over IndexedDB, and never round-trip to the
server for data. This is the core architectural decision in §4.

The silver lining: the data layer is an **excellent seam**. All 88 `data-api.ts` functions
delegate to one `queryConvex`/`mutateConvex` gateway; the 12 entity DTOs live in
`packages/shared-types`; there is **zero** existing browser-storage code. So the *contract* a local
provider must satisfy is already crisp — we just have to render against it on the client.

## 3. Entity scope — what is local-capable

Local mode targets the **single-coach, single-team** core. Anything inherently multi-party or
server-trust-dependent stays account-only.

| Entity / feature | Local-capable? | Rationale |
| --- | --- | --- |
| League (one, implicit "My League") | ✅ | Pure container |
| Divisions / Conferences | ✅ | Local grouping |
| Teams | ✅ | The point of the tier |
| Players / roster | ✅ | The point of the tier |
| Seasons | ✅ | Local scoping of schedule/standings |
| Schedule / fixtures | ✅ | Local-only games |
| Standings (computed) | ✅ | Pure function of local results |
| Depth chart | ✅ | Local |
| CSV/JSON import (seed local) | ✅ | Reuses #248 client adapter; writes to local store |
| Madden/SPRT ratings overlay | ⚠️ later | Reference data is server-side; could ship a static snapshot |
| Org / members / RBAC | ❌ account-only | No second user exists locally |
| Public viewer links (`/leagues/...`) | ❌ account-only | A link must resolve on a server for someone else |
| Discover forks (claim/unclaim) | ❌ account-only | Forks reference server-curated catalog into a server org |
| Sync / export reports | ❌ account-only | Server concept |
| Billing / tier | ❌ account-only | Local **is** the free tier |

The boundary in AC #2 falls out of this table directly.

## 4. Architecture options & recommendation

### Option A — Parallel client-rendered route (`/local/**`) ✅ RECOMMENDED
A sibling app surface under `/local` (public route; no Clerk). Every page is a client component
that reads/writes a **client-side data provider** (§5) backed by IndexedDB. The marketing CTA
"Try it free / no account" links here. The existing `/dashboard/**` stays exactly as-is (SSR +
Convex + Clerk).

- **Pros:** clean isolation; no risk to the authed app; honest about the SSR constraint; lets us
  reuse presentational components (forms, tables) while swapping only the data source; shippable as
  thin vertical slices (team → roster → schedule).
- **Cons:** some UI duplication at the page/loader level (mitigated by extracting shared dumb
  components that take data as props).

### Option B — Make the dashboard client-fetching everywhere
Convert `/dashboard/**` to client-side data fetching against a provider that is Convex **or** local.

- **Pros:** one set of pages.
- **Cons:** a large rewrite of ~46 server components, loses SSR benefits for the authed app, and
  couples a risky refactor of the paying path to a free-tier experiment. **Rejected.**

### Option C — Local "mode flag" inside existing routes
A global flag that makes `data-api` resolve to local. **Impossible for SSR pages** (the server
can't read the browser store), so it degenerates into Option B. **Rejected.**

**Recommendation: Option A.** It is the only option that respects the SSR constraint, ships
incrementally, and quarantines all risk away from the authed/paying surface.

## 5. The data-provider seam

Define a transport-agnostic interface that BOTH the existing Convex path and the new local path
satisfy, expressed in terms of the existing `shared-types` DTOs:

```ts
// packages/shared-types (or a new sibling): the contract local mode must meet
interface WorkspaceDataProvider {
  listTeams(): Promise<TeamDto[]>;
  createTeam(input: CreateTeamInput): Promise<TeamDto>;
  updateTeam(id: string, input: UpdateTeamInput): Promise<TeamDto>;
  deleteTeam(id: string): Promise<void>;
  listPlayersByTeam(teamId: string): Promise<PlayerDto[]>;
  // …divisions, seasons, fixtures, standings — the local-capable subset of §3
}
```

- **Convex provider** = thin wrappers already in `data-api.ts` (server-side).
- **Local provider** = a client module that implements the same methods over IndexedDB, generating
  ids client-side (e.g. `crypto.randomUUID()`), and computing standings with the existing pure
  `computeStandings` logic (extract it from server code into a shared pure module so both paths
  share one implementation).

Only the **local-capable subset** (§3) needs methods. Account-only methods simply don't exist on
the local provider, which is what enforces the boundary in code.

## 6. Local storage design

- **Engine:** **Dexie** (IndexedDB wrapper) — recommended over raw IndexedDB (ergonomics, queries,
  migrations) and over `localStorage` (5MB cap, string-only, sync API blocks the main thread). One
  small dependency; no server footprint. _Decision needed._
- **Database:** one IndexedDB database `wsm-local`, version-stamped, with object stores mirroring
  the local-capable DTOs: `leagues, divisions, teams, players, seasons, fixtures, gameResults,
  depthChart`. Indexes on the foreign keys the UI filters by (`teamId`, `seasonId`, `leagueId`).
- **IDs:** client-generated UUID strings, so a local record's shape matches a DTO `id: string`.
- **Single workspace:** local mode is implicitly one league / "my program"; no multi-tenant
  columns (`orgId`, `ownerOrgId` absent).
- **Versioning/migrations:** Dexie's versioned schema; bump on shape changes.

## 7. Feature gating / boundary (AC #2)

- Local pages render only the local-capable feature set (§3).
- Account-only affordances appear as **disabled chips/badges** reading "Requires a free account →"
  linking to sign-up, rather than being silently missing (clearer for the user, and an upgrade
  funnel). A small `<AccountOnly>` wrapper centralizes this.
- A persistent banner: "You're in local mode — data is saved only in this browser. Create a free
  account to back it up and share." (one-line, dismissible per session).

## 8. Local → account migration (AC #3)

The upgrade must not lose data. Flow:

1. User in local mode clicks "Create a free account to save this" (or signs up normally).
2. After first authenticated load, detect a non-empty local DB and offer **"Import your local
   workspace"** (recommended: explicit one-click prompt, not silent auto-import — avoids surprising
   merges and double-imports).
3. Serialize the local DB to the **existing `LeagueImportPayload`** shape (§ import) and POST to the
   existing `/api/cli/import` → `bulkImportLeague`. **This reuses #248 end-to-end** — no new ingest
   path. Fixtures/standings beyond the import schema migrate via the fixtures API in a second pass.
4. On success, **clear the local DB** and route into the normal dashboard.

Because migration emits the same payload the importer already validates server-side, the
local→server boundary is one well-tested funnel, not a bespoke sync engine.

## 9. Seeding local data via import (#248 synergy)

`src/lib/csv-import.ts`'s `csvToLeagueImport()` already produces a `LeagueImportPayload` purely on
the client. In local mode we point that **same** normalized payload at the **local provider's**
bulk-insert instead of the server route. So a coach can drop a CSV and instantly populate the local
workspace — and the exact same payload shape later migrates to the server (§8). One shape, three
uses (server import, local seed, local→server migration).

## 10. Phased vertical slices

1. **Slice 1 — Provider + storage spine.** Dexie schema + `LocalWorkspaceProvider` implementing the
   team/player subset; unit tests for CRUD + persistence. No UI yet. _(the "is the seam real" proof)_
2. **Slice 2 — `/local` shell + single team.** Public `/local` route, "Try it free" CTA on the
   landing page, create/edit one team + roster against the provider; persists across reloads.
   (Matches AC #1 minimally.)
3. **Slice 3 — Divisions, seasons, schedule, standings.** Extract `computeStandings` into a shared
   pure module; wire the rest of the local-capable entities.
4. **Slice 4 — CSV/JSON seed into local** (reuse #248 adapter against the provider).
5. **Slice 5 — Boundary polish.** `<AccountOnly>` chips, local-mode banner, hide Discover/roles/
   public-viewer in the local shell. (AC #2.)
6. **Slice 6 — Migration on sign-up.** Serialize local DB → `LeagueImportPayload` → `bulkImportLeague`,
   fixtures second pass, clear local DB. (AC #3.)

Each slice is independently shippable and testable on prod; only Slice 6 touches the authed path.

## 11. Risks & open questions

- **UI duplication** between `/dashboard` and `/local`. Mitigation: extract presentational
  components that take data as props; only the loaders differ. Worth an explicit pass in Slice 2.
- **Standings logic divergence.** Must extract `computeStandings` to one shared pure function used
  by both providers, or local and server standings will drift. Tracked in Slice 3.
- **Storage limits / eviction.** IndexedDB can be evicted under storage pressure or in private
  windows. The local-mode banner must set expectations ("saved only in this browser"); migration is
  the durable answer.
- **Ratings overlay** (Madden/SPRT) is reference data — out of scope for local v1; revisit with a
  static snapshot if demanded.
- **Decisions to confirm:** Dexie vs raw IDB (§6); `/local` route vs mode flag (§4 — recommend
  `/local`); explicit vs auto migration prompt (§8 — recommend explicit).

## 12. Recommendation summary

Build a **parallel client-rendered `/local` surface** (Option A) over a **`WorkspaceDataProvider`
contract** (§5) implemented on **IndexedDB via Dexie** (§6), scoped to the **single-team local
entity set** (§3), with the **boundary surfaced as upgrade chips** (§7) and a **one-click migration
that re-uses the #248 import funnel** (§8–9). Ship as six vertical slices (§10); only the last
touches the authed app. This respects the hard SSR constraint, keeps all risk off the paying path,
and turns the free tier into an upgrade funnel rather than a separate codebase.
