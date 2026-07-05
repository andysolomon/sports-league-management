import { mulberry32 } from "@/lib/simulate-game";
import type {
  PbpDrive,
  PbpDriveEndReason,
  PbpGameInput,
  PbpGameLog,
  PbpParticipant,
  PbpParticipantRole,
  PbpPlay,
  PbpPlayType,
  PlayerSimProfile,
  SimPositionGroup,
  TeamSimProfile,
} from "./types";

const QUARTER_SECONDS = 720;
const OT_SECONDS = 300;
const HOME_FIELD_EDGE = 2.5;
const STRENGTH_WEIGHT = 0.26;
const BASELINE_STRENGTH = 50;

const POSITION_TO_GROUP: Record<string, SimPositionGroup> = {
  QB: "QB",
  HB: "RB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  DL: "DL",
  OLB: "LB",
  MLB: "LB",
  ILB: "LB",
  LB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  NB: "DB",
  DB: "DB",
  K: "K",
  P: "P",
};

interface GameState {
  rand: () => number;
  home: TeamSimProfile;
  away: TeamSimProfile;
  decisive: boolean;
  quarter: number;
  clockSeconds: number;
  possession: "home" | "away";
  down: number;
  distance: number;
  fieldPosition: number;
  homeScore: number;
  awayScore: number;
  drives: PbpDrive[];
  currentDrivePlays: PbpPlay[];
  currentDriveTeamId: string | null;
  driveStartQuarter: number;
  driveStartClock: number;
  driveStartField: number;
  driveId: number;
  playId: number;
  inOvertime: boolean;
  otPeriod: number;
  gameOver: boolean;
  openingKickDone: boolean;
  secondHalfKickPending: boolean;
}

function positionGroup(position: string): SimPositionGroup | null {
  return POSITION_TO_GROUP[position.trim().toUpperCase()] ?? null;
}

function offenseTeam(state: GameState): TeamSimProfile {
  return state.possession === "home" ? state.home : state.away;
}

function defenseTeam(state: GameState): TeamSimProfile {
  return state.possession === "home" ? state.away : state.home;
}

function offenseTeamId(state: GameState): string {
  return offenseTeam(state).teamId;
}

function defenseTeamId(state: GameState): string {
  return defenseTeam(state).teamId;
}

function effectiveStrength(
  team: TeamSimProfile,
  isHome: boolean,
  oppStrength: number,
): number {
  const homeEdge = isHome ? HOME_FIELD_EDGE / STRENGTH_WEIGHT : 0;
  return team.strength + (team.strength - oppStrength) * 0.15 + homeEdge;
}

