"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamMark } from "@/components/team-mark";
import { cn } from "@/lib/utils";
import { divisionsViewHref } from "./teams-home-navigation";
import {
  formatStandingRecord,
  standingPointDifferential,
  winPercentage,
  type FormResult,
  type KeyPlayerRow,
} from "@/lib/teams-table";
import type { Standing, TeamDto } from "@sports-management/shared-types";

export interface TeamDetailSheetData {
  team: TeamDto;
  standing: Standing;
  divisionName: string | null;
  divisionRank: number;
  divisionTeamCount: number;
  rosterCount: number;
  rosterLimit: number;
  form: FormResult[];
  ovr: number | null;
  keyPlayers: KeyPlayerRow[];
}

export interface TeamDetailSheetProps {
  data: TeamDetailSheetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  scheduleLinksEnabled: boolean;
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "accent" | "muted" | "default";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";

  return (
    <div>
      <p className="m-0 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("m-0 mt-1.5 font-mono text-lg font-semibold tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function FormChip({ result }: { result: FormResult }) {
  const className =
    result === "W"
      ? "bg-accent/15 text-accent"
      : result === "L"
        ? "bg-surface-3 text-muted-foreground"
        : "bg-surface-3 text-muted-foreground/80";

  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-[22px] items-center justify-center rounded-[5px] font-mono text-[11px] font-semibold",
        className,
      )}
    >
      {result}
    </span>
  );
}

export function TeamDetailSheet({
  data,
  open,
  onOpenChange,
  leagueId,
  scheduleLinksEnabled,
}: TeamDetailSheetProps) {
  const titleId = "team-detail-sheet-title";

  if (!data) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="hidden" />
      </Sheet>
    );
  }

  const { team, standing } = data;
  const diff = standingPointDifferential(standing);
  const diffTone = diff > 0 ? "accent" : diff < 0 ? "muted" : "default";
  const mascot = team.teamName?.trim() || "—";
  const standingsHref = `/dashboard/leagues/${leagueId}/standings`;
  const scheduleHref = `/dashboard/leagues/${leagueId}/schedule`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-labelledby={titleId}
        data-testid="team-detail-sheet"
        className="flex w-[min(100vw,35rem)] max-w-[100vw] flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain p-0"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background px-5 py-4">
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {data.divisionName ? (
                <Badge variant="outline">{data.divisionName} Division</Badge>
              ) : null}
              {standing.leagueRank > 0 ? (
                <span className="font-mono text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  #{standing.leagueRank} overall
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 px-5 pb-1 pt-5">
          <TeamMark
            name={team.name}
            primaryColor={team.primaryColor}
            size="lg"
          />
          <div className="min-w-0">
            <p
              id={titleId}
              className="m-0 text-[22px] font-extrabold leading-tight tracking-tight text-foreground"
            >
              {team.name}
            </p>
            <p className="m-0 mt-0.5 text-sm text-muted-foreground">
              {mascot}
              {data.ovr != null ? (
                <>
                  {" "}
                  · OVR <span className="font-mono">{data.ovr}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-4">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 rounded-xl border border-border bg-card p-4">
            <StatCell label="Record" value={formatStandingRecord(standing)} />
            <StatCell
              label="Win %"
              value={winPercentage(standing.wins, standing.losses, standing.ties)}
            />
            <StatCell
              label="Diff"
              value={`${diff > 0 ? "+" : ""}${diff}`}
              tone={diffTone}
            />
            <StatCell label="Points for" value={standing.pointsFor} />
            <StatCell label="Points against" value={standing.pointsAgainst} />
            <StatCell
              label="Roster"
              value={`${data.rosterCount}/${data.rosterLimit}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3.5">
              <p className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Form · last 5
              </p>
              <div className="flex gap-1">
                {data.form.length > 0 ? (
                  data.form.map((result, index) => (
                    <FormChip key={`${result}-${index}`} result={result} />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No games</span>
                )}
              </div>
            </div>

            <Link
              href={divisionsViewHref(team.divisionId)}
              className="rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/40"
            >
              <p className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Division standing
              </p>
              <p className="m-0 text-sm text-foreground">
                {data.divisionName ?? "—"} ·{" "}
                <span className="font-mono font-semibold">
                  #{data.divisionRank || "—"}
                </span>{" "}
                of {data.divisionTeamCount}{" "}
                <span className="text-muted-foreground">→</span>
              </p>
            </Link>
          </div>

          <div className="rounded-xl border border-border p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" aria-hidden />
              <span className="text-sm font-semibold text-foreground">Key players</span>
            </div>
            {data.keyPlayers.length > 0 ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {data.keyPlayers.map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                      <span className="w-[26px] font-mono text-[11px] text-muted-foreground">
                        {player.position}
                      </span>
                      <span className="truncate text-sm text-foreground">
                        {player.name}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-accent">
                      {player.rating ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 pt-2 text-xs text-muted-foreground">No players yet</p>
            )}
          </div>

          {scheduleLinksEnabled ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={standingsHref}>View in standings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={scheduleHref}>Schedule</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
