import type { PlayerGameStatLine } from "@sports-management/shared-types";
import type { PbpGameLog, PbpPlay, PbpParticipantRole } from "./types";

export interface DerivedPlayerStatLine {
  playerId: string;
  teamId: string;
  statLine: PlayerGameStatLine;
}

type MutableLine = {
  passing: Required<NonNullable<PlayerGameStatLine["passing"]>>;
  rushing: Required<NonNullable<PlayerGameStatLine["rushing"]>>;
  receiving: Required<NonNullable<PlayerGameStatLine["receiving"]>>;
  defense: Required<NonNullable<PlayerGameStatLine["defense"]>>;
  kicking: Required<NonNullable<PlayerGameStatLine["kicking"]>>;
  punting: Required<NonNullable<PlayerGameStatLine["punting"]>>;
  returns: Required<NonNullable<PlayerGameStatLine["returns"]>>;
  ballSecurity: Required<NonNullable<PlayerGameStatLine["ballSecurity"]>>;
};

function emptyLine(): MutableLine {
  return {
    passing: { comp: 0, att: 0, yards: 0, td: 0, int: 0, sacked: 0 },
    rushing: { carries: 0, yards: 0, td: 0, long: 0 },
    receiving: { rec: 0, yards: 0, td: 0, long: 0, targets: 0 },
    defense: {
      tacklesSolo: 0,
      tacklesAst: 0,
      tfl: 0,
      sacks: 0,
      int: 0,
      passDef: 0,
      ff: 0,
      fr: 0,
      defTd: 0,
    },
    kicking: { fgMade: 0, fgAtt: 0, xpMade: 0, xpAtt: 0 },
    punting: { punts: 0, yards: 0, long: 0 },
    returns: {
      krCount: 0,
      krYards: 0,
      krTd: 0,
      prCount: 0,
      prYards: 0,
      prTd: 0,
    },
    ballSecurity: { fumbles: 0, fumblesLost: 0 },
  };
}

function getLine(
  map: Map<string, MutableLine>,
  playerId: string,
): MutableLine {
  let line = map.get(playerId);
  if (!line) {
    line = emptyLine();
    map.set(playerId, line);
  }
  return line;
}

function findParticipant(
  play: PbpPlay,
  role: PbpParticipantRole,
): { playerId: string; teamId: string } | null {
  const p = play.participants.find((x) => x.role === role);
  return p ? { playerId: p.playerId, teamId: p.teamId } : null;
}

function bumpLong(current: number, value: number): number {
  return Math.max(current, value);
}

function isNegativePlay(play: PbpPlay): boolean {
  return play.yardsGained < 0 && (play.playType === "rush" || play.playType === "sack");
}

function applyPlay(
  map: Map<string, MutableLine>,
  play: PbpPlay,
): void {
  switch (play.playType) {
    case "kickoff": {
      const kicker = findParticipant(play, "kicker");
      const returner = findParticipant(play, "returner");
      if (returner) {
        const line = getLine(map, returner.playerId);
        line.returns.krCount += 1;
        line.returns.krYards += play.yardsGained;
        if (play.isScoring) line.returns.krTd += 1;
      }
      void kicker;
      break;
    }
    case "punt": {
      const punter = findParticipant(play, "kicker");
      const returner = findParticipant(play, "returner");
      if (punter) {
        const line = getLine(map, punter.playerId);
        line.punting.punts += 1;
        line.punting.yards += play.yardsGained;
        line.punting.long = bumpLong(line.punting.long, play.yardsGained);
      }
      if (returner) {
        const line = getLine(map, returner.playerId);
        line.returns.prCount += 1;
        line.returns.prYards += Math.max(0, Math.round(play.yardsGained * 0.25));
        if (play.isScoring) line.returns.prTd += 1;
      }
      break;
    }
    case "field_goal":
    case "field_goal_miss": {
      const kicker = findParticipant(play, "kicker");
      if (kicker) {
        const line = getLine(map, kicker.playerId);
        line.kicking.fgAtt += 1;
        if (play.playType === "field_goal") line.kicking.fgMade += 1;
      }
      break;
    }
    case "extra_point":
    case "extra_point_miss": {
      const kicker = findParticipant(play, "kicker");
      if (kicker) {
        const line = getLine(map, kicker.playerId);
        line.kicking.xpAtt += 1;
        if (play.playType === "extra_point") line.kicking.xpMade += 1;
      }
      break;
    }
    case "rush":
    case "kneel": {
      const rusher = findParticipant(play, "rusher");
      if (rusher) {
        const line = getLine(map, rusher.playerId);
        line.rushing.carries += 1;
        line.rushing.yards += play.yardsGained;
        line.rushing.long = bumpLong(line.rushing.long, play.yardsGained);
        if (play.isScoring) line.rushing.td += 1;
      }
      creditDefense(map, play);
      creditFumble(map, play);
      break;
    }
    case "pass_complete": {
      const passer = findParticipant(play, "passer");
      const receiver = findParticipant(play, "receiver");
      if (passer) {
        const line = getLine(map, passer.playerId);
        line.passing.att += 1;
        line.passing.comp += 1;
        line.passing.yards += play.yardsGained;
        if (play.isScoring) line.passing.td += 1;
      }
      if (receiver) {
        const line = getLine(map, receiver.playerId);
        line.receiving.targets += 1;
        line.receiving.rec += 1;
        line.receiving.yards += play.yardsGained;
        line.receiving.long = bumpLong(line.receiving.long, play.yardsGained);
        if (play.isScoring) line.receiving.td += 1;
      }
      creditDefense(map, play);
      break;
    }
    case "pass_incomplete": {
      const passer = findParticipant(play, "passer");
      const receiver = findParticipant(play, "receiver");
      if (passer) {
        getLine(map, passer.playerId).passing.att += 1;
      }
      if (receiver) {
        getLine(map, receiver.playerId).receiving.targets += 1;
      }
      const pd = findParticipant(play, "pass_defender");
      if (pd) getLine(map, pd.playerId).defense.passDef += 1;
      break;
    }
    case "sack": {
      const passer = findParticipant(play, "passer");
      const sacker = findParticipant(play, "sacker");
      if (passer) {
        const line = getLine(map, passer.playerId);
        line.passing.att += 1;
        line.passing.sacked += 1;
        line.passing.yards += play.yardsGained;
      }
      if (sacker) {
        const line = getLine(map, sacker.playerId);
        line.defense.sacks += 1;
        if (isNegativePlay(play)) line.defense.tfl += 1;
      }
      break;
    }
    case "interception": {
      const passer = findParticipant(play, "passer");
      const receiver = findParticipant(play, "receiver");
      const interceptor = findParticipant(play, "interceptor");
      if (passer) {
        const line = getLine(map, passer.playerId);
        line.passing.att += 1;
        line.passing.int += 1;
      }
      if (receiver) {
        getLine(map, receiver.playerId).receiving.targets += 1;
      }
      if (interceptor) {
        getLine(map, interceptor.playerId).defense.int += 1;
      }
      break;
    }
    default:
      break;
  }
}