function matchupEdge(state: GameState): number {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const offIsHome = state.possession === "home";
  const offEff = effectiveStrength(
    off,
    offIsHome,
    def.strength,
  );
  const defEff = effectiveStrength(
    def,
    !offIsHome,
    off.strength,
  );
  return (offEff - defEff) / 99;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function weightedPick(
  players: PlayerSimProfile[],
  rand: () => number,
): PlayerSimProfile {
  const weights = players.map((p) => Math.max(1, p.overall));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function playersInGroup(
  team: TeamSimProfile,
  group: SimPositionGroup,
): PlayerSimProfile[] {
  return team.players
    .filter((p) => positionGroup(p.position) === group)
    .sort((a, b) => {
      const da = a.depthRank ?? 99;
      const db = b.depthRank ?? 99;
      if (da !== db) return da - db;
      return b.overall - a.overall;
    });
}

function selectPlayer(
  team: TeamSimProfile,
  group: SimPositionGroup,
  rand: () => number,
  distribute = false,
): PlayerSimProfile {
  const candidates = playersInGroup(team, group);
  if (candidates.length === 0) {
    return {
      playerId: `${team.teamId}-unknown-${group}`,
      position: group,
      overall: BASELINE_STRENGTH,
    };
  }
  if (distribute && candidates.length > 1) {
    return weightedPick(candidates.slice(0, Math.min(4, candidates.length)), rand);
  }
  return candidates[0];
}

function selectDefender(
  team: TeamSimProfile,
  rand: () => number,
  kind: "tackle" | "sack" | "coverage",
): PlayerSimProfile {
  const weights =
    kind === "sack"
      ? { DL: 0.55, LB: 0.3, DB: 0.15 }
      : kind === "coverage"
        ? { DL: 0.1, LB: 0.25, DB: 0.65 }
        : { DL: 0.35, LB: 0.35, DB: 0.3 };
  const r = rand();
  let group: SimPositionGroup = "LB";
  if (r < weights.DL) group = "DL";
  else if (r < weights.DL + weights.LB) group = "LB";
  else group = "DB";
  return selectPlayer(team, group, rand, true);
}

function participant(
  player: PlayerSimProfile,
  teamId: string,
  role: PbpParticipantRole,
): PbpParticipant {
  return { playerId: player.playerId, teamId, role };
}

function startDrive(
  state: GameState,
  teamId: string,
  fieldPosition: number,
): void {
  state.currentDriveTeamId = teamId;
  state.currentDrivePlays = [];
  state.driveStartQuarter = state.quarter;
  state.driveStartClock = state.clockSeconds;
  state.driveStartField = fieldPosition;
  state.down = 1;
  state.distance = 10;
  state.fieldPosition = fieldPosition;
}

function endDrive(state: GameState, reason: PbpDriveEndReason): void {
  if (state.currentDriveTeamId === null) return;
  state.drives.push({
    driveId: state.driveId,
    teamId: state.currentDriveTeamId,
    startQuarter: state.driveStartQuarter,
    startClockSeconds: state.driveStartClock,
    startFieldPosition: state.driveStartField,
    endReason: reason,
    plays: state.currentDrivePlays,
  });
  state.driveId += 1;
  state.currentDriveTeamId = null;
  state.currentDrivePlays = [];
}

function recordPlay(state: GameState, play: PbpPlay): void {
  state.currentDrivePlays.push(play);
  state.playId += 1;
}

function tickClock(state: GameState, seconds: number): void {
  state.clockSeconds = Math.max(0, state.clockSeconds - seconds);
}

function flipPossession(state: GameState): void {
  state.possession = state.possession === "home" ? "away" : "home";
}

function yardsToGoal(state: GameState): number {
  return 100 - state.fieldPosition;
}

function shouldKneel(state: GameState): boolean {
  const winning =
    (state.possession === "home" && state.homeScore > state.awayScore) ||
    (state.possession === "away" && state.awayScore > state.homeScore);
  return winning && state.clockSeconds <= 120 && state.quarter >= 4;
}

function advanceQuarter(state: GameState): void {
  if (state.inOvertime) {
    state.otPeriod += 1;
    state.clockSeconds = OT_SECONDS;
    return;
  }
  if (state.quarter === 2) {
    state.secondHalfKickPending = true;
  }
  state.quarter += 1;
  state.clockSeconds = QUARTER_SECONDS;
}

function checkPeriodEnd(state: GameState): void {
  if (state.clockSeconds > 0) return;

  if (state.currentDriveTeamId !== null && state.currentDrivePlays.length > 0) {
    endDrive(state, state.quarter === 4 && !state.inOvertime ? "end_of_game" : "end_of_half");
  }

  if (state.inOvertime) {
    if (!state.decisive || state.homeScore !== state.awayScore) {
      state.gameOver = true;
      return;
    }
    advanceQuarter(state);
    doKickoff(state, state.possession === "home" ? "away" : "home");
    return;
  }

  if (state.quarter >= 4) {
    if (state.decisive && state.homeScore === state.awayScore) {
      state.inOvertime = true;
      state.otPeriod = 1;
      state.quarter = 5;
      state.clockSeconds = OT_SECONDS;
      doKickoff(state, state.possession === "home" ? "away" : "home");
      return;
    }
    state.gameOver = true;
    return;
  }

  advanceQuarter(state);
  if (state.secondHalfKickPending) {
    state.secondHalfKickPending = false;
    doKickoff(state, state.possession === "home" ? "away" : "home");
  }
}

function doKickoff(state: GameState, kicking: "home" | "away"): void {
  const kickingTeam = kicking === "home" ? state.home : state.away;
  const receiving = kicking === "home" ? state.away : state.home;
  const kicker = selectPlayer(kickingTeam, "K", state.rand);
  const returner = selectPlayer(receiving, "RB", state.rand, true);
  const edge = matchupEdge(state);
  const returnYards = Math.round(18 + state.rand() * 22 + edge * 8);
  const startField = clamp(returnYards, 15, 40);

  startDrive(state, kickingTeam.teamId, 35);
  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: kickingTeam.teamId,
    defenseTeamId: receiving.teamId,
    playType: "kickoff",
    down: 0,
    distance: 0,
    fieldPosition: 35,
    yardsGained: returnYards,
    isScoring: false,
    pointsScored: 0,
    isTurnover: true,
    participants: [
      participant(kicker, kickingTeam.teamId, "kicker"),
      participant(returner, receiving.teamId, "returner"),
    ],
  };
  recordPlay(state, play);
  tickClock(state, 6);
  endDrive(state, "turnover");

  state.possession = kicking === "home" ? "away" : "home";
  startDrive(state, receiving.teamId, startField);
  state.openingKickDone = true;
}

function doExtraPoint(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const kicker = selectPlayer(off, "K", state.rand);
  const edge = matchupEdge(state);
  const makeProb = clamp(0.94 + edge * 0.03, 0.88, 0.99);
  const made = state.rand() < makeProb;
  const playType: PbpPlayType = made ? "extra_point" : "extra_point_miss";

  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType,
    down: 0,
    distance: 0,
    fieldPosition: 98,
    yardsGained: 0,
    isScoring: made,
    pointsScored: made ? 1 : 0,
    isTurnover: false,
    participants: [participant(kicker, off.teamId, "kicker")],
  };
  recordPlay(state, play);
  if (made) {
    if (state.possession === "home") state.homeScore += 1;
    else state.awayScore += 1;
    if (state.inOvertime) state.gameOver = true;
  }
  tickClock(state, 4);
}

