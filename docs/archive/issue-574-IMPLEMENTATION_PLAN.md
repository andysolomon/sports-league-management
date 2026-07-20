# Issue 574 — Normalize Players Home and Player child navigation

## 1. Product goal and scope boundaries

Finish ASR-19 for the Players / Player surfaces: league-wide **Players Home** lists Active League players; selecting a row opens **Player Home**; Player Home siblings are Overview + Development; ratings / season stats / attributes stay on Overview; remove the last legacy `?from=` emitter and any generated “Back to …” orientation in favor of Resource Headers + browser history.

**In scope**
- Remove remaining dashboard `?from=` navigation into Player Home
- Language / orientation polish on Players Home and Player entry points where still off-contract
- Unit + focused Playwright verification that Player URLs stay canonical (no `?from=`)

**Out of scope / deferred**
- Settings / Import / Billing shell moves (#576)
- Full nav acceptance matrix (#578)
- Public fan surfaces (`/leagues/.../players`) “Back to League” copy (not dashboard ASR-19)
- Gamecast / schedule “Back to Schedule” history affordances (not Player `?from=`)

## 2. Current baseline

Already shipped in #571 (Resource Headers) and related Active League work:
- `players/[id]/page.tsx` and `players/[id]/development/page.tsx` use `ResourceHeader` + `buildPlayerSiblingLinks` (Overview / Development)
- Deep links call `syncActiveLeagueForResource`
- `players-table.tsx` navigates with `router.push(\`/dashboard/players/${id}\`)` (no query)
- `team-detail.spec.ts` already asserts Resource Header siblings and absence of `?from=` / “Back to …”

Still open:
- `teams/[id]/team-management.tsx` still does `router.push(\`/dashboard/players/${id}?from=team-${team.id}\`)` — last production emitter
- Players Home (`players/page.tsx`) still titles the page `"Players"` (CONTEXT: **Players Home**) and surfaces Teams / Divisions cross-links under PageHeader actions; Teams Home similarly says `"Teams"` today — prefer aligning Players Home title/description to language lock without inventing a new layout system

## 3. Missing capabilities

| Gap | ASR / CONTEXT | Fix |
| --- | --- | --- |
| Team roster → Player still appends `?from=team-…` | ASR-19 | Navigate via `playerHomeHref(playerId)` |
| No compile/unit guard that dashboard code reintroduces `?from=` on player URLs | ASR-19 / ASR-25 | Unit assertion or grep-backed test around emitters |
| Players Home title not language-locked | CONTEXT | Rename PageHeader title to “Players Home” (and soft description if needed) |
| E2E does not cover team-roster → Player Home path | ASR-25 | Extend team/player e2e: click roster player → URL is `/dashboard/players/[id]` with no query |

## 4. Milestones / phases

### Phase 1 — Kill `?from=` emitters

**Goals:** No dashboard first-party path builds Player URLs with `?from=`.

**Deliverables**
- Update `team-management.tsx` to `playerHomeHref(id)` (import from `resource-navigation`)
- `rg` audit: zero matches under `apps/web/src` for `players/.*\?from=` (tests may keep negative assertions)

**Acceptance criteria**
- [ ] Team roster player click lands on `/dashboard/players/[id]` with empty search
- [ ] No production `?from=team-` string remains in `apps/web/src`

### Phase 2 — Players Home orientation polish

**Goals:** Players Home reads as the Active League player directory.

**Deliverables**
- `players/page.tsx`: PageHeader title `"Players Home"`; keep Active League scoping; leave Teams/Divisions actions only if they remain useful cross-links (same pattern as today’s Teams Home cross-links) — do not add breadcrumbs or “Back to …” rows

**Acceptance criteria**
- [ ] Visible title uses Players Home language
- [ ] Selecting a player still opens Player Home (Overview) without `?from=`

### Phase 3 — Tests + type-check

**Goals:** Lock contracts.

**Deliverables**
- Unit: small test that `playerHomeHref` is used / no `?from=` in team-management navigation helper if extracted; or extend resource-navigation / players unit coverage
- Playwright: assert team-management / roster path (or players table) → Player Home URL has no `from` param; Resource Header Overview + Development remain
- `pnpm --filter @sports-management/web type-check`
- Focused Playwright green

**Acceptance criteria**
- [ ] Unit + focused e2e green
- [ ] Type-check green

## 5. Out-of-scope / deferred

- #576 Settings branch
- #578 epic-wide verification
- Changing Player sibling set beyond Overview + Development

## 6. Immediate next steps

1. Branch `feat/issue-574-players-navigation` from updated `main`.
2. Phase 1–3, then PR with `Closes #574`.

## Implementation Plan (task checklist)

**Story:** #574 Normalize Players Home and Player child navigation  
**Branch:** `feat/issue-574-players-navigation`

### Analysis

Resource Headers already cover Player Home / Development. The remaining defect is the last `?from=team-` push from Team Home roster management, plus light Players Home language alignment and regression tests.

### Tasks

- [ ] **1. Remove `?from=` from team-management player navigation**
  - Files: `apps/web/src/app/dashboard/teams/[id]/team-management.tsx`
  - Details: `playerHomeHref((p as RosterRow).id)`

- [ ] **2. Players Home PageHeader language lock**
  - Files: `apps/web/src/app/dashboard/players/page.tsx`
  - Details: title `"Players Home"`

- [ ] **3. Unit / static regression for no player `?from=` emitters**
  - Files: new or existing unit under `apps/web/src/.../__tests__/`

- [ ] **4. Playwright: roster → Player Home has no query**
  - Files: `apps/web/e2e/tests/team-detail.spec.ts` and/or players specs

- [ ] **5. Type-check + focused e2e**

### Test Strategy

- Unit: href builders + emitter absence
- E2E: team roster / players table → Player Home URL + Resource Header siblings
- Manual: Team Home → player → Development sibling → browser Back

### Acceptance Criteria Mapping

| Criterion | Task(s) | How Verified |
| --- | --- | --- |
| Players Home lists Active League players | 2 (baseline) | Existing page + e2e |
| Selection opens Player Home | 1, 4 | URL + Resource Header |
| Overview + Development siblings | baseline #571 + 4 | e2e |
| Ratings/stats/attributes stay on Overview | no change | audit |
| Remove `?from=` and generated Back-to | 1, 3, 4 | rg + e2e |
| Active League sync on Player deep link | baseline | existing pages |

### Risks & Notes

- Do not strip useful Teams/Divisions header actions unless they conflict with ASR — they are not `?from=` / Back-to orientation.
- Public league “Back to League” is out of scope.
