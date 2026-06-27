"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateTeamRosterAction,
  generateLeagueRostersAction,
} from "@/app/dashboard/_actions/synthetic-rosters";

/*
 * Generate synthetic (fake) players to populate a roster for testing/demos
 * (WSM-000173). `team` fills one team; `league` fills every team in the league
 * (admin-only). Clearly labels the data as synthetic so it's never mistaken for
 * real entries. Gated upstream by the syntheticRostersV1 flag (the parent only
 * renders this when the flag is on and the role allows it).
 */
interface SyntheticRosterButtonProps {
  kind: "team" | "league";
  id: string;
}

export function SyntheticRosterButton({ kind, id }: SyntheticRosterButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    const confirmMsg =
      kind === "team"
        ? "Generate a synthetic (fake) roster for this team? These are test players, not real people."
        : "Generate synthetic (fake) rosters for ALL teams in this league? These are test players, not real people.";
    if (!window.confirm(confirmMsg)) return;

    start(async () => {
      if (kind === "team") {
        const res = await generateTeamRosterAction({ teamId: id });
        if (res.ok) {
          toast.success(
            res.created === 0
              ? "Roster already full — nothing to add."
              : `Added ${res.created} synthetic player${res.created === 1 ? "" : "s"}.`,
          );
          router.refresh();
        } else {
          toast.error(errorLabel(res.error));
        }
      } else {
        const res = await generateLeagueRostersAction({ leagueId: id });
        if (res.ok) {
          toast.success(
            res.created === 0
              ? "All rosters already full — nothing to add."
              : `Added ${res.created} players across ${res.teams} team${res.teams === 1 ? "" : "s"}.`,
          );
          router.refresh();
        } else {
          toast.error(errorLabel(res.error));
        }
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
      title="Generate fake players to populate this roster for testing/demos"
    >
      <Sparkles className="mr-1 h-4 w-4" />
      {pending
        ? "Generating…"
        : kind === "team"
          ? "Generate roster"
          : "Generate rosters"}
    </Button>
  );
}

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Synthetic rosters aren't enabled.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "You don't have permission to do that.";
    default:
      return error;
  }
}
