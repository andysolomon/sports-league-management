import { Button } from "@/components/ui/button";

interface GamecastControlsProps {
  playIndex: number;
  totalPlays: number;
  onNextPlay: () => void;
  onNextQuarter: () => void;
  onNextHalf: () => void;
  onEntireGame: () => void;
  onRestart: () => void;
}

export default function GamecastControls({
  playIndex,
  totalPlays,
  onNextPlay,
  onNextQuarter,
  onNextHalf,
  onEntireGame,
  onRestart,
}: GamecastControlsProps) {
  const atEnd = playIndex >= totalPlays;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={onNextPlay}
        disabled={atEnd}
      >
        Next play
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onNextQuarter}
        disabled={atEnd}
      >
        Next quarter
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onNextHalf}
        disabled={atEnd}
      >
        Next half
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onEntireGame}
        disabled={atEnd}
      >
        Entire game
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRestart}
        disabled={playIndex === 0}
      >
        Restart
      </Button>
    </div>
  );
}
