"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dices, Wand2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  simulateGameAction,
  simulateSeasonAction,
  simulateSeasonThroughChampionAction,
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

export function SimulateChampionButton({
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
        "Simulate the rest of the season AND the playoffs to crown a champion? This generates a fresh bracket from the season's playoff settings and fills every remaining game. Already-recorded regular-season games are kept.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await simulateSeasonThroughChampionAction({ leagueId, seasonId });
      if (res.ok) {
        const parts = [
          res.regularSimulated > 0
            ? `${res.regularSimulated} regular-season game${res.regularSimulated === 1 ? "" : "s"}`
            : null,
          res.playoffGames > 0
            ? `${res.playoffGames} playoff game${res.playoffGames === 1 ? "" : "s"}`
            : null,
        ].filter(Boolean);
        toast.success(
          res.champion
            ? `🏆 ${res.champion} wins! Simulated ${parts.join(" + ")}.`
            : parts.length > 0
              ? `Simulated ${parts.join(" + ")}.`
              : "Nothing left to simulate.",
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
      title="Simulate the rest of the season and the playoffs to crown a champion"
    >
      <Trophy className="mr-1 h-4 w-4" />
      {pending ? "Simulating…" : "Sim to champion"}
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
      if (error.includes("not_enough_teams")) {
        return "Not enough teams for the configured playoff bracket. Lower the playoff team count in season settings.";
      }
      if (error.includes("invalid_bracket_size")) {
        return "Playoff team count must be 4, 8, or 16 (set it in season settings).";
      }
      return error;
  }
}
