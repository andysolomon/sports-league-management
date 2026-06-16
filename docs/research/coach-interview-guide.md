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

## Block E — Game video & streaming (validation gate for #225)

_Ask this **last**, after the keystone blocks, and keep it light. Streaming is a shiny feature
everyone says "yes" to in the abstract — so **only past behavior counts here**. We are testing
whether the school's existing video is already "good enough," not whether video sounds nice.
Do **not** describe our streaming idea._

11. Was last Friday's game **recorded or streamed** at all? Walk me through what actually
    happened — who ran it, on what device/app, and who watched. _(If nothing: "When's the last
    time one of your games was on video for families, and what was that like?")_
12. When families can't make it to a game, how do they **follow along in real time** right now?
    _(Texts? Someone posting the score? A stream? Nothing? — this is the real job: follow-along.
    Don't prompt "would a stream help.")_
13. The last time a game was streamed — what **annoyed people or went wrong**? _(Listen for: no
    one to run the camera, couldn't tell the score from the video, paywall, buffering, bad
    angle. Real pain has a story.)_
14. Do families ever **pay** for anything to watch your games — NFHS Network, a booster stream,
    anything? Tell me about that. _(Past-behavior proxy for cost tolerance AND the "good enough"
    incumbent. NFHS Network mandates are the main kill-signal for #225.)_
15. When a game is on video, can viewers see the **live score on the screen**, or just the
    picture? Has anyone ever asked "what's the score" while watching? _(The overlay is our
    specific bet — test whether the score-on-video gap is felt, or nobody cares.)_
16. The times a game *has* been filmed/streamed — **who ended up running the camera**? _(The
    labor reality: managed streaming still needs a human to aim and start it. If the answer is
    "nobody reliably," that's a red flag regardless of demand.)_

_(Resolves RFC §7 open questions for `docs/design/live-streaming-rfc.md`: is in-app streaming
worth the metered spend, or is the school's existing stream good enough?)_

## Block F — Girls flag football (expansion-lane validation)

_Ask **flag-football coaches/stat-keepers** (a partly different audience — start with the Cobb
flag coaches in [flag-football-cobb-research.md](./flag-football-cobb-research.md): Kevin
Fraser/Pope, Jake Burgdorf/McEachern). **Blocks A–D apply directly** with flag framing — flag
coaches keep stats and have a MaxPreps relationship too — so run those first, then add these
flag-specific probes. Same rules: past behavior, no pitching. We're testing whether flag is a
**wider-open** version of the same wedge, not whether flag coaches like the idea of an app._

17. Walk me through what happened with **stats after your last flag game** — who kept them
    during the game, what did they write them on, and what happened to them afterward? _(The
    literal chore. Flag's box score is passing/rushing/receiving + **flag pulls / sacks / picks**
    on defense — listen for whether defense gets recorded at all or just gets lost.)_
18. What's riding on **MaxPreps** for your flag program — do you have to put anything in, and
    does your **playoff seeding / power ranking** actually depend on it? _(This is the key
    unknown from the research: is the MaxPreps mandate as real for flag as it is for tackle? If
    seeding rides on it, the "chore lever" is just as strong.)_
19. What did you actually **use to keep stats last season** — clipboard, spreadsheet, an app?
    Walk me through it. _(Don't prompt names. If they raise GameChanger/MaxPreps/a flag app:)_
    What did it do well, and **what didn't fit flag** — flag pulls, 7-on-7, no-run zones? _(Tests
    the "tackle-built tools break for flag" thesis from their real experience, not ours.)_
20. Your players getting **college flag interest** now — what stats or film do recruiters ask
    for, and how do you produce that today? _(Flag is an NCAA emerging sport + 2028 Olympic
    sport; recruiting may be a new stat-keeping driver unique to flag's growth. Real pain = "I
    cobble it together by hand.")_
21. _(Switching, adapt of Q10:)_ What would have to be true for you to keep your flag
    roster/stats somewhere new — and what would make it a **non-starter**? _(Listen for: must
    feed MaxPreps, must be free, must be flag-correct, must work on my phone on the sideline.)_

_(Resolves the open questions in `flag-football-cobb-research.md` §6: is the MaxPreps mandate
real for flag, what do flag coaches use today, is the flag-stat-model misfit a felt pain, and
is recruiting a stat-keeping driver?)_

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
| Game video today: streamed/recorded? by whom, what tool? | |
| How families follow along when absent | |
| Streaming pain (specific story) / "good enough" incumbent (NFHS/Hudl?) | |
| Pays to watch today? (NFHS Network / booster / none) | |
| Score-on-video gap felt? (asked "what's the score?") | |
| Who actually runs the camera | |
| _(flag coaches)_ Flag stat chore: who / on what / defense recorded? | |
| _(flag coaches)_ MaxPreps mandate real for flag? (seeding rides on it?) | |
| _(flag coaches)_ Tool used + what didn't fit flag (pulls/7v7/no-run) | |
| _(flag coaches)_ Recruiting as a stat driver? (college flag interest) | |
| Commitment given (time / intro / $) | |

## After ~8 interviews — decide

- **Pain confirmed + export is the unlock →** build the keystone (post-game box score →
  MaxPreps-format export) on the Hybrid fork model.
- **Pain is mild / mandate is weak / nobody would switch →** rethink the wedge before writing code.
- Record the verdict back in the teardown doc.

### Streaming gate (#225) — decide separately from the keystone

- **Build the video MVP (#301) →** games rarely get streamed today *or* the existing option is
  paywalled / score-less / unreliable, families clearly want to follow along, **and** there's a
  real person who would run the camera each week.
- **Defer or kill #225 →** the school already streams via NFHS Network / Hudl and it's "good
  enough," **or** nobody reliably runs a camera, **or** families don't actually watch. Don't
  commit metered video spend on an abstract "yes." Record the verdict in the streaming RFC.

### Flag-football expansion gate — decide separately

- **Pursue flag as an expansion lane →** flag coaches keep stats with the same (or worse)
  friction as tackle, the MaxPreps mandate/seeding is real for flag, **and** existing tools
  visibly misfit flag (pulls/7v7) or recruiting forces hand-cobbled stats. The wider incumbent
  gap (GameChanger unconfirmed for flag) makes this attractive.
- **Don't prioritize flag →** flag stat-keeping is casual/low-stakes, MaxPreps isn't required
  for flag seeding, or coaches are content with what they use. Record the verdict in
  `flag-football-cobb-research.md` §6.
