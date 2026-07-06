"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { allPlays, type PbpGameLog, type PbpPlay } from "@/lib/pbp";
import {
  boxScoreAtPosition,
  buildDriveChartSegments,
  clockAtPosition,
  deriveTeamDisplay,
  formatDownAndDistance,
  groupPlaysByDrive,
  offenseToChartYard,
  revealedPlays,
  scoreAtPosition,
  scoringSummaryAtPosition,
  winProbabilitySeries,
} from "@/lib/gamecast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import GamecastScoreboard from "./GamecastScoreboard";
import DriveChart from "./DriveChart";
import PlayList from "./PlayList";
import FieldPosition from "./FieldPosition";
import WinProbability from "./WinProbability";
import BoxScore from "./BoxScore";
import ScoringSummary from "./ScoringSummary";
import GamecastTransport from "./GamecastTransport";
import type { GamecastMode } from "./gamecast-transport-logic";
import type { GamecastSpeed } from "./useAutoAdvance";

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatFieldSpot(
  play: PbpPlay,
  homeTeamId: string,
  homeAbbr: string,
  awayAbbr: string,
): string {
  const abbr = play.offenseTeamId === homeTeamId ? homeAbbr : awayAbbr;
  return `${abbr} ${play.fieldPosition}`;
}

function currentDriveSummary(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: number,
): string | null {
  if (playIndex <= 0 || playIndex > plays.length) return null;
  const play = plays[playIndex - 1];
  const drive = log.drives.find((d) => d.driveId === play.driveId);
  if (!drive) return null;
  const drivePlays = drive.plays.filter((p) => {
    const idx = plays.findIndex((fp) => fp.playId === p.playId);
    return idx >= 0 && idx < playIndex;
  });
  if (drivePlays.length === 0) return null;
  const net =
    drivePlays[drivePlays.length - 1].fieldPosition +
    drivePlays[drivePlays.length - 1].yardsGained -
    drive.startFieldPosition;
  return `${drivePlays.length} play drive · ${net >= 0 ? `+${net}` : net} yds`;
}

export interface GamecastViewProps {
  log: PbpGameLog;
  homeTeamName: string;
  awayTeamName: string;
  homePrimaryColor?: string | null;
  awayPrimaryColor?: string | null;
  weekLabel?: string | null;
  engineVersionMismatch: boolean;
  storedEngineVersion: string;
  currentEngineVersion: string;
}

