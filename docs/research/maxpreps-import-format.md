# MaxPreps Stat Import Format — Research

_Research date: 2026-06-16. Resolves the keystone's top open question — "the exact MaxPreps
import-file format" ([coach-interview-guide.md](./coach-interview-guide.md) Block D;
[stat-keeping-keystone-prd.md](./stat-keeping-keystone-prd.md)). Sourced web research into the
**documented** format — **not** scraping MaxPreps data (per the project's standing no-scrape
stance). Login-gated areas were not accessed._

## TL;DR — the export is documented and buildable

MaxPreps stat ingest is **not an API** — it's a public, documented **pipe-delimited `.txt`
file spec**. A coach uploads the file via **Save & Import Stats** on their MaxPreps Coach Admin,
or an approved partner pushes it automatically. **So the keystone's "MaxPreps export" is a
concrete, buildable `.txt` generator, not a reverse-engineering project.** The **exact
Football/Boys field names are now captured verbatim** (§2a, from the public spec page). The only
thing left is a **build-time credential** — the 32-char Stat Supplier ID, obtained by registering
a MaxPreps account (account-bound, so the team's to get at build time). Spec:
https://www.maxpreps.com/utility/stat_import/field_specs.aspx

## 1. How stats get into MaxPreps (football)

Three documented paths ([MaxPreps Stat Management](https://support.maxpreps.com/hc/en-us/articles/202103644-Stat-Management), [GHSA: Enter Scores & Stats](https://www.ghsa.net/how-enter-scores-stats-maxprepscom)):

1. **Manual web-form entry (default).** Coach Admin → Scores/Stats → edit a game → enter box
   score → "Save & Enter Stats" → type each player stat category into web forms. Publishes in
   ~15–30 min. This is what most coaches actually do — the friction the keystone targets.
2. **"Teams by MaxPreps" mobile app** — game-by-game scores/results (full stat entry is the website).
3. **Import from a stat partner** — "Save & **Import** Stats" consumes a partner-generated
   `.txt` file. MaxPreps imports from "**80+ stat partners**," nearly all via the *same* file
   spec (not bespoke APIs). [[Stat Import Partners]](https://support.maxpreps.com/hc/en-us/articles/202266384-Stat-Import-Partners)

There is also a printable paper stat sheet (source-of-truth during the game, hand-keyed after) —
the official football one documents the field set (see §3). [[MaxPreps Stat Sheets]](https://support.maxpreps.com/hc/en-us/articles/4405313793563-MaxPreps-Stat-Sheets)

## 2. The import file spec (the prize)

From the public **Export Field Specifications** (https://www.maxpreps.com/utility/stat_import/field_specs.aspx):

- **Format:** plain text, **pipe (`|`) delimited**, `.txt` extension. Filename cannot contain
  quotes or parentheses (rename to e.g. `import.txt` if needed).
- **Line 1:** the **32-character Stat Supplier ID** (e.g. `12345678-1234-1234-123456789012`).
- **Line 2:** header row of **exact MaxPreps field names**. **First field must be `Jersey`**;
  all others optional, any order.
- **Lines 3+:** one row per player, values in the same column order as line 2.
- **Rules:** omit zeros *unless* the stat is genuinely zero (e.g. INTs/turnovers); imports do
  **not** overwrite undeclared fields → multiple imports per game are allowed (e.g. a separate
  offense file and defense file). The published example is baseball:
  ```
  12345678-1234-1234-123456789012
  Jersey|AtBats|BaseOnBalls|Doubles|HitByPitch|Hits
  12|3|2|1|0|2
  ```
- **Getting a Supplier ID:** register as a "Stat Supplier" from a MaxPreps account → fill
  general info → issued the 32-char ID. Self-serve. **This is the one remaining build-time
  step** — the ID is account/identity-bound, so it's the team's to obtain when building/shipping
  the export. [[Stat Import Partners]](https://support.maxpreps.com/hc/en-us/articles/202266384-Stat-Import-Partners)
- **Exact football field names — RESOLVED 2026-06-16** (see §2a). The spec page exposes fields
  per sport via an ASP.NET form POST (not a static GET); the **Football/Boys** field list was
  retrieved verbatim from the live public page (no login — same POST a browser makes on "GO").

## 2a. Exact football import field names (verbatim, Football/Boys)

Header row = `Jersey|<fields>` — **`Jersey` is required and must be first**; all others optional,
any order; names must match **exactly**; omit zeros unless genuinely zero. Retrieved from
https://www.maxpreps.com/utility/stat_import/field_specs.aspx (Football/Boys).

| Group | Field names (verbatim) |
|---|---|
| **Rushing** | `RushingNum` `RushingYards` `RushingLong` |
| **Receiving** | `ReceivingNum` `ReceivingYards` `ReceivingLong` |
| **Passing** | `PassingComp` `PassingAtt` `PassingInt` `PassingYards` `PassingTD` `PassingLong` |
| **Off. fumbles / O-line** | `OffensiveFumbles` `OffensiveFumblesLost` `PancakeBlocks` |
| **Def. tackles** | `Tackles` (solo) `Assists` `TotalTackles` `TacklesForLoss` |
| **Def. sacks** | `Sacks` `SacksYardsLost` `QBHurries` |
| **Def. pass** | `INTs` `INTYards` `PassesDefensed` |
| **Def. blocks / fumbles** | `BlockedPunts` `BlockedFG` `FumbleRecoveries` `FumbleRecoveryYards` `CausedFumbles` |
| **Punt returns** | `PuntReturnNum` `PuntReturnYards` `PuntReturnLong` `PuntReturnFairCatches` |
| **Kick returns** | `KickoffReturnNum` `KickoffReturnYards` `KickoffReturnLong` `TotalReturnYards` |
| **Punts** | `PuntNum` `PuntYards` `PuntLong` `PuntInside20` |
| **Kickoffs** | `KickoffNum` `KickoffYards` `KickoffLong` `KickoffTouchbacks` |
| **Scoring TDs** | `RushingTDNum` `ReceivingTDNum` `FumbleReturnedTDNum` `IntReturnedTDNum` `PuntReturnedTDNum` `KickoffReturnedTDNum` `TotalTDNum` |
| **PAT / conversions** | `PATKickingMade` `PATKickingAtt` `PATKickingPoints` `PATRushingNum` `PATReceivingNum` `TotalConversionPoints` |
| **Field goals / safeties / points** | `FGMade` `FGAttempted` `FGLong` `Safeties` `TotalPoints` |

**Example football header + one row:**
```
<32-char-supplier-id>
Jersey|RushingNum|RushingYards|RushingTDNum|PassingComp|PassingAtt|PassingYards|PassingTD|PassingInt|ReceivingNum|ReceivingYards|ReceivingTDNum|Tackles|Assists|Sacks|INTs
12|14|92|2|0|0|0|0|0|3|41|1|5|2|1|0
```

_Method (reproducible, public): GET the page to read `__VIEWSTATE` + `__VIEWSTATEGENERATOR`,
then POST those plus `ctl00$Related_Content$selSport=Football`, `…$selGender=Boys`, `submit=GO`;
parse the `StatGroupName` / `StatSubGroupHeader` blocks. Swap `selSport=Flag Football` or
`selGender=Girls` for those variants — same mechanism, no auth._

## 3. The football stat field set (categories)

Verified from the official MaxPreps football stat-sheet PDF
([boys_football_stats.pdf](https://www.maxpreps.com/documents/stats/boys_football_stats.pdf)) —
this is the *schema* our capture model must produce (field-name strings TBD per §2):

- **Rushing:** rushes, yards, longest, TD, conversions, fumbles
- **Passing:** completions, attempts, interceptions, yards, TD, longest, fumbles
- **Receiving:** catches, yards, longest, TD, conversions, fumbles
- **Defense (per jersey #):** assisted/unassisted tackles, TFL, sacks (+yds), INT (+ret yds),
  fumble recovery (+yds), fumbles caused, pass defended, QB hurries, blocked kick/punt, safety
- **Special teams:** punt/kick returns, punts, kickoffs (att/yds/longest/TD, inside-20, TB, FC)
- **Scoring:** TDs (run/rec/misc), PAT, conversions, field goals (made/att/longest), safety
- **Team:** first downs, penalty yards

_(Flag football's set is the §3 offense plus **flag pulls**-centric defense — see
[flag-football-cobb-research.md](./flag-football-cobb-research.md) §3. Whether MaxPreps exposes
flag-specific import fields is unconfirmed.)_

## 4. How rival tools push to MaxPreps (validates the path)

| Tool | Football mechanism | Source |
|---|---|---|
| **Hudl** | Was direct auto-sync; **sync discontinued ~Jan 1, 2025** → now **manual `.txt` export + upload**. | [[MaxPreps/Hudl sync]](https://support.maxpreps.com/hc/en-us/articles/5493128608283-MaxPreps-HUDL-Data-Sync) |
| **GameChanger** | Manual "MaxPreps TXT Export"; **football not on its documented sport list** (baseball/softball/etc.). | [[GC manual upload]](https://help.gc.com/hc/en-us/articles/11298180524685-MaxPreps-Manual-Stat-Upload) |
| **Modern Football Technology** | **Automated** football stat push — MaxPreps "Xport Enabled Stat Partner" (Aug 2025). **First football-specific automated partner — a direct competitor in our lane.** | [[PRNewswire 2025-08-14]](https://www.prnewswire.com/news-releases/maxpreps-and-modern-football-technology-announce-partnership-to-automate-stat-reporting-for-high-school-football-teams-302529598.html) |
| QwikCut / TurboStats / PrestoStats | Market a MaxPreps export; mechanism/format not publicly documented. | `UNVERIFIED` |

**No vendor-neutral / NFHS box-score interchange standard exists** — MaxPreps' pipe-delimited
TXT is the de facto standard purely via market dominance.

## 5. GHSA submission context (football)

GHSA requires coaches to submit box scores to MaxPreps (powers media + region standings).
Football carries a **dual obligation**: MaxPreps (stats) **and** the separate **GHSA MIS** site
for results feeding the **Post-Season Ranking Formula** seeding. [[GHSA–MaxPreps]](https://www.ghsa.net/ghsa-and-maxpreps-sign-multi-year-agreement) [[PSR formula]](https://www.ghsa.net/constitution-section-2025-2026-appendix-psr-post-season-ranking-formula)
_(Recall: this mandate covers **tackle football**, not flag — see flag research §4.)_

## 6. What this means for the keystone

- **Build a "MaxPreps TXT Export" generator first** — pipe-delimited `.txt`, Line 1 = our
  Supplier ID, Line 2 = `Jersey|<football fields>`, one row per player. This is the universal,
  documented, coach-uploadable path and mirrors exactly what Hudl/GameChanger do.
- **Two-file trick:** since imports don't overwrite undeclared fields, we can emit separate
  offense and defense files — convenient for incremental/box-score-section workflows.
- **Automated "Xport Enabled" sync is a BD conversation with MaxPreps**, not a public API
  integration (the Modern Football model). Treat as a later, partnership-gated phase.
- **Competitive note:** Modern Football Technology already automates football stat push (Aug
  2025). Our differentiation stays the *capture* experience + the **flag** angle (where the
  tooling gap is wider), not "we can export to MaxPreps" alone.

## 7. Residual open questions (now minimal)

1. ~~Exact football field-name strings~~ **RESOLVED 2026-06-16** — see §2a (Football/Boys, verbatim).
2. **Stat Supplier ID** — the only true blocker left, and it's a **build-time credential**, not a
   research item: register a MaxPreps account as a Stat Supplier to get the 32-char ID for Line 1.
   Account/identity-bound → the team obtains it when building the export.
3. **Flag-football / Girls field set** — not yet pulled, but trivially obtainable via the same
   public POST (`selSport=Flag Football` / `selGender=Girls`). Worth grabbing before the flag lane builds.
4. Whether the "Save & Import Stats" screen strictly validates the format (likely yes) — confirm at build with a real upload.
5. Exact GHSA per-game submission deadline/penalty wording (2025 Football Coaches Manual didn't load).

**Note on sourcing:** `support.maxpreps.com` and `help.gc.com` article bodies returned HTTP 403
to direct fetch; findings there are reconstructed from search snippets + state-association
mirrors (GHSA/NCHSAA/UHSAA) and the directly-read official stat-sheet PDF + field-spec page.
