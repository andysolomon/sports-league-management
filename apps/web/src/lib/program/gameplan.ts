/*
 * Weekly gameplan (Dynasty Mode C3).
 *
 * Pure opponent-specific emphasis layered on top of season schemes. Like
 * `schemes.ts` ↔ `pbp/schemes.ts`, this module states intent; the simulator
 * translates it into engine numbers.
 */

import {
  defenseTendencies,
  type DefenseTendencies,
} from "@/lib/program/schemes";

/** Same shape the simulator consumes via `pbp/schemes.SchemeModifiers`. */
export interface GameplanModifiers {
  passRateDelta: number;
  tempo: number;
  explosiveRate: number;
  sackRate: number;
  passAccuracy: number;
  interceptionRate: number;
  rushYards: number;
  fumbleRate: number;
}

export const NEUTRAL_GAMEPLAN_MODIFIERS: Readonly<GameplanModifiers> =
  Object.freeze({
    passRateDelta: 0,
    tempo: 1,
    explosiveRate: 1,
    sackRate: 1,
    passAccuracy: 1,
    interceptionRate: 1,
    rushYards: 1,
    fumbleRate: 1,
  });

export const GAMEPLAN_FOCUS_OPTIONS = [
  "balanced",
  "establish_run",
  "attack_pass",
  "tempo_up",
  "control_clock",
  "take_shots",
] as const;

export type GameplanFocus = (typeof GAMEPLAN_FOCUS_OPTIONS)[number];

export function isGameplanFocus(value: string): value is GameplanFocus {
  return (GAMEPLAN_FOCUS_OPTIONS as readonly string[]).includes(value);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Weekly emphasis against an opponent's stored schemes.
 *
 * An absent focus returns the exact identity — every multiplier 1, every delta
 * 0 — matching `schemeModifiers(undefined, undefined)`.
 */
export function gameplanModifiers(
  focus: GameplanFocus | null | undefined,
  opponent: { defenseScheme?: string | null } | null | undefined,
): GameplanModifiers {
  if (!focus || focus === "balanced") {
    return { ...NEUTRAL_GAMEPLAN_MODIFIERS };
  }

  const def: DefenseTendencies = defenseTendencies(opponent?.defenseScheme);

  switch (focus) {
    case "establish_run":
      return {
        ...NEUTRAL_GAMEPLAN_MODIFIERS,
        passRateDelta: -0.06 - def.runFit * 0.04,
        rushYards: clamp(1 + 0.08 - def.runFit * 0.05, 0.85, 1.2),
        tempo: clamp(1 + 0.05, 0.9, 1.15),
      };
    case "attack_pass":
      return {
        ...NEUTRAL_GAMEPLAN_MODIFIERS,
        passRateDelta: 0.07 + def.blitz * 0.03,
        tempo: clamp(1 - 0.06 - def.blitz * 0.04, 0.75, 1),
        sackRate: clamp(1 - def.blitz * 0.08, 0.85, 1.05),
      };
    case "tempo_up":
      return {
        ...NEUTRAL_GAMEPLAN_MODIFIERS,
        tempo: 0.88,
        passRateDelta: 0.04,
        explosiveRate: clamp(1 + def.coverage * 0.05, 0.95, 1.15),
      };
    case "control_clock":
      return {
        ...NEUTRAL_GAMEPLAN_MODIFIERS,
        tempo: 1.12,
        passRateDelta: -0.05,
        rushYards: clamp(1 + 0.05, 1, 1.15),
      };
    case "take_shots":
      return {
        ...NEUTRAL_GAMEPLAN_MODIFIERS,
        passRateDelta: 0.05,
        explosiveRate: clamp(1 + 0.12 - def.coverage * 0.08, 0.9, 1.25),
        passAccuracy: clamp(1 - 0.06 - def.coverage * 0.04, 0.82, 1),
        interceptionRate: clamp(1 + def.coverage * 0.06, 1, 1.2),
      };
    default:
      return { ...NEUTRAL_GAMEPLAN_MODIFIERS };
  }
}
