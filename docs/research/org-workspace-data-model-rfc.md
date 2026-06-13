# RFC — Multi-Tenant Org Workspace Data Model (WSM-000113)

**Status:** Draft for review. Foundational — read before building. Supersedes part of the
team-claim approach (#226–228). Pairs with the coach-platform strategy docs.

## 1. Intent (from product)

> NFL would only be claimable **per organization** — the claim doesn't affect all users, just
> users within an org. There should be an **org admin** who sets up an account, and the org
> has **users with different authorization access**. Org A and Org B can **subscribe to
> whatever discovery data we allow and manage/manipulate that data however they want within
> their org without affecting other orgs**.

Restated: a **multi-tenant** model where each organization is an isolated workspace. Orgs
import curated reference data and get their **own private, editable copy**; edits never touch
other orgs or the public reference. Each org has members with **roles**.

## 2. Why the current model doesn't satisfy this

What shipped (#226–228) — **team-claim on shared data:**
- One shared league record; `team.ownerOrgId` marks who may edit.
- Editing mutates the **shared** team/players → visible to every subscriber + the public viewer.

That's correct for a **shared real league** (e.g. a GHSA region where many schools compete and
standings must be common). It is **wrong** for the isolation this RFC wants: Org A's edits to
"their NFL" must not affect Org B or the reference. **So `claimable` on NFL is intentionally
NOT set** until this model lands.

## 3. Two distinct concepts (name them)

| Concept | What it is | Edit model | Example |
| --- | --- | --- | --- |
| **Reference data** | Curated, public, read-only catalog we maintain | We edit (seed/nflverse/Madden); orgs can't | NFL, the GHSA Cobb directory, ratings |
| **Org workspace** | An org's **private copy** of imported reference data | The org's members edit freely; isolated | "Org A's NFL", a coach's program |
| **Shared league** _(later/optional)_ | A real competition multiple orgs join | Each org edits only its team; standings shared | A real GHSA region |

This RFC defines **Reference + Org workspace** (the isolation the user asked for). The
**shared-league** case is a separate, optional mode (the #226–228 mechanic) — see §8.

## 4. Proposed object model

### 4.1 Tenant & people
- **Organization** = Clerk Org (already the tenancy unit). Has members.
- **Membership role** (intra-org RBAC) — beyond Clerk's admin/member, app-level roles:
  - `owner/admin` (head coach / AD): manage org, invite users, import/fork, billing.
  - `coach`: edit roster, depth chart, stats.
  - `assistant`: edit a subset (e.g. stats only).
  - `viewer`: read-only.
  - Store as a `orgMemberRoles` mapping (orgId, userId, role) or Clerk custom roles. _Decision in §9._

### 4.2 Data: reference vs workspace
Add an **ownership discriminator** to leagues/teams/players (and ratings stay on reference):
- **Reference** records: `orgId = null`, `kind = "reference"`. Read-only to orgs.
- **Workspace** records: `orgId = <org>`, `kind = "workspace"`, plus **`sourceId`** → the
  reference record they were copied from (provenance + ratings link + future re-sync).

### 4.3 The import = **fork** action
When an org imports reference data (à la carte selection):
1. Create org-owned **workspace copies** of the selected league/divisions/teams/players
   (`orgId = org`, `sourceId = reference id`).
2. The org edits its copies; nothing on the reference or other orgs changes.
3. Re-importing is idempotent (keyed by `sourceId` + `orgId`).

### 4.4 Ratings & reference attributes
Workspace players keep `sourceId`; **SPRT/Madden ratings resolve from the source** (live,
not duplicated) while the **roster structure is owned/editable** by the org. So an org can
re-arrange its depth chart and still see fresh ratings — without us running the rating
pipeline per tenant.

### 4.5 Isolation (the load-bearing rule)
Every dashboard query returns: **reference data (for discovery only) + the caller's org
workspace data**. A workspace record is visible/editable **only** to members of its `orgId`.
This replaces today's `visibleLeagueIds` union with a workspace-scoped resolver.

## 5. What changes vs. today

- **Subscriptions / à la carte (#100):** the team scope becomes *which reference teams to
  fork into the workspace*, rather than a display filter on shared data.
- **Team-claim engine (#226–228):** repurposed. `ownerOrgId`/`claimable` stay useful for the
  **shared-league** mode (§8); the **default import becomes fork-to-workspace**. The claim
  *mutation* effectively becomes "fork this team into my org."
- **Authorization:** team edits authorized by **workspace org membership + role**, not just
  `org:admin` of a shared league.
- **Active-league switcher / scoping:** scopes to the org's workspace leagues.

## 6. Tradeoffs

- **+ True isolation** — matches the requirement exactly; no cross-org/public leakage.
- **+ Clean mental model** — "your org, your data."
- **− Data duplication** — N orgs forking the NFL = N roster copies (ratings are not
  duplicated, mitigating cost).
- **− Migration** — existing subscriptions/claims must be converted to workspace forks.
- **− Re-sync complexity** — if the reference changes (trade, new player), workspace copies
  don't auto-update; need a "pull latest from source" affordance (later).

## 7. Alternative considered: overlay (rejected for v1)
Keep one shared record; store **per-org edit overlays** (diffs) layered at read time. Storage-
efficient, no duplication, auto-inherits reference updates — but **much more complex** (every
read merges overlays; conflict semantics). Recommend **copy-on-fork** for v1; revisit overlay
only if duplication cost bites.

## 8. The shared-league question (must resolve)
Per-org copies **lose shared standings/schedule** across orgs. For a **real GHSA region**,
coaches want to compete on a common table. Options:
- **A. Everything is a private workspace** (simplest; no cross-org competition in-app). Real
  standings live on MaxPreps; we're a management tool.
- **B. Support both:** private workspaces (this RFC) **and** opt-in shared leagues (the
  #226–228 team-claim mechanic) where orgs join a common competition.
- _Recommendation:_ ship **A** first (it's what the user asked for), design **B** as a later
  mode so the GHSA real-competition case isn't foreclosed.

## 9. Open decisions (need product input)
1. **Roles:** the exact intra-org role set + permissions (start with admin/coach/viewer?).
2. **Shared leagues:** option A now, B later — confirm?
3. **Re-sync:** do workspace copies ever pull updates from the reference, or fork-and-forget?
4. **Billing/limits:** per-org plan limits (teams, users) — tie into existing tiers?
5. **Migration:** convert current subscriptions/claims (only the test data so far) to forks.

## 10. Phasing
1. **Model + isolation:** ownership discriminator + `sourceId`; fork-on-import; workspace-
   scoped visibility + auth; intra-org roles (admin/coach/viewer).
2. **Migrate** existing subscriptions/claims → workspace forks; retire shared-edit claim path.
3. **Workspace polish:** invite users, role management UI, re-sync-from-source.
4. **Shared leagues (option B)** if/when the GHSA real-competition case is prioritized.

## 11. Impact on in-flight work
- The **claim engine (#226–228)** is not wasted — `ownerOrgId`/`claimable` + the auth
  extension become the **shared-league** primitive (§8B). The default path shifts to fork.
- The **stat-keeping keystone PRD (#112)** is unaffected in spirit but its data attaches to
  **workspace** teams/games, not shared ones.
- **Do NOT** flip NFL `claimable` until fork-to-workspace exists (avoids shared-data leakage).