function doFieldGoalAttempt(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const kicker = selectPlayer(off, "K", state.rand);
  const dist = yardsToGoal(state) + 17;
  const edge = matchupEdge(state);
  const makeProb = clamp(0.92 - (dist - 30) * 0.02 + edge * 0.08, 0.35, 0.95);
  const made = state.rand() < makeProb;
  const playType: PbpPlayType = made ? "field_goal" : "field_goal_miss";

  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType,
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: 0,
    isScoring: made,
    pointsScored: made ? 3 : 0,
    isTurnover: !made,
    participants: [participant(kicker, off.teamId, "kicker")],
  };
  recordPlay(state, play);
  tickClock(state, 5);

  if (made) {
    if (state.possession === "home") state.homeScore += 3;
    else state.awayScore += 3;
    endDrive(state, "field_goal");
    if (state.inOvertime) {
      state.gameOver = true;
      return;
    }
    doKickoff(state, state.possession);
  } else {
    endDrive(state, "missed_field_goal");
    flipPossession(state);
    const spot = clamp(100 - state.fieldPosition, 20, 80);
    startDrive(state, offenseTeamId(state), spot);
  }
}

function doPunt(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const punter = selectPlayer(off, "P", state.rand);
  const returner = selectPlayer(def, "WR", state.rand, true);
  const gross = Math.round(38 + state.rand() * 12 - matchupEdge(state) * 10);
  const net = clamp(gross - Math.round(state.rand() * 8), 25, 55);
  const newField = clamp(100 - (state.fieldPosition + net), 15, 75);

  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: "punt",
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: net,
    isScoring: false,
    pointsScored: 0,
    isTurnover: true,
    participants: [
      participant(punter, off.teamId, "kicker"),
      participant(returner, def.teamId, "returner"),
    ],
  };
  recordPlay(state, play);
  tickClock(state, 7);
  endDrive(state, "punt");
  flipPossession(state);
  startDrive(state, offenseTeamId(state), newField);
}

