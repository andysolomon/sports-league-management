"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import {
  startYoutubeStream,
  stopGameStream,
} from "@/app/dashboard/leagues/[id]/schedule/stream-actions";

/*
 * Go-live control (WSM-000180) — free YouTube path. The coach starts a (best:
 * unlisted) live broadcast on their own YouTube via YouTube Studio / OBS, then
 * pastes the watch/live link here. We embed it on the public game page;
 * YouTube does the ingest, delivery, and recording. No RTMP key touches our
 * app. (The paid Mux RTMP path remains in stream-actions for a future upgrade.)
 */
export interface GoLiveControlProps {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Current stream status from getStreamByFixture, or null if none exists. */
  status: "idle" | "active" | "ended" | null;
  /** Fixture status — a finished/cancelled game can't start a new stream. */
  gameStatus?: string;
}

export default function GoLiveControl({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
  status,
  gameStatus,
}: GoLiveControlProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [url, setUrl] = useState("");

  const isLive = status === "active";
  // A game that's over (or cancelled) can't go live. We still show the LIVE +
  // Stop control if a stream is somehow active, so it can always be stopped.
  const gameOver = gameStatus === "final" || gameStatus === "cancelled";

  function start() {
    const value = url.trim();
    if (!value) {
      toast.error("Paste your YouTube live link first.");
      return;
    }
    startTransition(async () => {
      const res = await startYoutubeStream(leagueId, fixtureId, value);
      if (res.ok) {
        toast.success("Live — your YouTube stream is now on the game page.");
        setUrl("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  function stop() {
    startTransition(async () => {
      const res = await stopGameStream(leagueId, fixtureId);
      if (res.ok) {
        toast.success("Live stream stopped — the recording stays on the game page.");
        router.refresh();
        setStopConfirmOpen(false);
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  return (
    <>
      {isLive ? (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            <Radio className="h-3 w-3" /> LIVE
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setStopConfirmOpen(true)}
            aria-label={`Stop live stream for ${homeTeamName} vs ${awayTeamName}`}
          >
            <Square className="h-4 w-4 text-destructive" />
          </Button>
          <ActionConfirmDialog
            open={stopConfirmOpen}
            onOpenChange={setStopConfirmOpen}
            title="Stop live stream?"
            description={`Stop the live stream for ${homeTeamName} vs ${awayTeamName}?`}
            confirmLabel="Stop stream"
            destructive
            pending={pending}
            onConfirm={stop}
          />
        </div>
      ) : gameOver ? null : (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(true)}
          aria-label={`Go live for ${homeTeamName} vs ${awayTeamName}`}
        >
          <Radio className="mr-1 h-4 w-4" /> Go live
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Go live with YouTube</DialogTitle>
            <DialogDescription>
              Start your live broadcast on YouTube (we recommend{" "}
              <strong>Unlisted</strong> for student athletes), then paste its
              link below. It&apos;ll play right here on the game page, and the
              recording stays available afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="yt-url">YouTube live link</Label>
            <Input
              id="yt-url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") start();
              }}
            />
            <p className="text-caption-12 text-text-muted">
              Paste a watch, youtu.be, or /live link — we&apos;ll detect the
              video automatically.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={start} disabled={pending || !url.trim()}>
              {pending ? "Starting…" : "Start stream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Live streaming isn't enabled for this environment.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "Only an admin of one of the two teams can start a stream.";
    case "stream_cap_reached":
      return "This league already has the maximum number of live streams running.";
    case "invalid_youtube_url":
      return "That doesn't look like a YouTube link — paste the watch, youtu.be, or /live URL.";
    case "fixture_not_found":
    case "fixture_not_in_league":
      return "Game not found.";
    case "stream_not_found":
      return "No live stream to stop.";
    case "game_over":
      return "This game has ended — you can't start a live stream for it.";
    default:
      return error;
  }
}
