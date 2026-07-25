import { cn } from "@/lib/utils";
import { positionSide, type PositionSide } from "@/lib/players-directory";

/*
 * Position chip colour-coded by side of the ball (WSM — Players directory).
 * Colour is redundant with the position text it wraps, never the sole carrier
 * of meaning, so it stays readable for colour-blind users and in monochrome.
 * Unmapped positions fall back to the neutral surface treatment.
 */
const SIDE_CLASSES: Record<PositionSide, string> = {
  off: "bg-pos-off/15 text-pos-off",
  def: "bg-pos-def/15 text-pos-def",
  st: "bg-pos-st/15 text-pos-st",
};

export const POSITION_SIDE_LABELS: Record<PositionSide, string> = {
  off: "Offense",
  def: "Defense",
  st: "Special teams",
};

export function positionSideClasses(position: string): string {
  const side = positionSide(position);
  return side ? SIDE_CLASSES[side] : "bg-surface-3 text-text-muted";
}

export function PositionBadge({
  position,
  className,
}: {
  position: string;
  className?: string;
}) {
  const side = positionSide(position);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        positionSideClasses(position),
        className,
      )}
      title={side ? POSITION_SIDE_LABELS[side] : undefined}
    >
      {position}
    </span>
  );
}