export default function GamecastView({
  log,
  homeTeamName,
  awayTeamName,
  homePrimaryColor,
  awayPrimaryColor,
  weekLabel,
  engineVersionMismatch,
  storedEngineVersion,
  currentEngineVersion,
}: GamecastViewProps) {
  const plays = useMemo(() => allPlays(log), [log]);
  const totalPlays = plays.length;

  const [playIndex, setPlayIndex] = useState(totalPlays);
  const [mode, setMode] = useState<GamecastMode>("review");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<GamecastSpeed>(1);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const homeDisplay = useMemo(
    () => deriveTeamDisplay(homeTeamName, homePrimaryColor),
    [homeTeamName, homePrimaryColor],
  );
  const awayDisplay = useMemo(
    () => deriveTeamDisplay(awayTeamName, awayPrimaryColor),
    [awayTeamName, awayPrimaryColor],
  );

  const winProbSeries = useMemo(
    () => winProbabilitySeries(log, plays),
    [log, plays],
  );
  const segments = useMemo(
    () => buildDriveChartSegments(log, plays, playIndex),
    [log, plays, playIndex],
  );
  const allGroups = useMemo(() => groupPlaysByDrive(log, plays), [log, plays]);
  const visibleGroups = useMemo(() => {
    if (mode === "review") return allGroups;
    return groupPlaysByDrive(log, revealedPlays(plays, playIndex));
  }, [allGroups, log, mode, playIndex, plays]);

  const score = scoreAtPosition(log, plays, playIndex);
  const clock = clockAtPosition(plays, playIndex);
  const isComplete = playIndex >= totalPlays;
  const isPreGame = playIndex === 0;
  const boxScore = boxScoreAtPosition(log, plays, playIndex);
  const scoringSummary = scoringSummaryAtPosition(log, plays, playIndex);

  const currentPlay =
    playIndex > 0 && playIndex <= plays.length
      ? plays[playIndex - 1]
      : null;

  const possession: "home" | "away" | null =
    currentPlay && !isComplete
      ? currentPlay.offenseTeamId === log.homeTeamId
        ? "home"
        : "away"
      : null;

  const fieldGeometry = useMemo(() => {
    if (!currentPlay || isPreGame || isComplete) {
      return {
        ballChartYard: 50,
        losChartYard: 50,
        firstDownChartYard: null as number | null,
        possession: null as "home" | "away" | null,
      };
    }
    const losChartYard = offenseToChartYard(
      currentPlay.fieldPosition,
      currentPlay.offenseTeamId,
      log.homeTeamId,
    );
    const ballChartYard = offenseToChartYard(
      currentPlay.fieldPosition + currentPlay.yardsGained,
      currentPlay.offenseTeamId,
      log.homeTeamId,
    );
    const firstDownChartYard =
      currentPlay.distance > 0
        ? offenseToChartYard(
            currentPlay.fieldPosition + currentPlay.distance,
            currentPlay.offenseTeamId,
            log.homeTeamId,
          )
        : null;
    return {
      ballChartYard,
      losChartYard,
      firstDownChartYard,
      possession:
        currentPlay.offenseTeamId === log.homeTeamId ? ("home" as const) : ("away" as const),
    };
  }, [currentPlay, isComplete, isPreGame, log.homeTeamId]);

  const pauseAndJump = useCallback((next: number) => {
    setPlaying(false);
    setPlayIndex(next);
  }, []);

  const showSituation = !isPreGame && !isComplete && currentPlay;
  const driveSummary = currentDriveSummary(log, plays, playIndex);

  const homeTeamWithMeta = useMemo(
    () => ({ ...homeDisplay, name: homeTeamName }),
    [homeDisplay, homeTeamName],
  );
  const awayTeamWithMeta = useMemo(
    () => ({ ...awayDisplay, name: awayTeamName }),
    [awayDisplay, awayTeamName],
  );

  return (
    <div className="overflow-hidden rounded-card border border-border bg-bg">
      {engineVersionMismatch ? (
        <p className="border-b border-border bg-surface-2 px-4 py-2 text-caption-12 text-text-muted">
          Play log engine version ({storedEngineVersion}) differs from the
          current engine ({currentEngineVersion}). Showing best-effort replay.
        </p>
      ) : null}

      <GamecastScoreboard
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeDisplay={homeDisplay}
        awayDisplay={awayDisplay}
        homeScore={score.home}
        awayScore={score.away}
        quarter={clock?.quarter ?? null}
        clockSeconds={clock?.clockSeconds ?? null}
        isComplete={isComplete}
        isPreGame={isPreGame}
        possession={possession}
        mode={mode}
        playIndex={playIndex}
        totalPlays={totalPlays}
        weekLabel={weekLabel}
        reducedMotion={reducedMotion}
      />

      <div className="border-b border-border bg-surface-2 px-5 py-4">
        <GamecastTransport
          plays={plays}
          playIndex={playIndex}
          totalPlays={totalPlays}
          mode={mode}
          playing={playing}
          speed={speed}
          onPlayIndexChange={setPlayIndex}
          onModeChange={setMode}
          onPlayingChange={setPlaying}
          onSpeedChange={setSpeed}
          onComplete={() => setPlaying(false)}
        />
      </div>

      <div
        className={cn(
          "border-b border-border px-5 py-3",
          showSituation ? "bg-surface" : "bg-surface-2",
        )}
      >
        {showSituation && currentPlay ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[22px] font-extrabold tracking-tight text-foreground">
              {formatDownAndDistance(currentPlay)}
            </span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span className="text-label-14 text-text-muted">
              {currentPlay.offenseTeamId === log.homeTeamId
                ? homeTeamName
                : awayTeamName}{" "}
              ball · {formatFieldSpot(currentPlay, log.homeTeamId, homeDisplay.abbr, awayDisplay.abbr)}
            </span>
            {driveSummary ? (
              <span className="text-caption-12 text-text-subtle">{driveSummary}</span>
            ) : null}
            {currentPlay.isScoring ? (
              <Badge variant="success" className="ml-auto font-mono text-[10px]">
                +{currentPlay.pointsScored}{" "}
                {currentPlay.playType === "field_goal"
                  ? "FG"
                  : currentPlay.playType === "extra_point"
                    ? "PAT"
                    : "TD"}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-center font-mono text-caption-12 text-text-subtle">
            {isPreGame
              ? "Awaiting kickoff — press play to start the sim"
              : "Final"}
          </p>
        )}
      </div>

      <div className="grid gap-[18px] p-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-[18px]">
          <Panel title="Field position">
            <FieldPosition
              homeTeam={{ name: homeTeamName, ...homeDisplay }}
              awayTeam={{ name: awayTeamName, ...awayDisplay }}
              ballChartYard={fieldGeometry.ballChartYard}
              losChartYard={fieldGeometry.losChartYard}
              firstDownChartYard={fieldGeometry.firstDownChartYard}
              possession={fieldGeometry.possession}
            />
          </Panel>

          <Panel title="Drive chart">
            <DriveChart
              log={log}
              plays={plays}
              segments={segments}
              homeTeam={homeTeamWithMeta}
              awayTeam={awayTeamWithMeta}
              mode={mode}
              playIndex={playIndex}
              onDriveSelect={pauseAndJump}
            />
          </Panel>
        </div>

        <div className="space-y-[18px]">
          <Panel title="Win probability">
            <WinProbability
              series={winProbSeries}
              currentIndex={playIndex}
              mode={mode}
              homeTeam={homeDisplay}
              awayTeam={awayDisplay}
            />
          </Panel>

          <Panel title="Scoring summary">
            <ScoringSummary
              entries={scoringSummary}
              homeTeam={{
                id: log.homeTeamId,
                abbr: homeDisplay.abbr,
                color: homeDisplay.color,
              }}
              awayTeam={{
                id: log.awayTeamId,
                abbr: awayDisplay.abbr,
                color: awayDisplay.color,
              }}
            />
          </Panel>

          <Panel title="Team stats">
            <BoxScore
              data={boxScore}
              homeTeam={{ abbr: homeDisplay.abbr }}
              awayTeam={{ abbr: awayDisplay.abbr }}
            />
          </Panel>
        </div>
      </div>

      <Card className="mx-5 mb-5 gap-0 rounded-card border-border bg-surface py-0 shadow-none">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Play-by-play
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PlayList
            groups={visibleGroups}
            allPlaysFlat={plays}
            homeTeamId={log.homeTeamId}
            homeTeam={homeTeamWithMeta}
            awayTeam={awayTeamWithMeta}
            playIndex={playIndex}
            mode={mode}
            animate={!reducedMotion}
            onPlaySelect={pauseAndJump}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-0 rounded-card border-border bg-surface py-0 shadow-none">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">{children}</CardContent>
    </Card>
  );
}
