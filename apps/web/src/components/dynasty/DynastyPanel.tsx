"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, GraduationCap, Users } from "lucide-react";
import { startNextSeasonAction } from "@/app/dashboard/_actions/dynasty";
import {
  evaluateStartNextSeason,
  formatRolloverSuccessSummary,
  startNextSeasonErrorMessage,
  type DynastySeasonState,
} from "@/lib/dynasty-panel";
import type { ClassDistribution } from "@/lib/class-year";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface GraduatedPlayerRow {
  id: string;
  name: string;
  position: string;
  teamName: string | null;
}

export interface DynastyPanelProps {
  leagueId: string;
  seasonState: DynastySeasonState;
  gate: ReturnType<typeof evaluateStartNextSeason>;
  classDistribution: ClassDistribution;
  graduatedPlayers: GraduatedPlayerRow[];
  upcomingSeason: { id: string; name: string } | null;
  unplayedGames: number;
  playoffsUndecided: boolean;
}

const STATUS_BADGE_VARIANT: Record<
  DynastySeasonState["status"],
  "default" | "secondary" | "outline" | "success"
> = {
  no_season: "secondary",
  in_progress: "default",
  decided: "success",
  offseason_upcoming: "outline",
};

export function DynastyPanel({
  leagueId,
  seasonState,
  gate,
  classDistribution,
  graduatedPlayers,
  upcomingSeason,
  unplayedGames,
  playoffsUndecided,
}: DynastyPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  function runStartNextSeason() {
    if (!gate.canStart) return;
    if (
      !window.confirm(
        "Start the next season? Seniors will graduate, other players advance a grade, and freshmen will be generated.",
      )
    ) {
      return;
    }

    start(async () => {
      const res = await startNextSeasonAction({ leagueId });
      if (!res.ok) {
        toast.error(
          startNextSeasonErrorMessage(res.error, {
            unplayedGames,
            playoffsUndecided,
            upcomingSeason,
          }),
        );
        return;
      }
      const summary = formatRolloverSuccessSummary({
        graduated: res.graduated,
        advanced: res.advanced,
        freshmen: res.freshmen,
        progressed: res.progressed,
      });
      setLastSuccess(summary);
      toast.success("Next season started.");
      router.refresh();
    });
  }

  const activeTotal =
    classDistribution.FR +
    classDistribution.SO +
    classDistribution.JR +
    classDistribution.SR +
    classDistribution.unknown;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-label-14 text-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            Dynasty
          </p>
          <p className="mt-1 text-caption-12 text-text-muted">
            Season continuity — graduate seniors, advance classes, and recruit
            freshmen.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {seasonState.seasonName ?? "—"}
          </span>
          <Badge variant={STATUS_BADGE_VARIANT[seasonState.status]}>
            {seasonState.statusLabel}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending || !gate.canStart}
            onClick={runStartNextSeason}
            title={gate.message ?? "Start the next season (offseason rollover)"}
          >
            {pending ? "Starting…" : "Start next season"}
          </Button>
          {!gate.canStart && gate.message && (
            <p className="text-caption-12 text-text-muted">{gate.message}</p>
          )}
        </div>

        {gate.errorCode === "next_season_exists" && upcomingSeason && (
          <p className="mt-2 text-caption-12">
            <Link
              href={`/dashboard/seasons/${upcomingSeason.id}`}
              className="text-primary hover:underline"
            >
              View {upcomingSeason.name} →
            </Link>
          </p>
        )}

        {lastSuccess && (
          <p className="mt-3 rounded-sm border border-border bg-muted/50 px-3 py-2 text-caption-12 text-foreground">
            {lastSuccess}
          </p>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          Class distribution
          <span className="font-normal text-muted-foreground">
            ({activeTotal} active)
          </span>
        </p>
        <dl className="mt-3 grid grid-cols-4 gap-3 text-center sm:grid-cols-5">
          {(["FR", "SO", "JR", "SR"] as const).map((label) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold text-foreground">
                {classDistribution[label]}
              </dd>
            </div>
          ))}
          {classDistribution.unknown > 0 && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">—</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold text-muted-foreground">
                {classDistribution.unknown}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {graduatedPlayers.length > 0 && (
        <Accordion type="single" collapsible className="rounded-md border border-border bg-card px-4">
          <AccordionItem value="graduated" className="border-none">
            <AccordionTrigger className="hover:no-underline">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                Graduated players ({graduatedPlayers.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1.5 text-sm">
                {graduatedPlayers.map((player) => (
                  <li key={player.id}>
                    <Link
                      href={`/dashboard/players/${player.id}`}
                      className="text-primary hover:underline"
                    >
                      {player.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {player.position}
                      {player.teamName ? ` · ${player.teamName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
