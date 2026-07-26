# Dynasty History, Awards & Narrative (Epic D)

Status: approved design (2026-07-25). Decision record: build career history from F3
`playerSeasonAggregates` at `completeSeason`, never scan `playerGameStats` or
`gamePlayLogs` for record books or awards. Covers Epic D / Wave 4 (slices D1–D5); gated
by `FLAG_DYNASTY_HISTORY_V1` and `dynastyConfig.historyV1Enabled`.

## Context

**Shipped today**

- Per-fixture stats in `playerGameStats`; play logs in `gamePlayLogs` (`schema.ts:329`).
- No tables spanning seasons for records, awards, polls, HoF, or recaps.
- `dynastyEvents` (Epic F4) can store headlines but no D-specific producers yet.
- League Home has no program history or record book routes.

**Missing**

- `playerCareerTotals`, `programRecords`, `awards`, `hallOfFame`, `weeklyPolls`,
  `seasonRecaps`.
- `convex/history.ts` + `finalizeSeasonHistory` idempotent hook from `completeSeason`
  (`sports.ts:2163`).
- Routes: `/dashboard/seasons/[id]/{rankings,awards,recap}` and
  `/dashboard/leagues/[id]/history` (league-scoped — ADR 0001 allows; season-scoped
  competition stays under Season Home).
- `DynastyNewsFeed` on League and Season Home; career totals on Player Home.

**Load-bearing pipeline**

```
playerGameStats (per fixture) → sim writes
  → incremental delta (F3) → playerSeasonAggregates
  → materialize at completeSeason (D1) → playerCareerTotals
```

If aggregate batch exceeds Convex read limits, shard by team using existing
`seasonRollovers` lease/stage pattern — do not invent a second concurrency idiom.

## Schema changes

```ts
playerCareerTotals: defineTable({
  leagueId: v.id("leagues"),
  playerId: v.id("players"),
  totalsJson: v.string(),
  updatedAt: v.string(),
})
  .index("by_playerId", ["playerId"])
  .index("by_leagueId", ["leagueId"]),

programRecords: defineTable({
  leagueId: v.id("leagues"),
  teamId: v.optional(v.id("teams")),
  category: v.string(),
  span: v.string(),
  entriesJson: v.string(),
  updatedAt: v.string(),
})
  .index("by_league_category", ["leagueId", "category"])
  .index("by_team_category", ["teamId", "category"]),

awards: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  awardType: v.string(),
  playerId: v.id("players"),
  teamId: v.id("teams"),
  scoreValue: v.number(),
  tieBreakJson: v.optional(v.string()),
  createdAt: v.string(),
})
  .index("by_season", ["seasonId"])
  .index("by_season_type", ["seasonId", "awardType"]),

hallOfFame: defineTable({
  leagueId: v.id("leagues"),
  playerId: v.id("players"),
  inductedSeasonId: v.optional(v.id("seasons")),
  citation: v.string(),
  inductedAt: v.string(),
})
  .index("by_leagueId", ["leagueId"]),

weeklyPolls: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  week: v.number(),
  rankingsJson: v.string(),
  publishedAt: v.string(),
})
  .index("by_season_week", ["seasonId", "week"]),

seasonRecaps: defineTable({
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  bodyMarkdown: v.string(),
  generatedAt: v.string(),
})
  .index("by_seasonId", ["seasonId"]),
```

## Function surface

**Module:** `apps/web/convex/history.ts`.

| Symbol | Kind | Purpose |
|--------|------|---------|
| `finalizeSeasonHistory` | internalMutation | Idempotent; called from `completeSeason` |
| `getCareerTotals` | query | Player Home |
| `listProgramRecords` | query | Record book |
| `listSeasonAwards` | query | Awards page |
| `getWeeklyPoll` | query | Rankings page |
| `listSeasonRecaps` | query | Recap page |
| `listHallOfFame` | query | League history |
| `computeWeeklyPoll` | internalMutation | Inline from `simulateWeekAction` (~12 team records) |

Award/record scoring stays in pure libs; Convex only persists outputs + `scoreValue`.

## Pure-lib work

| Module | Exports |
|--------|---------|
| `apps/web/convex/lib/awards.ts` | `computeAwardSlate(aggregates, weights): AwardWinner[]` |
| `apps/web/convex/lib/records.ts` | `mergeTopN(existing, candidate): { entries, broken[] }` |
| `apps/web/src/lib/history/power-rankings.ts` | `dampedRankings(prev, standings): PollRow[]` |
| `apps/web/src/lib/history/recap.ts` | `renderSeasonRecap(ctx): string` |
| `apps/web/src/lib/history/hall-of-fame.ts` | `scoreHoFCandidate(career): number` |

`broken[]` from `mergeTopN` feeds F4 `record_broken` dynasty events.

## UI surface

- `/dashboard/seasons/[id]/rankings` — extend `seasonSubpageHref` union
  (`resource-navigation.ts:107`) + `buildSeasonSiblingLinks` (`:184`).
- `/dashboard/seasons/[id]/awards`, `/dashboard/seasons/[id]/recap` — same pattern.
- `/dashboard/leagues/[id]/history` — record book, HoF, champions (League Home child).
- `DynastyNewsFeed` card on League Home and Season Home (reads `listDynastyEvents`).
- Player Home: career totals + accolades.
- Add **Program History** and **Record Book** to `CONTEXT.md` before UI slices.

Data path: page → `data-api.ts` → `getConvexClient()` — no `convex/react`.

## Slices

- **D1 — career totals + program records** + `finalizeSeasonHistory` core. **Depends:** F3, F2.
- **D2 — awards** (pure scorer + persist). **Depends:** D1, C1 (identity labels).
- **D3 — weekly polls** (damped rankings). **Depends:** F2, D1.
- **D4 — news feed + season recap** (F4 consumers). **Depends:** D1–D3, prior event producers.
- **D5 — Hall of Fame.** **Depends:** D1.

Table-adding slices extend `resetCanonicalFixture` (`e2eSeed.ts:530`) in the same PR.

## Invariants

1. `finalizeSeasonHistory` is idempotent (second call no-op writes).
2. Career `totalsJson` keys equal sum of F3 season aggregates per player.
3. Award computation is a pure function including tie handling; every `scoreValue` reproduces
   from the documented weights ("why did he win").
4. Program record ranks are contiguous 1..n with monotonically non-increasing stat values.
5. Poll ranks are a permutation; week-over-week movement bounded (damping).
6. `finalizeSeasonHistory` reads **zero** `playerGameStats` and **zero** `gamePlayLogs` rows
   (read-spy).
7. All writes `internalMutation` (WSM-000096); handlers declare `returns:` validators.
8. Weekly poll inline path reads O(teams) `seasonTeamRecords` docs, not fixtures.

## Non-goals

- Scanning per-game stat tables for career or award math.
- Real-media licensing or external news APIs.
- Player-facing social feed or comments.
- Extending `PlayerGameStatLine` for award metadata.
- Moving stat ingestion out of existing sim path.
- Wave 5 shared commissioner workflows for history editing.
