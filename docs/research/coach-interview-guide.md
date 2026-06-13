# Coach Interview Guide (WSM-000107)

_Goal: validate (or kill) the thesis in [coach-platform-competitive-teardown.md](./coach-platform-competitive-teardown.md)
before building the stat-keeping + MaxPreps-export keystone. **We're testing whether coaches
actually hate the MaxPreps workflow — not selling them ours.**_

## Ground rules (read before every call)

- **Ask about the past, not the future.** "Walk me through last Friday" beats "would you use
  X?" People lie about hypotheticals; they can't lie about what they actually did. (The Mom
  Test.)
- **Don't pitch.** If they ask what we're building, deflect ("still figuring that out — that's
  why I'm asking you"). A pitch contaminates the data.
- **Dig for the specific + emotional.** "That's annoying" → "tell me about the last time that
  happened." Real pain has a story, a workaround, and a curse word.
- **Shut up.** Let silence pull the next sentence out of them.
- **Chase commitment/currency at the end** — time, intros, money. Compliments are worthless.

## Who to talk to (Cobb County beachhead)

Target **8–10** of: HS head coaches, offensive/defensive coordinators, and **the person who
actually enters stats/maintains the roster** (often a coordinator, GA, team mom, or AD). The
stat-keeper is gold — they live the pain. Start from the 16 Cobb County schools already seeded.

## Warm-up (2 min)

1. What's your role with the team, and how long have you been doing it?
2. Walk me through a typical game week — Monday to Friday night. _(Listen for where tools enter.)_

## Block A — Current workflow & tools (the JTBD discovery)

3. What apps or tools do you actually open during a normal week? _(Don't prompt names. Let them
   list. Note order = priority.)_
4. **The depth chart** — where does it live right now? Walk me through how you updated it last
   week. _(Spreadsheet? Whiteboard? Paper? Who else can see/edit it?)_
5. After last Friday's game, what happened with the **stats** — who entered them, into what,
   and how long did it take? _(This is the keystone question. Get the literal play-by-play of
   the chore: who, when, from film or memory, how many minutes.)_

## Block B — The MaxPreps relationship (the pain)

6. Tell me about your last run-in with MaxPreps. What were you trying to do, and how'd it go?
   _(Let them volunteer the pain. Don't lead with "isn't it buggy?")_
7. If you stopped entering stats into MaxPreps tomorrow, what would actually happen? _(Tests how
   real the mandate is — playoff eligibility? AD pressure? recruiting exposure? nothing?)_
8. Have you ever used GameChanger, Hudl, or anything that's supposed to sync to MaxPreps? What
   broke, if anything? _(Probe the dual-roster / sync-failure pain specifically — but only if
   they raise the tool.)_

## Block C — Roster ownership & switching

9. If a tool already had your school's roster and depth chart loaded on day one, would that
   save you real time — or is roster setup not the part that hurts? _(Tests whether our GHSA
   seed + claim-team is a real wedge or a nice-to-have.)_
10. What would have to be true for you to move your roster/stats workflow somewhere new — and
    what would make that a non-starter? _(Listen for: must export to MaxPreps, must be free,
    must work on my phone on the sideline, my AD mandates X.)_

## Block D — Export format (technical, ask the stat-keeper or AD)

- When you (or a partner tool) get stats **into** MaxPreps, what's the exact path — typing it
  in, or uploading a file? If a file: **what format/columns**, and can you send me a sample?
- Does your state/GHSA require a specific stat submission, and by when after each game?

_(This nails the "exact MaxPreps import-file format" open question without scraping — coaches
have the real upload screens and sample files.)_

## Wrap (commitment + referral)

- Would you be up for trying an early version and telling me where it sucks? _(Time commitment
  = signal.)_
- Who else — especially whoever keeps your stats — should I talk to? _(Referral = signal.)_

## Capture (fill in per interview)

| Field | Notes |
| --- | --- |
| School / role | |
| Tools they actually use (in order) | |
| Where the depth chart lives | |
| Stat entry: who / when / how long / from film? | |
| MaxPreps pain (specific story) | |
| How real is the mandate? | |
| Sync/dual-roster pain (if raised) | |
| What would make them switch / non-starters | |
| MaxPreps import format (file? columns? sample?) | |
| Commitment given (time / intro / $) | |

## After ~8 interviews — decide

- **Pain confirmed + export is the unlock →** build the keystone (post-game box score →
  MaxPreps-format export) on the Hybrid fork model.
- **Pain is mild / mandate is weak / nobody would switch →** rethink the wedge before writing code.
- Record the verdict back in the teardown doc.
