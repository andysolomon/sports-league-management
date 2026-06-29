"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  startLiveGameAction,
  addLiveScoreAction,
  updateLiveStateAction,
  endLiveGameAction,
} from "@/app/dashboard/teams/[id]/games/[gameId]/live/actions";

interface LiveState {
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
}

interface LiveScoreboardProps {
  teamId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  initial: LiveState | null;
}

// Football scoring events the operator taps. Mirrors the points Convex accepts
// (lib/liveScore: 1,2,3,6,7,8) — common values surfaced as buttons.
const SCORE_BUTTONS: { label: string; points: number }[] = [
  { label: "TD +6", points: 6 },
  { label: "FG +3", points: 3 },
  { label: "Safety +2", points: 2 },
  { label: "XP +1", points: 1 },
  { label: "2-pt +2", points: 2 },
];

export default function LiveScoreboard({
  teamId,
  fixtureId,
  homeTeamName,
  awayTeamName,
  initial,
}: LiveScoreboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<LiveState | null>(initial);
  const [clockDraft, setClockDraft] = useState(initial?.clock ?? "");

  const isFinal = state?.status === "final";
  const isHalftime = state?.status === "halftime";

  function run(fn: () => Promise<{ ok: true; state: LiveState } | { ok: false; error: string }>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setState(res.state);
        setClockDraft(res.state.clock ?? "");
        if (success) toast.success(success);
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  function start() {
    run(() => startLiveGameAction({ teamId, fixtureId }), "Game started");
  }

  function score(team: "home" | "away", points: number) {
    run(() => addLiveScoreAction({ teamId, fixtureId, team, points }));
  }

  function patch(p: { period?: number; clock?: string | null; status?: string }) {
    run(() => updateLiveStateAction({ teamId, fixtureId, patch: p }));
  }

  function end() {
    if (!window.confirm("End the game? This records the final score and can't be undone here."))
      return;
    run(() => endLiveGameAction({ teamId, fixtureId }), "Game ended — final recorded");
  }

  // Pre-kickoff: nothing live yet.
  if (!state) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No live game yet. Start it when the game kicks off — fans will see the
            score update live.
          </p>
          <Button type="button" disabled={pending} onClick={start}>
            <Play className="mr-1.5 h-4 w-4" />
            {pending ? "Starting…" : "Start live game"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-around gap-4 text-center">
            <ScoreCol name={homeTeamName} score={state.homeScore} />
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {state.status === "in_progress" ? (
                <Badge variant="success" className="gap-1.5">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
                  Live
                </Badge>
              ) : (
                <div className="font-semibold text-foreground">
                  {statusLabel(state.status)}
                </div>
              )}
              <div className="mt-1">Period {state.period}</div>
              {state.clock ? (
                <div className="mt-1 font-mono tabular-nums">{state.clock}</div>
              ) : null}
            </div>
            <ScoreCol name={awayTeamName} score={state.awayScore} />
          </div>
        </CardContent>
      </Card>

      {!isFinal && (
        <>
          {/* Per-team scoring */}
          <div className="grid grid-cols-2 gap-3">
            <TeamScorePad
              name={homeTeamName}
              disabled={pending}
              onScore={(pts) => score("home", pts)}
            />
            <TeamScorePad
              name={awayTeamName}
              disabled={pending}
              onScore={(pts) => score("away", pts)}
            />
          </div>

          {/* Game controls */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 py-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => patch({ period: state.period + 1 })}
              >
                Next period
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  patch({ status: isHalftime ? "in_progress" : "halftime" })
                }
              >
                <Flag className="mr-1 h-4 w-4" />
                {isHalftime ? "Resume" : "Halftime"}
              </Button>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12:00"
                  value={clockDraft}
                  onChange={(e) => setClockDraft(e.target.value)}
                  className="h-9 w-20 rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-primary"
                  aria-label="Game clock"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => patch({ clock: clockDraft.trim() || null })}
                >
                  Set clock
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={end}
                className="ml-auto text-destructive hover:text-destructive"
              >
                <Square className="mr-1 h-4 w-4" /> End game
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {isFinal && (
        <p className="text-center text-sm text-muted-foreground">
          Final score recorded. This game is closed.
        </p>
      )}
    </div>
  );
}

function ScoreCol({ name, score }: { name: string; score: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium text-muted-foreground">
        {name}
      </div>
      <div className="font-mono text-5xl font-bold tabular-nums text-foreground">
        {score}
      </div>
    </div>
  );
}

function TeamScorePad({
  name,
  disabled,
  onScore,
}: {
  name: string;
  disabled: boolean;
  onScore: (points: number) => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-2 truncate text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {name}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SCORE_BUTTONS.map((b) => (
            <Button
              key={b.label}
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onScore(b.points)}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "Live";
    case "halftime":
      return "Halftime";
    case "final":
      return "Final";
    default:
      return status;
  }
}

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Live scoring isn't enabled yet.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "Only a coach or admin of this team can run the scoreboard.";
    case "team_not_in_fixture":
    case "fixture_not_found":
      return "Game not found.";
    case "invalid_points":
      return "That isn't a valid score value.";
    default:
      return error;
  }
}
