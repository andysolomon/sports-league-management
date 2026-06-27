"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Trash2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateTeamRosterAction,
  generateLeagueRostersAction,
  clearTeamSyntheticAction,
  clearLeagueSyntheticAction,
  generateTeamAttributesAction,
  generateLeagueAttributesAction,
} from "@/app/dashboard/_actions/synthetic-rosters";

/*
 * Generate or clear synthetic (fake) players for testing/demos (WSM-000173).
 * `team` acts on one team; `league` acts on every team (admin-only). Clear only
 * ever deletes generator-created players (flagged `synthetic`), never real
 * entries. Gated upstream by the syntheticRostersV1 flag + role (the parent
 * only renders this when allowed).
 */
interface SyntheticRosterButtonProps {
  kind: "team" | "league";
  id: string;
  action?: "generate" | "clear" | "attributes";
}

export function SyntheticRosterButton({
  kind,
  id,
  action = "generate",
}: SyntheticRosterButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (!window.confirm(CONFIRM[action][kind])) return;

    start(async () => {
      if (action === "attributes" && kind === "team") {
        const res = await generateTeamAttributesAction({ teamId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.rated === 0
            ? "No players to rate yet — generate a roster first."
            : `Generated ratings for ${res.rated} player${res.rated === 1 ? "" : "s"}.`,
        );
      } else if (action === "attributes") {
        const res = await generateLeagueAttributesAction({ leagueId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.rated === 0
            ? "No players to rate yet — generate rosters first."
            : `Generated ratings for ${res.rated} player${res.rated === 1 ? "" : "s"} across ${res.teams} team${res.teams === 1 ? "" : "s"}.`,
        );
      } else if (action === "generate" && kind === "team") {
        const res = await generateTeamRosterAction({ teamId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.created === 0
            ? "Roster already full — nothing to add."
            : `Added ${res.created} synthetic player${res.created === 1 ? "" : "s"}.`,
        );
      } else if (action === "generate") {
        const res = await generateLeagueRostersAction({ leagueId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.created === 0
            ? "All rosters already full — nothing to add."
            : `Added ${res.created} players across ${res.teams} team${res.teams === 1 ? "" : "s"}.`,
        );
      } else if (kind === "team") {
        const res = await clearTeamSyntheticAction({ teamId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.deleted === 0
            ? "No synthetic players to remove."
            : `Removed ${res.deleted} synthetic player${res.deleted === 1 ? "" : "s"}.`,
        );
      } else {
        const res = await clearLeagueSyntheticAction({ leagueId: id });
        if (!res.ok) {
          toast.error(errorLabel(res.error));
          return;
        }
        toast.success(
          res.deleted === 0
            ? "No synthetic players to remove."
            : `Removed ${res.deleted} players across ${res.teams} team${res.teams === 1 ? "" : "s"}.`,
        );
      }
      router.refresh();
    });
  }

  const isClear = action === "clear";
  const isAttributes = action === "attributes";
  const Icon = isClear ? Trash2 : isAttributes ? Gauge : Sparkles;
  const label = isClear
    ? pending
      ? "Clearing…"
      : "Clear synthetic"
    : isAttributes
      ? pending
        ? "Rating…"
        : "Generate ratings"
      : pending
        ? "Generating…"
        : kind === "team"
          ? "Generate roster"
          : "Generate rosters";

  return (
    <Button
      type="button"
      variant={isClear ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={run}
      className={isClear ? "text-destructive hover:text-destructive" : undefined}
      title={
        isClear
          ? "Delete generated test players (keeps real players)"
          : isAttributes
            ? "Generate Madden-style ratings for this roster's players (test data)"
            : "Generate fake players to populate this roster for testing/demos"
      }
    >
      <Icon className="mr-1 h-4 w-4" />
      {label}
    </Button>
  );
}

const CONFIRM: Record<
  "generate" | "clear" | "attributes",
  Record<"team" | "league", string>
> = {
  generate: {
    team: "Generate a synthetic (fake) roster for this team? These are test players, not real people.",
    league:
      "Generate synthetic (fake) rosters for ALL teams in this league? These are test players, not real people.",
  },
  clear: {
    team: "Delete all synthetic (generated) players from this team? Real players are kept.",
    league:
      "Delete all synthetic (generated) players from EVERY team in this league? Real players are kept.",
  },
  attributes: {
    team: "Generate Madden-style ratings for this team's players? Test data — overwrites any existing synthetic ratings for the active season.",
    league:
      "Generate Madden-style ratings for EVERY team's players in this league? Test data — overwrites existing synthetic ratings for the active season.",
  },
};

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Synthetic rosters aren't enabled.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "You don't have permission to do that.";
    case "no_season":
      return "This league has no season yet — create one first.";
    default:
      return error;
  }
}
