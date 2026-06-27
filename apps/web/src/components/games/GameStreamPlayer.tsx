"use client";

import MuxPlayer from "@mux/mux-player-react";
import { youtubeEmbedUrl } from "@/lib/youtube";

/*
 * Public player for a game's live stream / replay (WSM-000144, WSM-000180).
 * Provider-agnostic: "mux" plays the public HLS playback id (live edge while
 * live, recorded replay once ended); "youtube" embeds the public video id (the
 * same broadcast serves as the replay after it ends). No key or server-side id
 * ever reaches here.
 */
export interface GameStreamPlayerProps {
  provider: string; // "mux" | "youtube"
  muxPlaybackId: string | null;
  youtubeVideoId: string | null;
  live: boolean;
  title: string;
}

export default function GameStreamPlayer({
  provider,
  muxPlaybackId,
  youtubeVideoId,
  live,
  title,
}: GameStreamPlayerProps) {
  if (provider === "youtube") {
    if (!youtubeVideoId) return null;
    const src = `${youtubeEmbedUrl(youtubeVideoId)}?rel=0&playsinline=1${
      live ? "&autoplay=1" : ""
    }`;
    return (
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full overflow-hidden rounded-md border-0"
      />
    );
  }

  if (!muxPlaybackId) return null;
  return (
    <MuxPlayer
      streamType={live ? "live" : "on-demand"}
      playbackId={muxPlaybackId}
      metadata={{ video_title: title }}
      accentColor="#dc2626"
      className="aspect-video w-full overflow-hidden rounded-md"
    />
  );
}
