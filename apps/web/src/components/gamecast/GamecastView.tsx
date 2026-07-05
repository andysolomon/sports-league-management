"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { allPlays, type PbpGameLog } from "@/lib/pbp";
import {
  buildDriveChartSegments,
  clockAtPosition,
  entireGameIndex,
  groupPlaysByDrive,
  nextHalfIndex,
  nextPlayIndex,
  nextQuarterIndex,
  restartIndex,
  revealedPlays,
  scoreAtPosition,
} from "@/lib/gamecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GamecastScoreboard from "./GamecastScoreboard";
import DriveChart from "./DriveChart";
import PlayList from "./PlayList";
import GamecastControls from "./GamecastControls";

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface GamecastViewProps {
  log: PbpGameLog;
  homeTeamName: string;
  awayTeamName: string;
  engineVersionMismatch: boolean;
  storedEngineVersion: string;
  currentEngineVersion: string;
}

export default function GamecastView({
  log,
  homeTeamName,
  awayTeamName,
  engineVersionMismatch,
  storedEngineVersion,
  currentEngineVersion,
}: GamecastViewProps) {
  const plays = useMemo(() => allPlays(log), [log]);
  const [playIndex, setPlayIndex] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const score = scoreAtPosition(log, plays, playIndex);
  const clock = clockAtPosition(plays, playIndex);
  const isComplete = playIndex >= plays.length;
  const segments = buildDriveChartSegments(log, plays, playIndex);
  const groups = groupPlaysByDrive(log, revealedPlays(plays, playIndex));

  return (
    <div className="space-y-4">
      {engineVersionMismatch ? (
        <p className="rounded-card border border-border bg-surface-2 px-4 py-2 text-caption-12 text-text-muted">
          Play log engine version ({storedEngineVersion}) differs from the
          current engine ({currentEngineVersion}). Showing best-effort replay.
        </p>
      ) : null}

      <GamecastScoreboard
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeScore={score.home}
        awayScore={score.away}
        quarter={clock?.quarter ?? null}
        clockSeconds={clock?.clockSeconds ?? null}
        isComplete={isComplete}
      />

      <GamecastControls
        playIndex={playIndex}
        totalPlays={plays.length}
        onNextPlay={() => setPlayIndex((i) => nextPlayIndex(i, plays.length))}
        onNextQuarter={() =>
          setPlayIndex((i) => nextQuarterIndex(plays, i))
        }
        onNextHalf={() => setPlayIndex((i) => nextHalfIndex(plays, i))}
        onEntireGame={() => setPlayIndex(entireGameIndex(plays.length))}
        onRestart={() => setPlayIndex(restartIndex())}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-heading-18">Drive chart</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-4">
          <DriveChart
            segments={segments}
            homeLabel={homeTeamName}
            awayLabel={awayTeamName}
            animate={!reducedMotion}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-heading-18">Play-by-play</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PlayList
            groups={groups}
            homeTeamId={log.homeTeamId}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            animate={!reducedMotion}
          />
        </CardContent>
      </Card>
    </div>
  );
}
