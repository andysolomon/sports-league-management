"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radio, Square, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  startGameStream,
  stopGameStream,
} from "@/app/dashboard/leagues/[id]/schedule/stream-actions";

export interface GoLiveControlProps {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Current stream status from getStreamByFixture, or null if none exists. */
  status: "idle" | "active" | "ended" | null;
}

interface Credentials {
  rtmpUrl: string;
  streamKey: string;
}

export default function GoLiveControl({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
  status,
}: GoLiveControlProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The stream key is returned ONCE by startGameStream and never re-readable —
  // hold it in local state to show the coach; it's gone on refresh.
  const [creds, setCreds] = useState<Credentials | null>(null);

  const isLive = status === "active";

  function goLive() {
    startTransition(async () => {
      const res = await startGameStream(leagueId, fixtureId);
      if (res.ok) {
        setCreds({ rtmpUrl: res.rtmpUrl, streamKey: res.streamKey });
        toast.success("Live stream ready — paste the camera settings below.");
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  function stop() {
    if (!window.confirm(`Stop the live stream for ${homeTeamName} vs ${awayTeamName}?`)) {
      return;
    }
    startTransition(async () => {
      const res = await stopGameStream(leagueId, fixtureId);
      if (res.ok) {
        toast.success("Live stream stopped.");
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
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
            onClick={stop}
            aria-label={`Stop live stream for ${homeTeamName} vs ${awayTeamName}`}
          >
            <Square className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={goLive}
          aria-label={`Go live for ${homeTeamName} vs ${awayTeamName}`}
        >
          <Radio className="mr-1 h-4 w-4" /> Go live
        </Button>
      )}

      <Dialog open={creds !== null} onOpenChange={(open) => !open && setCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Camera settings</DialogTitle>
            <DialogDescription>
              Paste these into your camera or encoder&apos;s &ldquo;Custom
              RTMP&rdquo; settings (Mevo, OBS, etc.). The stream key is shown
              once — copy it now.
            </DialogDescription>
          </DialogHeader>
          {creds ? (
            <div className="space-y-3">
              <CredentialRow
                label="RTMP URL"
                value={creds.rtmpUrl}
                onCopy={() => copy(creds.rtmpUrl, "RTMP URL")}
              />
              <CredentialRow
                label="Stream key"
                value={creds.streamKey}
                secret
                onCopy={() => copy(creds.streamKey, "Stream key")}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CredentialRow({
  label,
  value,
  secret,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
          {secret ? "•".repeat(Math.min(value.length, 32)) : value}
        </code>
        <Button size="sm" variant="outline" onClick={onCopy} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
    case "fixture_not_found":
    case "fixture_not_in_league":
      return "Game not found.";
    case "stream_not_found":
      return "No live stream to stop.";
    default:
      return error;
  }
}
