"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Scissors, Trash2 } from "lucide-react";
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
import GameStreamPlayer from "@/components/games/GameStreamPlayer";
import { parseTimecode, formatTimecode } from "@/lib/timecode";
import {
  createClip,
  deleteClip,
  getClipsForAdmin,
  type ClientGameClip,
} from "@/app/dashboard/leagues/[id]/schedule/clip-actions";

/*
 * Highlight-clips control (WSM-000201, #303 track 3). Shown on a schedule row
 * once the game's Mux stream has a recording (the VOD asset lands ~10s into
 * the broadcast, so clipping works during AND after the game). The dialog
 * previews the recording, takes a start/end/label, and lists existing clips
 * with a shareable player.mux.com link per READY clip.
 */
export interface ClipsControlProps {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Public playback id of the recording — powers the in-dialog preview. */
  vodPlaybackId: string | null;
}

export default function ClipsControl({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
  vodPlaybackId,
}: ClipsControlProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [clips, setClips] = useState<ClientGameClip[] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [clipToDelete, setClipToDelete] = useState<ClientGameClip | null>(null);

  function loadClips() {
    startTransition(async () => {
      const res = await getClipsForAdmin(leagueId, fixtureId);
      if (res.ok) setClips(res.clips);
      else toast.error(errorLabel(res.error));
    });
  }

  function openDialog() {
    setOpen(true);
    if (clips === null) loadClips();
  }

  function create() {
    const startSec = parseTimecode(start);
    const endSec = parseTimecode(end);
    if (startSec === null || endSec === null || endSec <= startSec) {
      toast.error("Enter a valid start and end time (mm:ss), end after start.");
      return;
    }
    if (!label.trim()) {
      toast.error("Give the clip a short label first.");
      return;
    }
    startTransition(async () => {
      const res = await createClip(leagueId, fixtureId, {
        startSec,
        endSec,
        label,
      });
      if (res.ok) {
        toast.success(
          "Clip requested — it'll appear on the game page once Mux finishes cutting it.",
        );
        setStart("");
        setEnd("");
        setLabel("");
        loadClips();
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  function remove() {
    if (!clipToDelete) return;
    const clip = clipToDelete;
    startTransition(async () => {
      const res = await deleteClip(leagueId, fixtureId, clip.id);
      if (res.ok) {
        toast.success("Clip deleted.");
        loadClips();
        router.refresh();
        setClipToDelete(null);
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  async function copyLink(clip: ClientGameClip) {
    if (!clip.playbackId) return;
    await navigator.clipboard.writeText(
      `https://player.mux.com/${clip.playbackId}`,
    );
    toast.success("Shareable clip link copied.");
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={openDialog}
        aria-label={`Manage clips for ${homeTeamName} vs ${awayTeamName}`}
      >
        <Scissors className="mr-1 h-4 w-4" /> Clips
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Highlight clips</DialogTitle>
            <DialogDescription>
              Cut shareable highlights from the {homeTeamName} vs{" "}
              {awayTeamName} recording. Scrub the preview to find your moment,
              then enter the start and end times.
            </DialogDescription>
          </DialogHeader>

          {vodPlaybackId ? (
            <GameStreamPlayer
              provider="mux"
              muxPlaybackId={vodPlaybackId}
              youtubeVideoId={null}
              live={false}
              title={`${homeTeamName} vs ${awayTeamName} — recording`}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="clip-start">Start (mm:ss)</Label>
              <Input
                id="clip-start"
                inputMode="numeric"
                placeholder="12:05"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="clip-end">End (mm:ss)</Label>
              <Input
                id="clip-end"
                inputMode="numeric"
                placeholder="12:35"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="clip-label">Label</Label>
            <Input
              id="clip-label"
              maxLength={80}
              placeholder="Game-winning touchdown"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">
              Clips{clips ? ` (${clips.length})` : ""}
            </p>
            {clips === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : clips.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clips yet — cut the first highlight above.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {clips.map((clip) => (
                  <li
                    key={clip.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {clip.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimecode(clip.startTime)} –{" "}
                        {formatTimecode(clip.endTime)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {clip.status === "ready" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(clip)}
                          aria-label={`Copy shareable link for ${clip.label}`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Badge
                          variant={
                            clip.status === "errored"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {clip.status === "errored" ? "Error" : "Preparing"}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setClipToDelete(clip)}
                        aria-label={`Delete clip ${clip.label}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Close
            </Button>
            <Button
              onClick={create}
              disabled={pending || !start.trim() || !end.trim() || !label.trim()}
            >
              {pending ? "Working…" : "Create clip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActionConfirmDialog
        open={clipToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setClipToDelete(null);
        }}
        title={clipToDelete ? `Delete clip “${clipToDelete.label}”?` : "Delete clip?"}
        description="This removes the clip permanently."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
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
      return "Only an admin of one of the two teams can manage clips.";
    case "invalid_clip_range":
      return "Clips must be 1 second to 10 minutes long, within the recording.";
    case "invalid_label":
      return "Give the clip a short label (up to 80 characters).";
    case "no_recording":
      return "No recording to clip yet — clips unlock once the stream has been live for a moment.";
    case "clip_cap_reached":
      return "This game already has the maximum number of clips.";
    case "clip_not_found":
      return "That clip no longer exists.";
    case "fixture_not_found":
    case "fixture_not_in_league":
      return "Game not found.";
    default:
      return error;
  }
}
