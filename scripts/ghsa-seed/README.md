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

`city` and `stadium` are required by the schema. All 416 schools now carry a
real `city` (see "Cities" below); `stadium` is still seeded as a `TBD`
placeholder the coach corrects when they **claim** the team (claim support
already exists: `claimable` / `ownerOrgId`, WSM-000109).

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

### Dashboard "Seed GHSA" button

The web app's `/dashboard/import` page has a **Seed GHSA football (413 teams)**
button that loads a prebuilt copy of this payload into the normal import
preview, so an admin can seed without the CLI. That copy lives at
`apps/web/public/seed/ghsa-2024-26.json` — regenerate it after editing the
alignment data with:

```bash
node scripts/ghsa-seed/build-import.mjs --out ../../apps/web/public/seed/ghsa-2024-26.json
```

## Data provenance

`data/ghsa-2024-26.json` is generated from the **GHSA 2025 football
standings / region alignment** — the *football-specific* regions as actually
competed, all 7 classifications (6A, 5A, 4A, 3A, 2A, A Division I, A Division
II): **56 regions, 413 schools**.

Source of record (football regions):
<https://www.ghsa.net/2025-ghsa-football-standings>

Local copies of the GHSA source PDFs live in [`docs/ghsa/`](../../docs/ghsa/).

> ℹ️ The 2024-26 cycle has two football seasons. This file now holds the
> **2025-season** alignment (refreshed from the 2024-season alignment, which had
> 416 schools). Net change: 3 programs left football (`St. Francis`,
> `Baker County`, `Spring Creek`) and `Hebron Christian Academy` is listed as
> `Hebron Christian`; persisting schools kept their curated names and cities.

### How this was verified (and why 416, not 457)

The data was first drafted from a news article, then reconciled against two
official GHSA documents:

1. **Enrollment reclassification PDF** (`GHSA_Reclassification_2024-26.pdf`) —
   parsed to **457 schools**, matching GHSA's published total. This is the
   *all-sports, enrollment-based* class list and is **organized by class, not by
   football region**, so it's authoritative for **school names/existence** but
   cannot validate regions.
2. **Football standings** — the *football* region alignment. The data file is
   generated directly from this (currently the **2025** standings; first built
   from 2024).

Reconciling the two explains the count: the football alignment (**413** for 2025,
416 for 2024) excludes
the **~44 schools that don't field varsity football** (e.g. Savannah Arts
Academy, Davidson Fine Arts, Georgia Academy for the Blind, Woody Gap,
Taliaferro County) plus a stray non-existent entry (`Genesis Innovation`), which
the article data had wrongly included. Football-class membership also differs
from the enrollment class (e.g. Effingham County and Alexander play **5A** in
football though larger by enrollment; Innovation Academy is not in 6A football).

Name fixes carried over from the reconciliation: `Tucker Sub`→`Tucker`,
`Walton Grove`→`Walnut Grove`, and the mangled `Carroll Griffin` resolved into
two real schools (`Central-Carroll` + `Griffin`). `Spring Creek` (A-DII) was in
the 2024 football alignment but is **not** in 2025 (one of the three programs
that left football for the 2025 season).

## Extending

1. **Next cycle (2026-28)** — when GHSA publishes the new reclassification,
   regenerate from that season's football standings (same shape). Within the
   current 2024-26 cycle, re-run against the latest standings to pick up moves.
2. **Cities** — all 413 schools have a `city`, enriched from public sources
   (Wikipedia / MaxPreps / school sites), resolved to the municipality (not the
   county). Edit a school's `"city"` to correct any.
3. **Other states** — the alignment JSON is association-agnostic; point `--in`
   at e.g. a CIF/FHSAA file with the same shape to seed another state.

## Open product questions (not blocking the prototype)

- **HS schema fields** — `grade` (9–12) and `squad` (Varsity/JV/Freshman) aren't
  in the player model yet; needed before rosters import cleanly.
- **Stadium placeholder** — `TBD` satisfies the schema today; consider making
  `stadium` optional for seed-only teams instead of a placeholder.
- **Re-seeding** — `bulkImportLeague` upserts; confirm a second run updates
  rather than duplicates when the next reclassification cycle lands.
