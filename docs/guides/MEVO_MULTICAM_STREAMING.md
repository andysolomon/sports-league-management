# Multi-Camera Game Streaming with Mevo (WSM-000202)

> **#303 track 4 — the "cheap path" decision, made real.** Multi-camera
> coverage does **not** require any new app infrastructure: Logitech's Mevo
> Studio app mixes all camera angles **on the coach's phone** and sends **one**
> combined feed — and one feed is exactly what both of our streaming paths
> already ingest. This guide documents the setup and records the decision to
> defer true in-app angle switching.

_Facts below verified against Mevo's current product pages and help center,
July 2026 (the app formerly called **Mevo Multicam** is now **Mevo Studio**,
iOS & Android)._

## How Mevo multi-cam works (and why we need zero code)

```
  Mevo cam #1 (wide)  ─┐
  Mevo cam #2 (endzone)─┤   Mevo Studio app          ONE program feed
  Mevo cam #3 (bench) ─┘   (mixes + switches   ───►  YouTube  ── or ──►  Custom RTMP
                            on the phone)             (path A)           (path B, Mux)
```

- **Cameras:** Mevo Core and Mevo Start (legacy Mevo Plus also works; Mevo Go
  requires the Pro subscription). All cameras join the phone over the same
  Wi-Fi network (Ethernet also supported on Core).
- **Switching happens in the app** — tap any camera to cut to it, or enable
  **Auto-Director** and the app switches angles automatically (manual taps
  override it; it resumes when you stop). The viewer sees whatever the app has
  live — a produced, single-feed broadcast.
- **Camera count:** no hard cap in the app, but the phone does all the
  encoding — Mevo's own guidance is to **test carefully beyond 3 cameras**.
  Three angles (wide / endzone / bench) is the sweet spot for a football game.
- **Output:** one stream to YouTube, Facebook, Twitch, etc. — or any **custom
  RTMP destination** (Stream URL + Stream Key).

Because the app collapses N cameras into one feed *before* anything reaches
us, both of our streaming paths below consume it unchanged.

## Path A — YouTube (works in the product today)

This is the free path coaches already use via **Go live** on the schedule page
(WSM-000180). Multi-cam changes nothing about our side:

1. In Mevo Studio, add your cameras, then choose **YouTube** as the streaming
   destination and start an **Unlisted** broadcast (recommended for student
   athletes).
2. Go live in the app. Switch angles by tapping cameras, or turn on
   Auto-Director.
3. In the dashboard → league → **Schedule**, click **Go live** on the game and
   paste the YouTube watch/live link. The multi-cam broadcast plays on the
   public game page; the same link serves as the replay after the game.

## Path B — Custom RTMP into Mux (backend-ready, UI dark)

The Mux path (WSM-000144) ingests standard RTMPS: `startGameStream` creates
the stream and returns `rtmps://global-live.mux.com:443/app` plus a per-stream
key, in-memory to the starting admin only. Mux's ingest accepts any standard
RTMP encoder, and Mevo Studio's **Custom RTMP** destination is exactly that —
enter the RTMP URL as the Stream URL and the key as the Stream Key.

Note: the current Go-live dialog only exposes the YouTube path; the Mux path
is retained in `stream-actions.ts` behind the dark `live_streaming_v1` flag
for a future paid tier. When that UI ships, Mevo multi-cam will work through
it with no changes — same single-feed contract.

Everything downstream is unchanged either way: the 3-hour auto-stop, the
per-league concurrent-stream cap, VOD replay (WSM-000198), and highlight clips
(WSM-000201) all operate on the stream, not the cameras behind it.

## Decision record: true in-app angle switching is deferred

The alternative — N simultaneous ingests per game plus a viewer-side angle
switcher — was scoped in #303 as **XL**: per-angle stream rows, N× Mux ingest
cost per game, player UI, and sync between angles. Per the ticket's
recommendation it is **deferred indefinitely**; the Mevo path delivers the
user-visible outcome (produced multi-angle broadcasts) at zero marginal
platform cost. Revisit only if validation surfaces explicit demand for
*viewer-controlled* angles.

## Sources

- [Mevo Studio app — official product page](https://mevo.com/pages/multi-camera-app)
  (cameras, destinations incl. RTMP, Auto-Director, wireless/Ethernet)
- [Mevo Multicam: How many cameras can I use?](https://help.mevo.com/hc/en-us/articles/5315987742996-Mevo-Multicam-How-many-cameras-can-I-use)
  (no hard cap; >3 cameras depends on the phone — test first)
- [Multicam: Stream to Multiple Destinations](https://help.mevo.com/hc/en-us/articles/4403324072596-Multicam-Stream-to-Multiple-Destinations)
  (custom RTMP destination = Stream URL + Stream Key)
- Design context: `docs/design/live-streaming-rfc.md` §4 (camera → ingest) and
  §6 (phasing).
