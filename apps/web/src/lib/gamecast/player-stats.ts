import type { PlayerGameStatLine } from "@sports-management/shared-types";
import type { PbpGameLog, PbpPlay } from "@/lib/pbp";
import {
  applyPlay,
  pruneLine,
  type DerivedPlayerStatLine,
  type MutableLine,
} from "@/lib/pbp/derive-stats";
import type { PlayRevealIndex } from "./reveal";

export type { DerivedPlayerStatLine };

export interface TeamStatLeader {
  playerId: string;
  teamId: string;
  statLine: PlayerGameStatLine;
  compactLine: string;
  primaryValue: number;
}

export interface StatGroupLeaders {
  group: keyof PlayerGameStatLine;
  label: string;
  home: TeamStatLeader | null;
  away: TeamStatLeader | null;
}

type StatGroupKey = keyof PlayerGameStatLine;

interface GroupConfig {
  key: StatGroupKey;
  label: string;
  primaryValue: (line: DerivedPlayerStatLine) => number;
  formatCompact: (stats: PlayerGameStatLine) => string;
}

function hasGroupActivity(
  line: DerivedPlayerStatLine,
  key: StatGroupKey,
): boolean {
  const group = line.statLine[key];
  if (!group) return false;
  return Object.values(group).some((v) => v !== 0);
}

function pickTeamLeader(
  lines: DerivedPlayerStatLine[],
  teamId: string,
  config: GroupConfig,
): TeamStatLeader | null {
  const candidates = lines
    .filter((l) => l.teamId === teamId && hasGroupActivity(l, config.key))
    .sort((a, b) => {
      const diff = config.primaryValue(b) - config.primaryValue(a);
      if (diff !== 0) return diff;
      return a.playerId.localeCompare(b.playerId);
    });

  const top = candidates[0];
  if (!top) return null;

  return {
    playerId: top.playerId,
    teamId: top.teamId,
    statLine: top.statLine,
    compactLine: config.formatCompact(top.statLine),
    primaryValue: config.primaryValue(top),
  };
}

const GROUP_CONFIGS: GroupConfig[] = [
  {
    key: "passing",
    label: "Passing",
    primaryValue: (l) => l.statLine.passing?.yards ?? 0,
    formatCompact: (s) => {
      const p = s.passing!;
      const parts = [`${p.comp}/${p.att}`, `${p.yards} yds`];
      if (p.td) parts.push(`${p.td} TD`);
      if (p.int) parts.push(`${p.int} INT`);
      return parts.join(", ");
    },
  },
  {
    key: "rushing",
    label: "Rushing",
    primaryValue: (l) => l.statLine.rushing?.yards ?? 0,
    formatCompact: (s) => {
      const r = s.rushing!;
      const parts = [`${r.carries} car`, `${r.yards} yds`];
      if (r.td) parts.push(`${r.td} TD`);
      return parts.join(", ");
    },
  },
  {
    key: "receiving",
    label: "Receiving",
    primaryValue: (l) => l.statLine.receiving?.yards ?? 0,
    formatCompact: (s) => {
      const r = s.receiving!;
      const parts = [`${r.rec} rec`, `${r.yards} yds`];
      if (r.td) parts.push(`${r.td} TD`);
      return parts.join(", ");
    },
  },
  {
    key: "defense",
    label: "Defense",
    primaryValue: (l) => {
      const d = l.statLine.defense;
      if (!d) return 0;
      return (d.tacklesSolo ?? 0) + (d.tacklesAst ?? 0);
    },
    formatCompact: (s) => {
      const d = s.defense!;
      const tkls = (d.tacklesSolo ?? 0) + (d.tacklesAst ?? 0);
      const parts = [`${tkls} tkl`];
      if (d.sacks) parts.push(`${d.sacks} sack`);
      if (d.int) parts.push(`${d.int} INT`);
      return parts.join(", ");
    },
  },
  {
    key: "kicking",
    label: "Kicking",
    primaryValue: (l) => {
      const k = l.statLine.kicking;
      if (!k) return 0;
      return (k.fgMade ?? 0) * 3 + (k.xpMade ?? 0);
    },
    formatCompact: (s) => {
      const k = s.kicking!;
      const parts: string[] = [];
      if (k.fgAtt) parts.push(`${k.fgMade}/${k.fgAtt} FG`);
      if (k.xpAtt) parts.push(`${k.xpMade}/${k.xpAtt} XP`);
      return parts.join(", ");
    },
  },
  {
    key: "punting",
    label: "Punting",
    primaryValue: (l) => {
      const p = l.statLine.punting;
      if (!p || (p.punts ?? 0) === 0) return 0;
      return (p.yards ?? 0) / (p.punts ?? 1);
    },
    formatCompact: (s) => {
      const p = s.punting!;
      const punts = p.punts ?? 0;
      const yards = p.yards ?? 0;
      const avg = punts > 0 ? (yards / punts).toFixed(1) : "0.0";
      return `${punts} punts, ${avg} avg`;
    },
  },
  {
    key: "returns",
    label: "Returns",
    primaryValue: (l) => {
      const r = l.statLine.returns;
      if (!r) return 0;
      return (r.krYards ?? 0) + (r.prYards ?? 0);
    },
    formatCompact: (s) => {
      const r = s.returns!;
      const count = (r.krCount ?? 0) + (r.prCount ?? 0);
      const yards = (r.krYards ?? 0) + (r.prYards ?? 0);
      const parts = [`${count} ret`, `${yards} yds`];
      const td = (r.krTd ?? 0) + (r.prTd ?? 0);
      if (td) parts.push(`${td} TD`);
      return parts.join(", ");
    },
  },
  {
    key: "ballSecurity",
    label: "Ball security",
    primaryValue: (l) => l.statLine.ballSecurity?.fumbles ?? 0,
    formatCompact: (s) => {
      const b = s.ballSecurity!;
      const parts: string[] = [];
      if (b.fumbles) parts.push(`${b.fumbles} FUM`);
      if (b.fumblesLost) parts.push(`${b.fumblesLost} lost`);
      return parts.join(", ");
    },
  },
];

export function playerStatsAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): DerivedPlayerStatLine[] {
  const map = new Map<string, MutableLine>();
  const teamByPlayer = new Map<string, string>();
  const end = Math.min(playIndex, plays.length);

  for (let i = 0; i < end; i++) {
    const play = plays[i];
    for (const p of play.participants) {
      teamByPlayer.set(p.playerId, p.teamId);
    }
    applyPlay(map, play);
  }

  return [...map.entries()].map(([playerId, line]) => ({
    playerId,
    teamId: teamByPlayer.get(playerId) ?? log.homeTeamId,
    statLine: pruneLine(line),
  }));
}

export function leadersByCategory(
  lines: DerivedPlayerStatLine[],
  homeTeamId: string,
  awayTeamId: string,
): StatGroupLeaders[] {
  const result: StatGroupLeaders[] = [];

  for (const config of GROUP_CONFIGS) {
    const home = pickTeamLeader(lines, homeTeamId, config);
    const away = pickTeamLeader(lines, awayTeamId, config);
    if (!home && !away) continue;
    result.push({
      group: config.key,
      label: config.label,
      home,
      away,
    });
  }

  return result;
}

/** Normalize stat lines for order-insensitive comparison in tests. */
export function normalizeStatLines(
  lines: DerivedPlayerStatLine[],
): DerivedPlayerStatLine[] {
  return [...lines].sort((a, b) => a.playerId.localeCompare(b.playerId));
}