function doRush(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const rusher = selectPlayer(off, "RB", state.rand, true);
  const edge = matchupEdge(state);
  const fumbleProb = clamp(0.01 - edge * 0.003, 0.003, 0.015);
  const tdProb = clamp(0.055 + edge * 0.08, 0.02, 0.15);
  const explosive = state.rand() < 0.08 + edge * 0.05;
  let yards = explosive
    ? Math.round(12 + state.rand() * 18)
    : Math.round(2 + state.rand() * 5 + edge * 4);
  yards = Math.max(-3, yards);

  const participants: PbpParticipant[] = [
    participant(rusher, off.teamId, "rusher"),
  ];
  const tackler = selectDefender(def, state.rand, "tackle");
  participants.push(participant(tackler, def.teamId, "tackler_solo"));
  if (state.rand() < 0.35) {
    const ast = selectDefender(def, state.rand, "tackle");
    participants.push(participant(ast, def.teamId, "tackler_ast"));
  }

  let isTurnover = false;
  let isScoring = false;
  let points = 0;

  if (state.rand() < fumbleProb) {
    isTurnover = true;
    yards = 0;
    const fumbler = rusher;
    const recoverer = selectDefender(def, state.rand, "tackle");
    participants.push(participant(fumbler, off.teamId, "fumbler"));
    participants.push(participant(recoverer, def.teamId, "recoverer"));
  } else if (state.fieldPosition + yards >= 100 && state.rand() < tdProb + (yards >= 15 ? 0.15 : 0)) {
    yards = 100 - state.fieldPosition;
    isScoring = true;
    points = 6;
  }

  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: "rush",
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: yards,
    isScoring,
    pointsScored: points,
    isTurnover,
    participants,
  };
  recordPlay(state, play);
  tickClock(state, Math.round(22 + state.rand() * 18));
  applyPlayResult(state, yards, isScoring, points, isTurnover);
}

