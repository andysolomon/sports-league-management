"use client";

import MuxPlayer from "@mux/mux-player-react";

/*
 * Public HLS player for a game's live stream / replay (WSM-000144). Takes only
 * the public Mux playback id — no key, no live-stream id ever reaches here.
 * While live, the live-stream playback id streams the live edge; once ended it
 * serves the recorded replay (streamType "on-demand").
 */
export interface GameStreamPlayerProps {
  playbackId: string;
  live: boolean;
  title: string;
}

export default function GameStreamPlayer({
  playbackId,
  live,
  title,
}: GameStreamPlayerProps) {
  return (
    <MuxPlayer
      streamType={live ? "live" : "on-demand"}
      playbackId={playbackId}
      metadata={{ video_title: title }}
      accentColor="#dc2626"
      className="aspect-video w-full overflow-hidden rounded-md"
    />
  );
}
