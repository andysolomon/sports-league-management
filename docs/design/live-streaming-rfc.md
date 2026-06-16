# RFC — Live Game Streaming + Live-Score Overlay (WSM-000108 / #225)

**Status:** Scope / design only — **do NOT build yet.** Gated on coach-interview
validation ([../research/coach-interview-guide.md](../research/coach-interview-guide.md)),
the same gate as the stat-keeping keystone.
**Target provider:** **Mux Video** (decision recorded 2026-06-15).
**Pairs with:** [../research/coach-platform-competitive-teardown.md](../research/coach-platform-competitive-teardown.md),
[../research/stat-keeping-keystone-prd.md](../research/stat-keeping-keystone-prd.md) (WSM-000112).

## 1. Goal

Match GameChanger's sticky hook: a coach points a camera (phone encoder, OBS, or a
Mevo via "Custom RTMP") at a game; it streams **in-app** with the **live score overlaid**;
families watch live on the public game page. Camera-agnostic BYO-RTMP — we do **not** build
video infrastructure, we orchestrate a managed provider (Mux).

## 2. Current-state findings (what exists today)

| Capability | State | Source |
|---|---|---|
| `fixtures` table (a game to attach a stream to) | ✅ exists | `convex/schema.ts:249` |
| `gameResults` | ⚠️ **final score only** (`homeScore`/`awayScore`, `recordedAt`) | `convex/schema.ts:269` |
| Live game-state (running score, clock, period, realtime) | ❌ **does not exist** | — |
| Public game viewer route (`/leagues/[id]/games/[gameId]`) | ❌ **does not exist** (only landing / standings / development) | `src/app/leagues/[id]/` |
| Streaming deps (Mux / HLS player) | ❌ none | `package.json` |
| Public-league guard + flag pattern to reuse | ✅ `publicLeagueGuard`, `pageGuard`/flags | `src/lib/public-league-guard.ts`, `src/lib/flags.ts` |
| Server-side admin-keyed Convex client + secret pattern | ✅ `getConvexClient()` + `internalMutation` | `src/lib/convex-client.ts` |

**Headline-value blocker:** the score overlay needs *live* score/clock state. We only store a
single post-game final score. Live in-game scoring is an explicit **v1 non-goal of the
stat-keeping keystone (WSM-000112), deferred to its v3** ("live entry"). So the overlay
(#225 Phase 2) is blocked on keystone v3 — far downstream. **Only the video-only MVP can ship
near-term**, and even it is behind the validation gate.

## 3. Dependency chain (for the headline "video + live score")

```
coach-interview validation (WSM-000106/107)
  ├─► [independent] Phase 1: video-only stream MVP (this RFC)
  └─► stat-keeping keystone v1 (post-game, WSM-000112)
        └─► keystone v3 (live entry / realtime game-state)
              └─► Phase 2: live-score overlay
```

## 4. Architecture (Mux)

**Per game = one Mux live stream.** Provider returns an **RTMP ingest URL + stream key** (shown
only to the team admin, server-side secret) and an **HLS playback id** (public). Fans watch via
`@mux/mux-player-react` on the public game page. The score overlay (Phase 2) is a **DOM layer**
over the player, fed by our own realtime game-state — cheaper and faster than server-side burn-in.

### Data model (new `gameStreams` table)
```
gameStreams: defineTable({
  fixtureId: v.id("fixtures"),
  muxLiveStreamId: v.string(),       // provider id (server-side)
  muxPlaybackId: v.string(),         // public HLS id
  status: v.string(),                // "idle" | "active" | "ended"
  vodAssetId: v.union(v.string(), v.null()), // recording, set on stream end
  startedBy: v.string(),
  startedAt: v.string(),
  endedAt: v.union(v.string(), v.null()),
  maxDurationMinutes: v.number(),    // auto-stop guardrail
}).index("by_fixtureId", ["fixtureId"])
```
The **stream key is never stored in a publicly-readable field** and never returned to a
non-owner — only surfaced to the starting admin via a dedicated server action.

### Control flow
1. **Start** — server action `startGameStream(fixtureId)`, auth-gated to team admins
   (reuse `canAdministerTeam`). Calls Mux create-live-stream (admin-keyed, server-side),
   writes `gameStreams`, returns `{ rtmpUrl, streamKey }` to the coach only.
2. **Camera** — coach pastes RTMP URL + key into Mevo "Custom RTMP" / OBS / phone encoder.
3. **Webhook** — `POST /api/streams/mux/webhook` (signature-verified) flips `status`
   active/ended and records `vodAssetId` on `video.asset.ready`.
4. **Watch** — public game page reads `muxPlaybackId` + `status`, renders Mux player + LIVE
   badge (or VOD / "stream ended").
5. **Overlay (Phase 2)** — DOM layer subscribes to live game-state (keystone v3) and updates
   on score/period change.

### Convex security
All write functions stay `internalMutation` (per WSM-000096); the webhook route and server
actions use the admin-keyed `getConvexClient()`. Stream key handling: server-side only.

## 5. Cost & guardrails (metered — the main risk)

Live transcode + delivery is **metered per-minute ingest + per-GB delivery**. Ballpark Mux
(≈ Jan 2026 — **verify current pricing before build**): live encoding ~\$0.04/min, delivery
~\$0.001/min·viewer. A 2.5 h game ≈ 150 min → ~\$6 encode + delivery × viewers. A league of
many concurrent games could run real money.

Guardrails (all ACs):
- **Auth to start** — team admins only.
- **Max duration + auto-stop** — hard cap (e.g. 3 h) closes the Mux stream automatically.
- **Per-org concurrent-stream cap** (optional) — bound blast radius.
- **Dark feature flag** `live_streaming_v1` (matches existing flag pattern) — ship dark,
  enable per-pilot-org.

## 6. Phasing → child issues

| Phase | Issue | Depends on | Size |
|---|---|---|---|
| Prereq: public game viewer route `/leagues/[id]/games/[gameId]` | WSM-000143 | — (independently useful) | M |
| Phase 1: video-only live stream MVP (Mux ingest + HLS viewer + LIVE badge + guardrails, dark flag) | WSM-000144 | 143 + validation gate | L |
| Phase 2: live-score overlay (DOM layer synced to live game-state) | WSM-000145 | 144 + keystone **v3** (WSM-000112) | M |
| Phase 3: polish — VOD replay UX, clips/highlights, multi-cam (Mevo Studio), low-latency mode | WSM-000146 | 144 | L |

## 7. Open questions (resolve at greenlight)

1. **Validation** — do coaches/parents actually want *in-app* streaming, or is the school's
   existing stream (Hudl/NFHS/YouTube) good enough? (Coach-interview gate.) If "good enough,"
   #225 may not be worth the spend at all.
2. **Pricing reality** — confirm current Mux live + delivery rates and model a per-league
   monthly ceiling; decide if cost is passed through (paid tier) or capped.
3. **Latency target** — standard HLS (~10–30 s) vs Mux low-latency (~5 s). Standard is fine
   for "follow along"; revisit only if validation shows otherwise.
4. **Auth on playback** — public (anyone with the league) vs signed playback URLs for
   private leagues. Phase 1 can mirror `publicLeagueGuard`.
