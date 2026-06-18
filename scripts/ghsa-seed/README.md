# GHSA school/region seed importer (prototype)

Pre-seeds **empty, claimable teams** for every GHSA school, grouped by region, so
coaches and fans have a team to find and claim instead of starting from a blank
slate. No rosters are scraped from anyone — players are added by coaches
afterward via the existing CSV/JSON import or by claiming a team.

## How it maps to the data model

The import contract (`@sports-management/api-contracts` → `LeagueImportSchema`)
is flat: **League → Division → Team**. GHSA has two levels above the team
(Classification → Region → School), so we flatten the top two into the division
name:

| GHSA              | sprtsmng import       | example                         |
| ----------------- | --------------------- | ------------------------------- |
| Association       | `league.name`         | `Georgia GHSA Football (2024-26)` |
| Class + Region    | `division.name`       | `Region 1-6A`                   |
| School            | `team.name` (+ city)  | `Valdosta` / `Valdosta`         |
| —                 | `players: []`         | (empty — seeded later)          |

`city` and `stadium` are required by the schema. Schools without a known city
get a `TBD` placeholder the coach corrects when they **claim** the team
(claim support already exists: `claimable` / `ownerOrgId`, WSM-000109).

## Run

```bash
# Dry run — writes out/ghsa-import.json (no network)
node scripts/ghsa-seed/build-import.mjs

# Then either upload out/ghsa-import.json at /dashboard/import,
# or POST it directly (Clerk API key):
node scripts/ghsa-seed/build-import.mjs --post http://localhost:3000 --key sk_...
```

Flags: `--in <path>` (alignment source), `--out <path>` (payload), `--post <baseUrl>`,
`--key <clerkApiKey>`.

## Data provenance

`data/ghsa-2024-26.json` is generated from the **GHSA 2024 football
standings / region alignment** — the *football-specific* regions as actually
competed, all 7 classifications (6A, 5A, 4A, 3A, 2A, A Division I, A Division
II): **56 regions, 416 schools**.

Source of record (football regions):
<https://www.ghsa.net/2024-ghsa-football-standings>

Local copies of the GHSA source PDFs live in [`docs/ghsa/`](../../docs/ghsa/).

> ℹ️ The 2024-26 cycle has two football seasons; this is the **2024-season**
> alignment. The 2025 season may shift a few schools within the same cycle.

### How this was verified (and why 416, not 457)

The data was first drafted from a news article, then reconciled against two
official GHSA documents:

1. **Enrollment reclassification PDF** (`GHSA_Reclassification_2024-26.pdf`) —
   parsed to **457 schools**, matching GHSA's published total. This is the
   *all-sports, enrollment-based* class list and is **organized by class, not by
   football region**, so it's authoritative for **school names/existence** but
   cannot validate regions.
2. **2024 football standings** — the *football* region alignment. The data file
   is now generated directly from this.

Reconciling the two explains the count: the football alignment (**416**) excludes
the **~44 schools that don't field varsity football** (e.g. Savannah Arts
Academy, Davidson Fine Arts, Georgia Academy for the Blind, Woody Gap,
Taliaferro County) plus a stray non-existent entry (`Genesis Innovation`), which
the article data had wrongly included. Football-class membership also differs
from the enrollment class (e.g. Effingham County and Alexander play **5A** in
football though larger by enrollment; Innovation Academy is not in 6A football).

Name fixes carried over from the reconciliation: `Tucker Sub`→`Tucker`,
`Walton Grove`→`Walnut Grove`, and the mangled `Carroll Griffin` resolved into
two real schools (`Central-Carroll` + `Griffin`). `Spring Creek` (A-DII) — flagged
earlier — is **confirmed** in the official football alignment.

## Extending

1. **2025-season refresh** — regenerate from the 2025 football standings when
   seeding for the 2025 season (same shape, a few schools move).
2. **Cities** — add `"city"` to a school entry to override the `TBD` placeholder.
   74 are filled in; the rest are a separate enrichment pass.
3. **Other states** — the alignment JSON is association-agnostic; point `--in`
   at e.g. a CIF/FHSAA file with the same shape to seed another state.

## Open product questions (not blocking the prototype)

- **HS schema fields** — `grade` (9–12) and `squad` (Varsity/JV/Freshman) aren't
  in the player model yet; needed before rosters import cleanly.
- **Stadium placeholder** — `TBD` satisfies the schema today; consider making
  `stadium` optional for seed-only teams instead of a placeholder.
- **Re-seeding** — `bulkImportLeague` upserts; confirm a second run updates
  rather than duplicates when the next reclassification cycle lands.
