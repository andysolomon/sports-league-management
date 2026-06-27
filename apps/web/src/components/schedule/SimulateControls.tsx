"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dices, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  simulateGameAction,
  simulateSeasonAction,
} from "@/app/dashboard/leagues/[id]/schedule/actions";

/*
 * Simulation controls (WSM-000183) — fill plausible, ratings-weighted scores.
 * Per-game "Sim" sits next to Record result; "Simulate season" fills every
 * unplayed regular-season game at once. Both record normal results, so
 * standings update exactly as hand-entered scores do. Manager/admin only
 * (parent gates rendering).
 */

export function SimulateGameButton({
  leagueId,
  fixtureId,
  homeTeamName,
  awayTeamName,
}: {
  leagueId: string;
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await simulateGameAction({ leagueId, fixtureId });
      if (res.ok) {
        toast.success(
          `Simulated: ${homeTeamName} ${res.homeScore}–${res.awayScore} ${awayTeamName}.`,
        );
        router.refresh();
      } else {
        toast.error(simError(res.error));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={run}
      title="Simulate a score for this game (weighted by team ratings)"
      aria-label={`Simulate ${homeTeamName} vs ${awayTeamName}`}
    >
      <Dices className="mr-1 h-4 w-4" />
      {pending ? "Simulating…" : "Sim"}
    </Button>
  );
}

export function SimulateSeasonButton({
  leagueId,
  seasonId,
}: {
  leagueId: string;
  seasonId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (
      !window.confirm(
        "Simulate every unplayed regular-season game? Scores are generated from team ratings. Already-recorded games are left untouched.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await simulateSeasonAction({ leagueId, seasonId });
      if (res.ok) {
        toast.success(
          res.simulated === 0
            ? "No unplayed games to simulate."
            : `Simulated ${res.simulated} game${res.simulated === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } else {
        toast.error(simError(res.error));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={run}
      title="Fill every unplayed regular-season game with a ratings-weighted score"
    >
      <Wand2 className="mr-1 h-4 w-4" />
      {pending ? "Simulating…" : "Simulate season"}
    </Button>
  );
}

function simError(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Schedules feature is disabled.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "Only league admins/coaches can simulate games.";
    case "already_final":
      return "That game already has a result.";
    case "cancelled":
      return "That game is cancelled.";
    case "fixture_not_found":
      return "Game not found.";
    default:
      return error;
  }
}
