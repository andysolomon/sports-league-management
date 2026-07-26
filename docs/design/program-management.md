# Program Management (Epic C)

Status: approved design (2026-07-25). Decision record: model coach identity, prestige,
schemes, goals, and job security as first-class persisted state; hook season finalize off
`completeSeason` reading F2 `seasonTeamRecords` only. Covers Epic C / Wave 3 (slices C1–C4);
gated by `FLAG_DYNASTY_PROGRAM_V1` and `dynastyConfig.programV1Enabled`.

## Context

**Shipped today**

- No `coach` documents in `schema.ts`; "coach" is an org membership role string only.
- `completeSeason` (`apps/web/convex/sports.ts:2163`) finalizes season status without
  program evaluation.
- Team strength for sim uses attributes / Madden overalls — no offensive/defensive scheme
  or tempo stored on teams.
- `computeStandingsPure` (`standings.ts:105`) supplies standings; no prestige or goals.

**Missing**

- `coaches`, `coachSeasons`, `teamSeasonPrograms` tables and `convex/program.ts`.
- Coach Home route, Program/Staff cards, season goals card, weekly gameplan on fixtures.
- `src/lib/program/*` pure libs feeding A6 `pbp/schemes.ts`.
- `coaches.userId` + `by_userId` index for Wave 5 (day one).

**Dependencies:** Epic F2 (`seasonTeamRecords`) for goals/prestige; Epic B6 (training) before
C4 skill-tree payoff; slice **A6** ships immediately after **C3** (scheme setters).

## Schema changes

```ts
coaches: defineTable({
  leagueId: v.id("leagues"),
  teamId: v.id("teams"),
  userId: v.optional(v.string()),
  displayName: v.string(),
  archetype: v.string(),
  offensiveScheme: v.optional(v.string()),
  defensiveScheme: v.optional(v.string()),
  aggression: v.optional(v.number()),
  clockManagement: v.optional(v.number()),
  developmentRating: v.optional(v.number()),
  recruitingRating: v.optional(v.number()),
  gameplanRating: v.optional(v.number()),
  prestige: v.number(),
  skillPoints: v.optional(v.number()),
  unlockedNodesJson: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("by_teamId", ["teamId"])
  .index("by_userId", ["userId"])
  .index("by_leagueId", ["leagueId"]),

coachSeasons: defineTable({
  coachId: v.id("coaches"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  wins: v.number(),
  losses: v.number(),
  ties: v.number(),
  playoffResult: v.optional(v.string()),
  goalsMetJson: v.optional(v.string()),
  prestigeDelta: v.optional(v.number()),
  finalizedAt: v.optional(v.string()),
})
  .index("by_coach_season", ["coachId", "seasonId"])
  .index("by_season_team", ["seasonId", "teamId"]),

teamSeasonPrograms: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  prestige: v.number(),
  facilitiesTier: v.optional(v.number()),
  offensiveScheme: v.optional(v.string()),
  defensiveScheme: v.optional(v.string()),
  tempo: v.optional(v.string()),
  blitzRate: v.optional(v.number()),
  seasonGoalsJson: v.optional(v.string()),
  jobSecurity: v.optional(v.number()),
  boosterConfidence: v.optional(v.number()),
  weeklyGameplanJson: v.optional(v.string()),
  updatedAt: v.string(),
})
  .index("by_season_team", ["seasonId", "teamId"]),
```

Seed migration optional: `resolveProgram(doc | null)` returns defaults when row missing.

## Function surface

**Module:** `apps/web/convex/program.ts`.

| Symbol | Kind | Purpose |
|--------|------|---------|
| `getCoach` / `listCoaches` | query | Coach Home / Team Home |
| `upsertCoach` | internalMutation | Staff assignment |
| `getTeamSeasonProgram` | query | Program card |
| `upsertTeamSeasonProgram` | internalMutation | Commissioner / admin |
| `setWeeklyGameplan` | internalMutation | Per-fixture prep |
| `finalizeCoachSeason` | internalMutation | Called from `completeSeason` |
| `evaluateSeasonGoals` | internalMutation | Pure lib wrapper persist |
| `applyProgramPrestige` | internalMutation | Post-season prestige delta |

`completeSeason` (`sports.ts:2163`) orchestrates: read `seasonTeamRecords` (indexed per
team), run evaluation, write `coachSeasons` + program prestige — no fixture scans.

Per-team gameplan writes use `authorizeTeamMutation(teamId, userId)` in server actions
(same pattern as `offseason.ts:18`).

## Pure-lib work

Under `apps/web/src/lib/program/`:

| Module | Exports |
|--------|---------|
| `prestige.ts` | `applyPrestigeDelta(current, seasonOutcome): { prestige, delta }` (hysteresis) |
| `goals.ts` | `generateGoals(teamId, seasonId, records, aggregates)`, `evaluateGoals(...)` |
| `job-security.ts` | `computeJobSecurity(inputs): number` |
| `schemes.ts` | scheme catalog + `tendencyVector(scheme): Tendencies` — **consumed by A6** |
| `coach-skills.ts` | `unlockNode(tree, nodeId)`, `spendSkillPoints(...)` |
| `gameplan.ts` | `mergeGameplan(base, weekly): Gameplan` |

Goal evaluation reads **only** F2/F3 aggregates (read-spy) — never loops game stats.

## UI surface

- `/dashboard/coaches/[coachId]` — Coach Home (new `ResourceHeaderKind` `"coach"`,
  `coachHomeHref`, `buildCoachSiblingLinks` in `resource-navigation.ts`).
- Team Home: Program + Staff cards.
- Season Home: season goals card (`seasonSubpageHref` siblings unchanged except goals on
  main season page).
- Fixture surface: weekly gameplan (not a nav destination).
- No new sidebar entry — reach coaches from Team Home.
- `CONTEXT.md` entries before merge.

ADR 0001: competition views remain season-owned; coach resource is program-scoped.

## Slices

- **C1 — coach identity + staff** (read-only w.r.t. sim). **Depends:** F1.
- **C2 — prestige, goals, job security** + `completeSeason` hooks. **Depends:** F2, C1.
- **C3 — schemes + gameplanning** data on `teamSeasonPrograms`. **Depends:** C1.
- **A6 — sim schemes** (Epic A; immediately after C3). **Depends:** C3.
- **C4 — skill tree + development economy.** **Depends:** B6, C1.

New tables → `resetCanonicalFixture` (`e2eSeed.ts:530`) in the same PR.

## Invariants

1. `|prestigeDelta| ≤ 12` per season per team.
2. Goal generation deterministic per `(teamId, seasonId)`.
3. Goal evaluation performs zero reads of `playerGameStats` / `gamePlayLogs` (read-spy).
4. Sum of a coach's `coachSeasons` W/L/T matches summed `seasonTeamRecords` for their teams.
5. **Scheme neutrality:** default scheme + aggression 50 → `simulateGameLog` byte-matches
   pre-A6 log with v2 disabled.
6. All `program.ts` writes are `internalMutation` with guard-test backstop.
7. Every handler has `returns:`; DTO mappers use `Infer<typeof …Validator>`.
8. `coaches.userId` index exists from C1 for future Wave 5 binding.

## Non-goals

- Multi-coach simultaneous online play (Wave 5).
- AI coach carousel or firing minigames beyond job-security number.
- College NIL or booster payola simulation.
- Moving `completeSeason` out of `sports.ts` (only add internal calls).
- Public Convex mutations or client `useQuery`.