function creditDefense(map: Map<string, MutableLine>, play: PbpPlay): void {
  const solo = play.participants.filter((p) => p.role === "tackler_solo");
  const ast = play.participants.filter((p) => p.role === "tackler_ast");
  for (const p of solo) {
    const line = getLine(map, p.playerId);
    line.defense.tacklesSolo += 1;
    if (isNegativePlay(play)) line.defense.tfl += 1;
  }
  for (const p of ast) {
    getLine(map, p.playerId).defense.tacklesAst += 1;
  }
}

function creditFumble(map: Map<string, MutableLine>, play: PbpPlay): void {
  const fumbler = findParticipant(play, "fumbler");
  const recoverer = findParticipant(play, "recoverer");
  if (fumbler) {
    const line = getLine(map, fumbler.playerId);
    line.ballSecurity.fumbles += 1;
    line.ballSecurity.fumblesLost += 1;
  }
  if (recoverer) {
    const line = getLine(map, recoverer.playerId);
    line.defense.fr += 1;
    if (fumbler) line.defense.ff += 1;
  }
}

function pruneLine(line: MutableLine): PlayerGameStatLine {
  const out: PlayerGameStatLine = {};
  const groups: (keyof MutableLine)[] = [
    "passing",
    "rushing",
    "receiving",
    "defense",
    "kicking",
    "punting",
    "returns",
    "ballSecurity",
  ];
  for (const group of groups) {
    const values = line[group];
    const hasActivity = Object.values(values).some((v) => v !== 0);
    if (hasActivity) out[group] = { ...values };
  }
  return out;
}

export function deriveStatLines(log: PbpGameLog): DerivedPlayerStatLine[] {
  const map = new Map<string, MutableLine>();
  const teamByPlayer = new Map<string, string>();

  for (const drive of log.drives) {
    for (const play of drive.plays) {
      for (const p of play.participants) {
        teamByPlayer.set(p.playerId, p.teamId);
      }
      applyPlay(map, play);
    }
  }

  return [...map.entries()].map(([playerId, line]) => ({
    playerId,
    teamId: teamByPlayer.get(playerId) ?? log.homeTeamId,
    statLine: pruneLine(line),
  }));
}

export function allPlays(log: PbpGameLog): PbpPlay[] {
  return log.drives.flatMap((d) => d.plays);
}

export function sumTeamStatGroup(
  lines: DerivedPlayerStatLine[],
  teamId: string,
  group: keyof PlayerGameStatLine,
  field: string,
): number {
  return lines
    .filter((l) => l.teamId === teamId)
    .reduce((sum, l) => {
      const g = l.statLine[group] as Record<string, number> | undefined;
      return sum + (g?.[field] ?? 0);
    }, 0);
}
