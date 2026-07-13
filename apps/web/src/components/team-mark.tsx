import { cn } from "@/lib/utils";

export type TeamMarkSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<TeamMarkSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-10 w-10 text-xs",
};

/** Derive two-letter initials from a team name (prototype SL.initials). */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Fallback brand color derived from the team name (prototype SL.teamColor). */
export function teamMarkColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `oklch(0.62 0.14 ${hue})`;
}

export interface TeamMarkProps {
  name: string;
  /** Team brand color from data; falls back to a name-derived hue. */
  primaryColor?: string | null;
  size?: TeamMarkSize;
  className?: string;
}

/**
 * Initials-on-color team mark (leagues-seasons prototype TeamMark): tinted
 * square with the team color as text and border, mono initials.
 */
export function TeamMark({
  name,
  primaryColor,
  size = "md",
  className,
}: TeamMarkProps) {
  const color = primaryColor || teamMarkColor(name);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-mono font-bold leading-none",
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
      }}
    >
      {teamInitials(name)}
    </span>
  );
}
