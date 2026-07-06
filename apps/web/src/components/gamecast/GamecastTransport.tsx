"use client";

import { useSyncExternalStore } from "react";
import type { PbpPlay } from "@/lib/pbp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronsRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {
  GAMECAST_SPEEDS,
  handleModeChange,
  handlePlayPauseClick,
  isBackTransportDisabled,
  isForwardTransportDisabled,
  transportIndexHandlers,
  type GamecastMode,
} from "./gamecast-transport-logic";
import { useAutoAdvance, type GamecastSpeed } from "./useAutoAdvance";

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type { GamecastMode, GamecastSpeed };

export interface GamecastTransportProps {
  plays: PbpPlay[];
  playIndex: number;
  totalPlays: number;
  mode: GamecastMode;
  playing: boolean;
  speed: GamecastSpeed;
  onPlayIndexChange: (next: number) => void;
  onModeChange: (mode: GamecastMode) => void;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: GamecastSpeed) => void;
  onComplete?: () => void;
}

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatOption = (option) => String(option),
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  formatOption?: (option: T) => string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-1 rounded-control bg-surface-2 p-1"
    >
      {options.map((option) => {
        const isActive = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-control px-3 py-1.5 text-label-14 font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-text-muted hover:bg-surface-3 hover:text-text",
            )}
          >
            {formatOption(option)}
          </button>
        );
      })}
    </div>
  );
}

export default function GamecastTransport({
  plays,
  playIndex,
  totalPlays,
  mode,
  playing,
  speed,
  onPlayIndexChange,
  onModeChange,
  onPlayingChange,
  onSpeedChange,
  onComplete,
}: GamecastTransportProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const backDisabled = isBackTransportDisabled(playIndex);
  const forwardDisabled = isForwardTransportDisabled(playIndex, totalPlays);
  const isComplete = playIndex >= totalPlays;
  const handlers = transportIndexHandlers(plays, totalPlays);

  useAutoAdvance({
    playing,
    speed,
    playIndex,
    totalPlays,
    onPlayIndexChange,
    onComplete,
  });

  const pause = () => onPlayingChange(false);

  const stepTo = (next: number) => {
    pause();
    onPlayIndexChange(next);
  };

  const progressPct =
    totalPlays > 0 ? Math.round((playIndex / totalPlays) * 100) : 0;

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<GamecastMode>
          label="Gamecast mode"
          options={["sim", "review"] as const}
          value={mode}
          onChange={(next) =>
            handleModeChange(next, onModeChange, onPlayingChange)
          }
          formatOption={(option) =>
            option === "sim" ? "Sim" : "Review"
          }
        />

        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Playback transport"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Restart"
            disabled={backDisabled}
            onClick={() => stepTo(handlers.restart())}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous half"
            disabled={backDisabled}
            onClick={() => stepTo(handlers.prevHalf(playIndex))}
          >
            <span className="font-mono text-xs font-bold">½</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous quarter"
            disabled={backDisabled}
            onClick={() => stepTo(handlers.prevQuarter(playIndex))}
          >
            <span className="font-mono text-xs font-bold">Q</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous play"
            disabled={backDisabled}
            onClick={() => stepTo(handlers.prevPlay(playIndex))}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="default"
            className="h-11 w-11"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() =>
              handlePlayPauseClick(
                playIndex,
                totalPlays,
                playing,
                onPlayIndexChange,
                onPlayingChange,
              )
            }
          >
            {playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next play"
            disabled={forwardDisabled}
            onClick={() => stepTo(handlers.nextPlay(playIndex))}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next quarter"
            disabled={forwardDisabled}
            onClick={() => stepTo(handlers.nextQuarter(playIndex))}
          >
            <span className="font-mono text-xs font-bold">Q</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next half"
            disabled={forwardDisabled}
            onClick={() => stepTo(handlers.nextHalf(playIndex))}
          >
            <span className="font-mono text-xs font-bold">½</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Entire game"
            disabled={forwardDisabled}
            onClick={() => stepTo(handlers.entireGame())}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        <SegmentedControl<GamecastSpeed>
          label="Simulation speed"
          options={GAMECAST_SPEEDS}
          value={speed}
          onChange={onSpeedChange}
          formatOption={(option) => `${option}×`}
        />
      </div>

      <div className="space-y-2">
        {mode === "review" ? (
          <input
            type="range"
            min={0}
            max={totalPlays}
            step={1}
            value={playIndex}
            aria-label="Scrub play index"
            className="gc-scrub h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-text"
            onChange={(event) => {
              pause();
              onPlayIndexChange(Number(event.target.value));
            }}
          />
        ) : (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalPlays}
            aria-valuenow={playIndex}
            aria-label="Simulation progress"
          >
            <div
              className={cn(
                "h-full rounded-full",
                !reducedMotion && "transition-[width] duration-150 ease-out",
                isComplete ? "bg-accent" : "bg-text",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        <p className="font-mono text-caption-12 text-text-muted">
          Play {playIndex}/{totalPlays}
          {mode === "sim" && playing ? " · Simulating" : null}
          {mode === "sim" && isComplete ? " · Complete" : null}
          {mode === "review" ? " · Drag to scrub" : null}
        </p>
      </div>
    </div>
  );
}
