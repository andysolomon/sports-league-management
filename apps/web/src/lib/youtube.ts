/*
 * YouTube Live helpers (WSM-000180) — the free "paste a link" streaming path.
 *
 * A coach goes live on their own (unlisted) YouTube broadcast via YouTube
 * Studio / OBS, then pastes the watch/live URL into the game. We extract the
 * 11-character video id and embed the player; YouTube does the ingest,
 * transcode, delivery, and recording (the same URL becomes the replay). Pure +
 * dependency-free so it's unit-testable.
 */

// YouTube video ids are exactly 11 chars from this alphabet.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract a YouTube video id from a pasted URL or a raw id. Handles the common
 * shapes: watch?v=, youtu.be/, /live/, /embed/, /shorts/, and a bare id.
 * Returns null if no valid id is found.
 */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare id pasted directly.
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const isYouTube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com";
  if (!isYouTube) return null;

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const vParam = url.searchParams.get("v");
  if (vParam && VIDEO_ID_RE.test(vParam)) return vParam;

  // youtube.com/{live,embed,shorts,v}/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const [kind, id] = segments;
    if (
      (kind === "live" || kind === "embed" || kind === "shorts" || kind === "v") &&
      VIDEO_ID_RE.test(id)
    ) {
      return id;
    }
  }

  return null;
}

/** Privacy-friendly embed URL for a video id (uses the no-cookie host). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
