# Coach Platform — Competitive Teardown & PRD (WSM-000106)

_Research date: 2026-06-13. Goal: build a high-school football tool coaches **love** —
better than what MaxPreps gives them — and let the mandated reporting fall out as a
byproduct._

## TL;DR — the wedge

MaxPreps is a **mandated reporting chore** built for fans/recruiters/ad revenue, not for the
coach's day. The tool coaches actually love — **GameChanger** — **doesn't keep football
stats at all**, and no live-scoring tool survives contact with reality (a head coach can't
score a game while coaching it). The football coach's workflow is **fragmented** across 4–5
tools. That's the opening:

> A **football-first, mobile-first** platform that owns the coach's daily work — roster,
> depth chart, player development/ratings — plus **fast post-game stat entry** that **exports
> to MaxPreps** so the eligibility mandate is satisfied without re-entry.

We've already built the "daily work" half (roster, Madden-style depth charts, SPRT/Madden
ratings, mobile). The gap is **stat-keeping + export** and a **coach-owned (editable) league**.

## The landscape

| Product | What it's for | Coach relationship | Football fit |
| --- | --- | --- | --- |
| **MaxPreps** (CBS) | Public scores/rankings/recruiting; the **official** stat repo GHSA et al. mandate | Forced — submit roster + box scores for **playoff eligibility** | Reporting only; buggy, ad-heavy |
| **GameChanger** (DICK'S) | Team mgmt + live streaming + scorekeeping; free; 200k+ teams; **syncs to MaxPreps** | **Loved** (esp. baseball/softball) | **Stats "not yet available for football"** |
| **Hudl** | Film / video analysis (the film king); pricey | Valued for film | Film, not roster/stats; **MaxPreps sync died Jan 2025** |
| **GoRout / playbook & practice tools** | Playbooks, practice scripts, scouting/tendencies | Niche, per-task | Strong on Xs-and-Os, nothing on roster/reporting |
| **Spreadsheets** | Depth charts, call sheets | Universal fallback | The real "depth chart tool" most staffs use |

**Nobody owns the whole football coach.** Coaches stitch together MaxPreps (mandate) + Hudl
(film) + GameChanger (mgmt) + a playbook tool + spreadsheets.

## Pain points (sourced)

### MaxPreps
- **Buggy & slow** — web portal fails to load favorites; scorers report games "would not let
  them send updates"; calendar sync broken on iPhone. ([reviews](https://justuseapp.com/en/app/980665604/maxpreps/reviews), [PissedConsumer](https://maxpreps.pissedconsumer.com/reviews/RT-P.html))
- **Ad-heavy** — forced ~45-second pre-roll before each clip; "impossible to watch." ([App Store](https://apps.apple.com/us/app/maxpreps-high-school-sports/id980665604))
- **Stat entry is a known pain** — a dedicated "[Stat Entry Issues](https://support.maxpreps.com/hc/en-us/articles/360021077474-Stat-Entry-Issues)" article exists; they push "import from 80+ partners" / bulk season-to-date entry to **avoid their own game-by-game UI**.
- **Data integrity** — relies on parents/reporters to enter scores; "can lead to cheating or lying."
- **Claim/verify friction** — coach/AD admin access is a multi-step approval gauntlet (every state publishes a "how to grant coach access" PDF).
- **Fresh wound** — **Hudl→MaxPreps auto-sync ended Jan 1 2025**; now a manual export/import file. ([sync notice](https://support.maxpreps.com/hc/en-us/articles/5493128608283-MaxPreps-HUDL-Data-Sync))

### GameChanger
- **No football stats** — "Stats are not yet available for football." The loved tool has a hole exactly where the mandate lives. ([gc.com/football](https://gc.com/football))
- **Can't be run by the HC mid-game** — needs a dedicated volunteer on app + camera; "a head coach cannot use [it] while actually coaching." ([reviews](https://gamechanger.pissedconsumer.com/review.html))
- **Billing/cancel complaints**, premium-feature lockouts (2.0★ on PissedConsumer).

### The reality check that reframes the keystone
**Live football scoring is the wrong frame.** The HC is coaching; no app changes that.
The real job is **fast, accurate, single-operator post-game entry** (often from the film) —
which is exactly where MaxPreps is buggy and GameChanger is absent.

## Jobs-to-be-done — HS football coach

| JTBD | Today's tool | sprtsmng |
| --- | --- | --- |
| Keep my depth chart current (off/def/ST, injuries) | Spreadsheets | ✅ Madden-style depth charts |
| Evaluate & develop players (who's earning a start) | Gut / film | ✅ SPRT + Madden ratings, dev charts — **differentiator** |
| Enter game stats **once** → flows to MaxPreps for eligibility | MaxPreps (painful) / Hudl export | 🔨 **keystone gap** |
| Manage roster without a claim gauntlet | MaxPreps (friction) | ✅ fork/claim flow (Hybrid model) |
| Plan practice / scout opponents | GoRout / spreadsheets | 🔨 future |
| Communicate with team/parents | GameChanger | 🔨 future (GC's sticky hook) |

## Where sprtsmng stands

**Have ✅:** roster management · Madden-style depth charts (mobile touch) · SPRT + Madden
player ratings & development charts · mobile-first · public viewer (standings/schedules) ·
GHSA Cobb County seed · per-user subscriptions · à la carte import · (decided) Hybrid
fork-to-own model.

**Missing 🔨:**
1. **Football stat-keeping / box scores** — the keystone (the mandated function).
2. **MaxPreps-compatible export** — kills the switching cost.
3. **Team comms / announcements** — GameChanger's stickiness.
4. **Schedule / practice calendar.**
5. **Coach claim-team onboarding** (depends on the Hybrid fork model).

## Prioritized roadmap (PRD)

1. **Coach-owned league (Hybrid fork + claim)** — _prerequisite._ A coach claims their school
   → it forks to an org-owned, editable league; becomes their default active league.
   Fixes MaxPreps' data-integrity + claim-friction problems.
2. **Post-game box-score stat entry (football)** — _the keystone._ Fast, mobile,
   single-operator; designed for after-the-game (incl. from film), not live HC scoring.
   **Bonus:** feeds the SPRT engine from **real HS games**, turning our rating into
   something no competitor has at the HS level.
3. **MaxPreps-compatible export** — emit a stat file in MaxPreps' import format (they accept
   80+ partners) so coaches never double-enter. This is the switching-cost killer.
4. **Depth chart + development as the daily hub** — already built; polish for HS (OL/DL,
   special teams).
5. **Schedule/practice + team comms** — GameChanger-parity hooks once the core lands.

## Open questions → primary research to do

The above is desk research (MaxPreps/GameChanger docs, app reviews, coaching-software
roundups). Before committing the keystone build, validate with **primary** sources:
- 5–10 **coach interviews** (start with Cobb County contacts) — what makes them rage-quit
  MaxPreps; how they actually enter stats; who keeps the depth chart.
- Coaching forums / r/footballcoach / X for unfiltered sentiment.
- Confirm the **exact MaxPreps import file format** (the 80+-partner spec) so the export is real.
- Decide **film** stance: integrate/ignore Hudl (the dead sync is an opening, but film is capital-intensive).

## Sources
- MaxPreps support (Stat Entry Issues, Roster/Stat Management, HUDL sync) — support.maxpreps.com
- MaxPreps reviews — justuseapp, PissedConsumer, Apple App Store
- GameChanger — gc.com/football, gc.com/coaches, PissedConsumer reviews
- Coaching software landscape — GoRout, Catapult, USA Football Coach Planner
- GHSA / MaxPreps partnership — ghsa.net
