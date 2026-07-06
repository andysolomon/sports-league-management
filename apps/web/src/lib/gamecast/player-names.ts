import type { PbpParticipantRole } from "@/lib/pbp";

export interface GamecastPlayerInfo {
  name: string;
  position: string;
}

export type GamecastPlayerNameMap = Record<string, GamecastPlayerInfo>;

const ROLE_POSITION_FALLBACK: Partial<Record<PbpParticipantRole, string>> = {
  passer: "QB",
  rusher: "RB",
  receiver: "WR",
  kicker: "K",
  returner: "KR",
  sacker: "DL",
  tackler_solo: "LB",
  tackler_ast: "LB",
  interceptor: "DB",
  pass_defender: "DB",
  fumbler: "RB",
  recoverer: "DL",
};

export function formatShortPlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  const initial = parts[0].charAt(0).toUpperCase();
  return `${initial}. ${parts[parts.length - 1]}`;
}

export function rolePositionFallback(
  role: PbpParticipantRole | undefined,
): string | null {
  if (!role) return null;
  return ROLE_POSITION_FALLBACK[role] ?? null;
}

/** Resolve a display label; returns null when the role should be omitted. */
export function resolvePlayerLabel(
  playerId: string,
  map: GamecastPlayerNameMap,
  role?: PbpParticipantRole,
): string | null {
  const entry = map[playerId];
  if (entry?.name) return formatShortPlayerName(entry.name);

  const position = entry?.position || rolePositionFallback(role);
  if (position) return `${position} ${playerId.slice(-4)}`;

  return null;
}
