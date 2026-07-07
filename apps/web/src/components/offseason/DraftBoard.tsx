"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { makeDraftPickAction } from "@/app/dashboard/_actions/draft";
import type { DraftDto } from "@/lib/data-api";
import { gradeToClassYear } from "@/lib/class-year";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pickRound(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0) return 0;
  return Math.ceil(pickNumber / teamCount);
}

export interface DraftBoardProps {
  draft: DraftDto;
  agents: FreeAgentRow[];
  teams: { id: string; name: string }[];
  playerNames: Record<string, string>;
  leagueId: string;
  seasonId: string;
  isAdmin: boolean;
}

export function DraftBoard({
  draft,
  agents,
  teams,
  playerNames,
  leagueId,
  seasonId,
  isAdmin,
}: DraftBoardProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  );

  const draftedPlayerIds = useMemo(
    () => new Set(draft.picks.map((pick) => pick.playerId)),
    [draft.picks],
  );

  const availableAgents = useMemo(
    () => agents.filter((agent) => !draftedPlayerIds.has(agent.id)),
    [agents, draftedPlayerIds],
  );

  const isActive = draft.status === "active";
  const isComplete = draft.status === "complete";
  const canPick = isAdmin && isActive && !pending;

  const onClockTeamName = draft.onClockTeamId
    ? (teamNameById.get(draft.onClockTeamId) ?? "Unknown team")
    : null;

  const currentRound =
    draft.onClockTeamId != null
      ? pickRound(draft.currentPick, draft.order.length)
      : null;

  const sortedPicks = useMemo(
    () => [...draft.picks].sort((a, b) => a.pickNumber - b.pickNumber),
    [draft.picks],
  );

  function handlePick(playerId: string, playerName: string) {
    if (!canPick) return;
    start(async () => {
      const res = await makeDraftPickAction({
        draftId: draft.id,
        playerId,
        leagueId,
        seasonId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${playerName} drafted.`);
      router.refresh();
    });
  }

  return (
    <section
      className="space-y-4"
      data-testid="draft-board"
      aria-labelledby="draft-board-heading"
    >
      <h3 id="draft-board-heading" className="text-lg font-semibold text-foreground">
        Draft board
      </h3>

      {isComplete ? (
        <div
          className="flex items-center gap-2 rounded-control border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
          data-testid="draft-complete-banner"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>Draft complete. Continue with free agency or activate the season.</span>
        </div>
      ) : (
        <div
          className="rounded-control border border-primary/40 bg-primary/10 px-4 py-3"
          data-testid="draft-on-clock"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="font-medium text-foreground">On the clock</span>
            {onClockTeamName ? (
              <Badge variant="secondary" data-testid="draft-on-clock-team">
                {onClockTeamName}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <span className="text-muted-foreground">
              Pick {draft.currentPick}
              {currentRound != null ? ` · Round ${currentRound}` : ""}
            </span>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-4 min-[900px]:grid-cols-2">
        <Card className="min-w-0" data-testid="draft-pool">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Available pool</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            {availableAgents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No players left in the draft pool.
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Overall</TableHead>
                      {canPick && (
                        <TableHead className="text-right">Action</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableAgents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/players/${agent.id}`}
                            className="hover:underline"
                          >
                            {agent.name}
                          </Link>
                        </TableCell>
                        <TableCell>{agent.position}</TableCell>
                        <TableCell>
                          {gradeToClassYear(agent.grade) ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {agent.overall != null ? agent.overall : "—"}
                        </TableCell>
                        {canPick && (
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => handlePick(agent.id, agent.name)}
                              aria-label={`Pick ${agent.name}`}
                            >
                              Pick
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0" data-testid="draft-history">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pick history</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            {sortedPicks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No picks yet.
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rd</TableHead>
                      <TableHead>Pick</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Player</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPicks.map((pick) => (
                      <TableRow key={pick.id} data-testid={`draft-pick-row-${pick.pickNumber}`}>
                        <TableCell className="font-mono tabular-nums">
                          {pick.round}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {pick.pickNumber}
                        </TableCell>
                        <TableCell>
                          {teamNameById.get(pick.teamId) ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {playerNames[pick.playerId] ?? pick.playerId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