function doPass(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const passer = selectPlayer(off, "QB", state.rand);
  const receiver = selectPlayer(off, "WR", state.rand, true);
  const edge = matchupEdge(state);
  const sackProb = clamp(0.07 - edge * 0.03, 0.03, 0.12);
  const intProb = clamp(0.025 - edge * 0.01, 0.008, 0.04);

  if (state.rand() < sackProb) {
    const sacker = selectDefender(def, state.rand, "sack");
    const yards = -Math.round(3 + state.rand() * 6);
    const play: PbpPlay = {
      playId: state.playId,
      driveId: state.driveId,
      quarter: state.quarter,
      clockSeconds: state.clockSeconds,
      offenseTeamId: off.teamId,
      defenseTeamId: def.teamId,
      playType: "sack",
      down: state.down,
      distance: state.distance,
      fieldPosition: state.fieldPosition,
      yardsGained: yards,
      isScoring: false,
      pointsScored: 0,
      isTurnover: false,
      participants: [
        participant(passer, off.teamId, "passer"),
        participant(sacker, def.teamId, "sacker"),
      ],
    };
    recordPlay(state, play);
    tickClock(state, Math.round(24 + state.rand() * 12));
    applyPlayResult(state, yards, false, 0, false);
    return;
  }

  if (state.rand() < intProb) {
    const interceptor = selectDefender(def, state.rand, "coverage");
    const returnYards = Math.round(state.rand() * 20);
    const play: PbpPlay = {
      playId: state.playId,
      driveId: state.driveId,
      quarter: state.quarter,
      clockSeconds: state.clockSeconds,
      offenseTeamId: off.teamId,
      defenseTeamId: def.teamId,
      playType: "interception",
      down: state.down,
      distance: state.distance,
      fieldPosition: state.fieldPosition,
      yardsGained: returnYards,
      isScoring: false,
      pointsScored: 0,
      isTurnover: true,
      participants: [
        participant(passer, off.teamId, "passer"),
        participant(receiver, off.teamId, "receiver"),
        participant(interceptor, def.teamId, "interceptor"),
      ],
    };
    recordPlay(state, play);
    tickClock(state, Math.round(20 + state.rand() * 10));
    endDrive(state, "turnover");
    flipPossession(state);
    const spot = clamp(100 - state.fieldPosition + returnYards, 15, 85);
    startDrive(state, offenseTeamId(state), spot);
    return;
  }

  const completeProb = clamp(0.6 + edge * 0.14, 0.45, 0.8);
  const complete = state.rand() < completeProb;
  if (!complete) {
    const pd = state.rand() < 0.12 ? selectDefender(def, state.rand, "coverage") : null;
    const participants: PbpParticipant[] = [
      participant(passer, off.teamId, "passer"),
      participant(receiver, off.teamId, "receiver"),
    ];
    if (pd) participants.push(participant(pd, def.teamId, "pass_defender"));
    const play: PbpPlay = {
      playId: state.playId,
      driveId: state.driveId,
      quarter: state.quarter,
      clockSeconds: state.clockSeconds,
      offenseTeamId: off.teamId,
      defenseTeamId: def.teamId,
      playType: "pass_incomplete",
      down: state.down,
      distance: state.distance,
      fieldPosition: state.fieldPosition,
      yardsGained: 0,
      isScoring: false,
      pointsScored: 0,
      isTurnover: false,
      participants,
    };
    recordPlay(state, play);
    tickClock(state, Math.round(18 + state.rand() * 10));
    applyPlayResult(state, 0, false, 0, false);
    return;
  }

  const explosive = state.rand() < 0.1 + edge * 0.06;
  let yards = explosive
    ? Math.round(15 + state.rand() * 25)
    : Math.round(4 + state.rand() * 9 + edge * 5);
  let isScoring = false;
  let points = 0;
  const participants: PbpParticipant[] = [
    participant(passer, off.teamId, "passer"),
    participant(receiver, off.teamId, "receiver"),
  ];
  const tackler = selectDefender(def, state.rand, "tackle");
  participants.push(participant(tackler, def.teamId, "tackler_solo"));
  if (state.rand() < 0.3) {
    participants.push(
      participant(selectDefender(def, state.rand, "tackle"), def.teamId, "tackler_ast"),
    );
  }

  if (state.fieldPosition + yards >= 100) {
    yards = 100 - state.fieldPosition;
    isScoring = true;
    points = 6;
  }

  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: "pass_complete",
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: yards,
    isScoring,
    pointsScored: points,
    isTurnover: false,
    participants,
  };
  recordPlay(state, play);
  tickClock(state, Math.round(20 + state.rand() * 18));
  applyPlayResult(state, yards, isScoring, points, false);
}

function doKneel(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const rusher = selectPlayer(off, "QB", state.rand);
  const play: PbpPlay = {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: "kneel",
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: -1,
    isScoring: false,
    pointsScored: 0,
    isTurnover: false,
    participants: [participant(rusher, off.teamId, "rusher")],
  };
  recordPlay(state, play);
  tickClock(state, 38);
  applyPlayResult(state, -1, false, 0, false);
}

