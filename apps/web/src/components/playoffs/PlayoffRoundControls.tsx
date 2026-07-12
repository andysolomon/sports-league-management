"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dices, FastForward, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import {
  advancePlayoffRoundAction,
  simulateChampionshipAction,
  simulatePlayoffsAction,
} from "@/app/dashboard/leagues/[id]/schedule/actions";
import {
  isChampionshipRound,
  minimumUnresolvedRound,
  roundLabel,
  supportsBulkPlayoffOps,
} from "@/lib/playoffs";
import type { PlayoffBracketDto } from "@/lib/data-api";

export default function PlayoffRoundControls({
  leagueId,
  seasonId,
  bracket,
  canManage,
}: {
  leagueId: string;
  seasonId: string;
  bracket: PlayoffBracketDto;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "advance" | "simPlayoffs" | "championship" | null
  >(null);

  if (!canManage || !supportsBulkPlayoffOps(bracket.format)) {
    return null;
  }

  const currentRound = minimumUnresolvedRound(
    bracket.matchups,
    bracket.rounds,
  );
  const atChampionship =
    currentRound !== null &&
    isChampionshipRound(currentRound, bracket.rounds);
  const currentLabel =
    currentRound !== null
      ? roundLabel(currentRound, bracket.rounds)
      : null;

  function openConfirm(action: "advance" | "simPlayoffs" | "championship") {
    setConfirmAction(action);
    setConfirmOpen(true);
  }

  function runAdvance() {
    start(async () => {
      const res = await advancePlayoffRoundAction({ leagueId, seasonId });
      if (res.ok) {
        toast.success(
          res.simulated === 0
            ? "No unplayed games in the current round."
            : `Simulated ${res.simulated} game${res.simulated === 1 ? "" : "s"} in ${currentLabel ?? "this round"}.`,
        );
        router.refresh();
        setConfirmOpen(false);
      } else {
        toast.error(playoffOpError(res.error));
      }
    });
  }

  function runSimPlayoffs() {
    start(async () => {
      const res = await simulatePlayoffsAction({ leagueId, seasonId });
      if (res.ok) {
        toast.success(
          res.champion
            ? `${res.champion} wins — simulated ${res.playoffGames} playoff game${res.playoffGames === 1 ? "" : "s"}`
            : res.playoffGames > 0
              ? `Simulated ${res.playoffGames} playoff game${res.playoffGames === 1 ? "" : "s"} through the semifinals.`
              : "No unplayed playoff games through the semifinals.",
        );
        router.refresh();
        setConfirmOpen(false);
      } else {
        toast.error(playoffOpError(res.error));
      }
    });
  }

  function runChampionship() {
    start(async () => {
      const res = await simulateChampionshipAction({ leagueId, seasonId });
      if (res.ok) {
        toast.success(
          res.champion
            ? `${res.champion} wins the championship!`
            : res.simulated > 0
              ? "Championship game simulated."
              : "No championship game to simulate.",
        );
        router.refresh();
        setConfirmOpen(false);
      } else {
        toast.error(playoffOpError(res.error));
      }
    });
  }

  const confirmCopy =
    confirmAction === "advance"
      ? {
          title: `Advance ${currentLabel ?? "current round"}?`,
          description: `Simulate every unplayed game in ${currentLabel ?? "the current round"}? Later rounds are left untouched.`,
          onConfirm: runAdvance,
        }
      : confirmAction === "simPlayoffs"
        ? {
            title: "Simulate playoffs?",
            description:
              "Simulate every unplayed playoff game through the semifinals? The championship stays unresolved until you simulate it explicitly.",
            onConfirm: runSimPlayoffs,
          }
        : confirmAction === "championship"
          ? {
              title: "Simulate championship?",
              description:
                "Simulate the final matchup to crown a champion? This is the only bulk action that completes the bracket.",
              onConfirm: runChampionship,
            }
          : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {currentRound !== null && !atChampionship ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => openConfirm("advance")}
            className="gap-1.5"
          >
            <FastForward className="h-4 w-4" />
            {pending ? "Simulating…" : `Advance ${currentLabel}`}
          </Button>
        ) : null}
        {currentRound !== null && !atChampionship ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => openConfirm("simPlayoffs")}
            className="gap-1.5"
          >
            <Dices className="h-4 w-4" />
            {pending ? "Simulating…" : "Sim playoffs"}
          </Button>
        ) : null}
        {atChampionship ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => openConfirm("championship")}
            className="gap-1.5"
          >
            <Trophy className="h-4 w-4" />
            {pending ? "Simulating…" : "Sim championship"}
          </Button>
        ) : null}
      </div>
      {confirmCopy ? (
        <ActionConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setConfirmAction(null);
          }}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel="Simulate"
          pending={pending}
          onConfirm={confirmCopy.onConfirm}
        />
      ) : null}
    </>
  );
}

function playoffOpError(error: string): string {
  switch (error) {
    case "unsupported_format":
      return "Bulk playoff simulation is not available for double elimination.";
    case "championship_requires_explicit_sim":
      return "Use Sim championship to play the final.";
    case "no_championship_fixture":
      return "The championship matchup is not ready yet.";
    case "no_playoffs":
      return "No playoff bracket found.";
    case "not_authorized":
      return "Only league admins/coaches can simulate playoff games.";
    default:
      return error;
  }
}
