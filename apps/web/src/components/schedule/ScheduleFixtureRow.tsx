"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Radio, Tv } from "lucide-react";
import { formatFixtureWhen } from "@/lib/format";
import type { GameDrawerProjection } from "@/lib/game-drawer-projection";
import { gameDrawerMatchupLabel } from "@/lib/game-drawer-projection";
import { GameContextDrawer } from "@/components/games/GameContextDrawer";
import { StatusBadge } from "@/components/status-badge";
import RecordResultDialog from "@/components/schedule/RecordResultDialog";
import DeleteFixtureButton from "@/components/schedule/DeleteFixtureButton";
import GoLiveControl from "@/components/schedule/GoLiveControl";
import ClipsControl from "@/components/schedule/ClipsControl";
import { SimulateGameButton } from "@/components/schedule/SimulateControls";
import type { PublicGameStream } from "@/lib/data-api";
import type { GameResultDto } from "@sports-management/shared-types";
import type { FixtureDto } from "@sports-management/shared-types";
import { cn } from "@/lib/utils";

type StreamStatus = "idle" | "active" | "ended";

export interface ScheduleFixtureRowProps {
  fixture: FixtureDto;
  result: GameResultDto | null;
  hasPlayLog: boolean;
  projection: GameDrawerProjection;
  leagueId: string;
  isAdmin: boolean;
  canMutate: boolean;
  canGoLive: boolean;
  canStream: boolean;
  statsEnabled: boolean;
  liveEnabled: boolean;
  stream: PublicGameStream | null | undefined;
}

function MatchupCell({
  children,
  className,
  onOpen,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onOpen: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      data-testid="schedule-fixture-drawer-cell"
      onClick={onOpen}
      className={cn(
        "block w-full rounded-sm text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ScheduleFixtureRow({
  fixture,
  result,
  hasPlayLog,
  projection,
  leagueId,
  isAdmin,
  canMutate,
  canGoLive,
  canStream,
  statsEnabled,
  liveEnabled,
  stream,
}: ScheduleFixtureRowProps) {
  const [open, setOpen] = React.useState(false);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const drawerLabel = `View ${projection.status === "final" ? "final" : "preview"} for ${gameDrawerMatchupLabel(projection)}`;

  const openDrawer = (event: React.MouseEvent<HTMLButtonElement>) => {
    restoreFocusRef.current = event.currentTarget;
    setOpen(true);
  };

  const scoreDisplay =
    result != null ? `${result.homeScore} – ${result.awayScore}` : "—";

  return (
    <>
      <tr
        data-testid={`schedule-fixture-${fixture.id}`}
        className="border-b border-border"
      >
        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
          <MatchupCell onOpen={openDrawer} ariaLabel={drawerLabel}>
            {formatFixtureWhen(fixture.scheduledAt)}
          </MatchupCell>
        </td>
        <td className="px-4 py-2 text-foreground">
          <MatchupCell onOpen={openDrawer} ariaLabel={drawerLabel}>
            {fixture.homeTeamName}
          </MatchupCell>
        </td>
        <td className="px-4 py-2 text-foreground">
          <MatchupCell onOpen={openDrawer} ariaLabel={drawerLabel}>
            {fixture.awayTeamName}
          </MatchupCell>
        </td>
        <td className="px-4 py-2 text-right font-mono text-foreground">
          {result && statsEnabled ? (
            <Link
              href={`/dashboard/games/${fixture.id}/boxscore`}
              className="hover:underline"
              title="View box score"
            >
              {scoreDisplay}
            </Link>
          ) : (
            <MatchupCell
              onOpen={openDrawer}
              ariaLabel={drawerLabel}
              className="text-right"
            >
              {scoreDisplay}
            </MatchupCell>
          )}
        </td>
        <td className="px-4 py-2">
          <MatchupCell onOpen={openDrawer} ariaLabel={drawerLabel} className="inline-flex">
            <StatusBadge status={fixture.status} />
          </MatchupCell>
        </td>
        {isAdmin ? (
          <td className="px-4 py-2">
            <div className="flex flex-wrap items-center gap-1">
              {canMutate ? (
                <RecordResultDialog
                  leagueId={leagueId}
                  fixtureId={fixture.id}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                  initialHomeScore={result?.homeScore ?? null}
                  initialAwayScore={result?.awayScore ?? null}
                  triggerLabel={result ? "Edit result" : "Record result"}
                />
              ) : null}
              {canMutate && fixture.status === "scheduled" ? (
                <SimulateGameButton
                  leagueId={leagueId}
                  fixtureId={fixture.id}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                />
              ) : null}
              {canMutate ? (
                <DeleteFixtureButton
                  leagueId={leagueId}
                  fixtureId={fixture.id}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                />
              ) : null}
              {canGoLive ? (
                <GoLiveControl
                  leagueId={leagueId}
                  fixtureId={fixture.id}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                  status={(stream?.status as StreamStatus | undefined) ?? null}
                  gameStatus={fixture.status}
                />
              ) : null}
              {canStream &&
              stream?.provider === "mux" &&
              stream?.vodAssetId ? (
                <ClipsControl
                  leagueId={leagueId}
                  fixtureId={fixture.id}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                  vodPlaybackId={stream?.vodPlaybackId ?? null}
                />
              ) : null}
              {statsEnabled ? (
                <span className="flex items-center gap-1 text-xs">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Box score</span>
                  <Link
                    href={`/dashboard/teams/${fixture.homeTeamId}/games/${fixture.id}/stats`}
                    className="text-primary hover:underline"
                  >
                    Home
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <Link
                    href={`/dashboard/teams/${fixture.awayTeamId}/games/${fixture.id}/stats`}
                    className="text-primary hover:underline"
                  >
                    Away
                  </Link>
                </span>
              ) : null}
              {liveEnabled ? (
                <span className="flex items-center gap-1 text-xs">
                  <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                  <Link
                    href={`/dashboard/teams/${fixture.homeTeamId}/games/${fixture.id}/live`}
                    className="text-primary hover:underline"
                  >
                    Live (Home)
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <Link
                    href={`/dashboard/teams/${fixture.awayTeamId}/games/${fixture.id}/live`}
                    className="text-primary hover:underline"
                  >
                    Live (Away)
                  </Link>
                </span>
              ) : null}
              {fixture.status === "final" && hasPlayLog ? (
                <span className="flex items-center gap-1 text-xs">
                  <Tv className="h-3.5 w-3.5 text-muted-foreground" />
                  <Link
                    href={`/dashboard/games/${fixture.id}/gamecast`}
                    className="text-primary hover:underline"
                  >
                    Gamecast
                  </Link>
                </span>
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      <GameContextDrawer
        projection={projection}
        open={open}
        onOpenChange={setOpen}
        restoreFocusRef={restoreFocusRef}
      />
    </>
  );
}