function applyPlayResult(
  state: GameState,
  yards: number,
  isScoring: boolean,
  points: number,
  isTurnover: boolean,
): void {
  if (isTurnover) {
    endDrive(state, "turnover");
    flipPossession(state);
    const spot = clamp(100 - state.fieldPosition, 20, 80);
    startDrive(state, offenseTeamId(state), spot);
    return;
  }

  state.fieldPosition = clamp(state.fieldPosition + yards, 1, 99);

  if (isScoring) {
    if (state.possession === "home") state.homeScore += points;
    else state.awayScore += points;
    if (points === 6) {
      doExtraPoint(state);
    }
    endDrive(state, points === 6 ? "touchdown" : "field_goal");
    if (state.inOvertime && points === 6) {
      if (!state.gameOver) doKickoff(state, state.possession);
      return;
    }
    if (state.inOvertime) return;
    doKickoff(state, state.possession);
    return;
  }

  if (yards >= state.distance) {
    state.down = 1;
    state.distance = Math.min(10, 100 - state.fieldPosition);
    if (state.distance <= 0) state.distance = 1;
  } else {
    state.down += 1;
    state.distance -= yards;
    if (state.down > 4) {
      endDrive(state, "downs");
      flipPossession(state);
      startDrive(state, offenseTeamId(state), clamp(100 - state.fieldPosition, 20, 80));
    }
  }
}

function runScrimmagePlay(state: GameState): void {
  if (shouldKneel(state)) {
    doKneel(state);
    return;
  }

  if (state.down === 4) {
    const ytg = yardsToGoal(state);
    if (ytg <= 35 && ytg >= 18) {
      doFieldGoalAttempt(state);
      return;
    }
    if (ytg > 45 || (ytg > 35 && state.rand() < 0.75)) {
      doPunt(state);
      return;
    }
    if (state.rand() < 0.35 + matchupEdge(state) * 0.2) {
      if (state.rand() < 0.45) doRush(state);
      else doPass(state);
      return;
    }
    doPunt(state);
    return;
  }

  const edge = matchupEdge(state);
  const passRate = clamp(0.52 + edge * 0.1 - (state.down === 1 ? 0 : 0.08), 0.38, 0.68);
  if (state.rand() < passRate) doPass(state);
  else doRush(state);
}

function simulateGameLog(input: PbpGameInput): PbpGameLog {
  const rand = mulberry32(input.seed >>> 0);
  const state: GameState = {
    rand,
    home: input.home,
    away: input.away,
    decisive: input.decisive ?? false,
    quarter: 1,
    clockSeconds: QUARTER_SECONDS,
    possession: "home",
    down: 1,
    distance: 10,
    fieldPosition: 25,
    homeScore: 0,
    awayScore: 0,
    drives: [],
    currentDrivePlays: [],
    currentDriveTeamId: null,
    driveStartQuarter: 1,
    driveStartClock: QUARTER_SECONDS,
    driveStartField: 25,
    driveId: 1,
    playId: 1,
    inOvertime: false,
    otPeriod: 0,
    gameOver: false,
    openingKickDone: false,
    secondHalfKickPending: false,
  };

  doKickoff(state, "away");

  let safety = 0;
  while (!state.gameOver && safety < 500) {
    safety += 1;
    if (state.clockSeconds <= 0) {
      checkPeriodEnd(state);
      continue;
    }
    if (state.currentDriveTeamId === null) {
      startDrive(state, offenseTeamId(state), state.fieldPosition);
    }
    runScrimmagePlay(state);
    if (state.clockSeconds <= 0) checkPeriodEnd(state);
  }

  if (state.currentDriveTeamId !== null && state.currentDrivePlays.length > 0) {
    endDrive(state, state.gameOver ? "end_of_game" : "turnover");
  }

  return {
    seed: input.seed,
    decisive: state.decisive,
    homeTeamId: input.home.teamId,
    awayTeamId: input.away.teamId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    drives: state.drives,
  };
}

export { simulateGameLog, positionGroup, POSITION_TO_GROUP };
