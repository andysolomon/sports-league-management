import { mulberry32 } from "@/lib/simulate-game";
import {
  DEFAULT_SIMULATION_FLAVOR,
  normalizeSimulationFlavor,
  weightsForFlavor,
} from "@/lib/simulation-flavor";
import { acceptOrDecline, meanAwareness, rollPenalty } from "./penalties";
import {
  chargeSnap,
  snapCost,
  staminaDecay,
  staminaFor,
  substitutionCandidate,
  type SnapLedger,
} from "./fatigue";
import { contactFactor, rollInjury } from "./injuries";
import {
  NEUTRAL_AGGRESSION,
  clockStrategy,
  fourthDownDecision,
  runoffSeconds,
  secondsLeftInGame,
  secondsLeftInHalf,
  shouldOnside,
  shouldSpike,
  shouldUseTimeout,
  type ClockStrategy,
} from "./situational";
import { homeFieldEdge as crowdHomeFieldEdge } from "./crowd";
import {
  NEUTRAL_SCHEME_MODIFIERS,
  schemeModifiers,
  type SchemeModifiers,
} from "./schemes";
import {
  NEUTRAL_MODIFIERS,
  weatherModifiers,
  type WeatherModifiers,
} from "./weather";
import type {
  GameInjury,
  PbpFeatureGates,
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
/*
 * Recalibrated home-field weight (A3, gated by `features.balance`; issue #642).
 *
 * The 2.5 above is not "2.5 points" — it is a strength bonus that flows into
 * `matchupEdge`, which then biases explosive-play rate, yardage, touchdown
 * probability, completion rate, sack rate, interception rate, field-goal
 * accuracy, kick returns and punt distance. Eight channels, every play. The
 * measured result was a 6.2-point average margin and a 67.3% home win rate for
 * two identical rosters, which is not a nudge, it is a decision.
 *
 * The constant is scaled down until the OUTPUT matches what the input claims.
 * `scripts/dist-check.ts` is the instrument; re-run it if you touch this.
 */
const HOME_FIELD_EDGE_V2 = 0.75;
const BASELINE_STRENGTH = 50;

/** HS overtime: one timeout per period, not the three a half carries. */
const TIMEOUTS_PER_HALF = 3;
const TIMEOUTS_PER_OVERTIME = 1;

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
  /*
   * v2 mechanics (Epic A). EVERY branch guarded by one of these must consume
   * ZERO random draws when the gate is off — the PRNG is a sequence, so one
   * stray `rand()` shifts every later draw and the log diverges from v1. The
   * golden-parity test exists to catch exactly that.
   */
  features: Required<PbpFeatureGates>;
  /** Accumulated snap cost per player for this game (A4). */
  snaps: SnapLedger;
  /** Players whose game ended through injury (A4). */
  unavailable: Set<string>;
  /** Injuries sustained in this game, in order (A4). */
  injuries: GameInjury[];
  /** League severity dial, 0 disables injuries entirely (A4). */
  injurySeverityScale: number;
  home: TeamSimProfile;
  away: TeamSimProfile;
  strengthWeight: number;
  edgeScale: number;
  /** `HOME_FIELD_EDGE`, or the recalibrated value under `features.balance`. */
  homeFieldEdge: number;
  /**
   * Weather multipliers (A5), or `NEUTRAL_MODIFIERS` when the gate is off.
   *
   * Held as resolved multipliers rather than as the `Weather` itself so the
   * play functions multiply unconditionally instead of branching. Every neutral
   * value is exactly 1, and multiplying by 1 is exact in floating point, so the
   * gate-off path is bit-identical to v1 without a single `if`.
   */
  weatherMods: WeatherModifiers;
  /**
   * Scheme multipliers (A6), one per possession side.
   *
   * TWO of them, unlike weather: a matchup is asymmetric. When the home team
   * has the ball the modifiers come from the home offense against the away
   * defense, and vice versa — so a team can run an Air Raid and a 46 without
   * the two interfering.
   *
   * Resolved once at kickoff and, like `weatherMods`, held as multipliers so
   * the play functions apply them unconditionally. Every neutral value is
   * exactly 1 (or 0 for the additive term), so the gate-off path is bit-
   * identical to pre-A6 without a branch.
   */
  homeSchemeMods: SchemeModifiers;
  awaySchemeMods: SchemeModifiers;
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
  /*
   * ── A3 clock and timeout state ──────────────────────────────────────────
   *
   * Only read inside `features.situational` branches. They are always present
   * on the state (rather than optional) so the type stays simple; when the gate
   * is off nothing reads them and nothing writes them except the resets.
   */
  homeTimeouts: number;
  awayTimeouts: number;
  /**
   * Did the last play leave the clock stopped?
   *
   * This is what makes a timeout physical rather than a resource dump: you can
   * only spend one while the clock is actually running, so a team cannot burn
   * all three between two snaps.
   */
  clockStopped: boolean;
  /**
   * Tempo to stamp on the next recorded play, or null.
   *
   * Set just before a play runs rather than patched on afterwards, because a
   * scoring play calls `endDrive` and moves itself out of `currentDrivePlays` —
   * so there is no reliable index to write back to once the play has happened.
   */
  pendingTempo: "hurry_up" | "burn" | null;
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

/** Scheme modifiers for whoever currently has the ball (A6). */
function schemeMods(state: GameState): SchemeModifiers {
  return state.possession === "home"
    ? state.homeSchemeMods
    : state.awaySchemeMods;
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
  strengthWeight: number,
  homeFieldEdge: number,
): number {
  const homeEdge = isHome ? homeFieldEdge / strengthWeight : 0;
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
    state.strengthWeight,
    state.homeFieldEdge,
  );
  const defEff = effectiveStrength(
    def,
    !offIsHome,
    off.strength,
    state.strengthWeight,
    state.homeFieldEdge,
  );
  return ((offEff - defEff) / 99) * state.edgeScale;
}

/*
 * ── A3 situational helpers ──────────────────────────────────────────────────
 */

/** Score from the possessing team's point of view. */
function offenseScoreDiff(state: GameState): number {
  return state.possession === "home"
    ? state.homeScore - state.awayScore
    : state.awayScore - state.homeScore;
}

function coachAggression(team: TeamSimProfile): number {
  const value = team.coach?.aggression;
  return typeof value === "number" ? value : NEUTRAL_AGGRESSION;
}

function timeoutsFor(state: GameState, side: "home" | "away"): number {
  return side === "home" ? state.homeTimeouts : state.awayTimeouts;
}

function spendTimeout(state: GameState, side: "home" | "away"): void {
  if (side === "home") state.homeTimeouts = Math.max(0, state.homeTimeouts - 1);
  else state.awayTimeouts = Math.max(0, state.awayTimeouts - 1);
}

function currentClockStrategy(state: GameState): ClockStrategy {
  return clockStrategy({
    scoreDiff: offenseScoreDiff(state),
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    isOvertime: state.inOvertime,
  });
}

/**
 * Charge the clock for a single play.
 *
 * With the gate off this is v1 verbatim — one draw, same expression, same
 * range — so parity is untouched. With it on, the SAME single draw becomes the
 * snap-to-whistle duration only, and the huddle and play clock that follow are
 * charged separately (and skipped entirely when the clock stops). Keeping the
 * draw count identical either way means enabling `situational` changes how long
 * plays take without changing which plays happen for a given sequence position.
 */
function tickPlayClock(
  state: GameState,
  base: number,
  spread: number,
  stopsClock: boolean,
): void {
  const roll = state.rand();
  if (!state.features.situational) {
    tickClock(state, Math.round(base + roll * spread));
    return;
  }
  state.clockStopped = stopsClock;
  tickClock(state, Math.round(4 + roll * 5));
}

/** Clock charge for a play with no random component (kicks, kneels). */
function tickFixedClock(
  state: GameState,
  v1Seconds: number,
  v2Seconds: number,
  stopsClock: boolean,
): void {
  if (!state.features.situational) {
    tickClock(state, v1Seconds);
    return;
  }
  state.clockStopped = stopsClock;
  tickClock(state, v2Seconds);
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
  unavailable?: ReadonlySet<string>,
): PlayerSimProfile[] {
  return team.players
    .filter((p) => positionGroup(p.position) === group)
    // A player whose game ended cannot take another snap (A4).
    .filter((p) => !unavailable?.has(p.playerId))
    .sort((a, b) => {
      const da = a.depthRank ?? 99;
      const db = b.depthRank ?? 99;
      if (da !== db) return da - db;
      return b.overall - a.overall;
    });
}

/*
 * Takes the whole `state`, not just `rand` (A4).
 *
 * Selection now depends on who is still standing and how tired they are, both
 * of which live on the state. Threading them as extra optional arguments left
 * every existing call site silently opting out — which is exactly what happened
 * on the first attempt, and injured players kept taking snaps.
 */
function selectPlayer(
  team: TeamSimProfile,
  group: SimPositionGroup,
  state: GameState,
  distribute = false,
): PlayerSimProfile {
  const rand = state.rand;
  const candidates = playersInGroup(team, group, state.unavailable);
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

  /*
   * A tired starter gets spelled — but only by someone who is actually better
   * right now (A4). `substitutionCandidate` returns null when the bench is
   * worse, so a team with no depth plays its exhausted starter, which is the
   * consequence this mechanic exists to create.
   *
   * Consumes no randomness, so it cannot shift the draw sequence.
   */
  if (state.features.injuries) {
    const relief = substitutionCandidate(candidates, (player) =>
      staminaFor(state.snaps, player),
    );
    if (relief) return relief;
  }
  return candidates[0];
}

function selectDefender(
  team: TeamSimProfile,
  state: GameState,
  kind: "tackle" | "sack" | "coverage",
): PlayerSimProfile {
  const weights =
    kind === "sack"
      ? { DL: 0.55, LB: 0.3, DB: 0.15 }
      : kind === "coverage"
        ? { DL: 0.1, LB: 0.25, DB: 0.65 }
        : { DL: 0.35, LB: 0.35, DB: 0.3 };
  const r = state.rand();
  let group: SimPositionGroup = "LB";
  if (r < weights.DL) group = "DL";
  else if (r < weights.DL + weights.LB) group = "LB";
  else group = "DB";
  return selectPlayer(team, group, state, true);
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

/*
 * Fatigue and injury both hang off `recordPlay` (A4).
 *
 * It is the one choke point every play passes through, so charging snaps here
 * means no play type can be forgotten. The PRNG cost is a function of the play
 * TYPE only — three draws on a contact play, none otherwise — so the number of
 * draws depends on the sequence of plays and never on their outcomes. A roll
 * that cost draws only when someone got hurt would make every later play
 * depend on whether anyone did.
 */
function applyAttrition(state: GameState, play: PbpPlay): void {
  if (!state.features.injuries) return;

  const cost = snapCost(play.playType);
  for (const participant of play.participants) {
    chargeSnap(state.snaps, participant.playerId, cost);
  }

  if (contactFactor(play.playType) <= 0) return;
  if (play.participants.length === 0) return;

  const whoRoll = state.rand();
  const whetherRoll = state.rand();
  const severityRoll = state.rand();

  const victim =
    play.participants[
      Math.min(
        play.participants.length - 1,
        Math.floor(whoRoll * play.participants.length),
      )
    ];
  const profile = profileFor(state, victim.teamId, victim.playerId);

  const outcome = rollInjury({
    playType: play.playType,
    stamina: staminaDecay(
      state.snaps.get(victim.playerId) ?? 0,
      profile?.endurance,
    ),
    severityScale: state.injurySeverityScale,
    rolls: [whetherRoll, severityRoll],
  });
  if (!outcome) return;

  play.injury = {
    playerId: victim.playerId,
    teamId: victim.teamId,
    severity: outcome.severity,
    gamesOut: outcome.gamesOut,
    label: outcome.label,
  };
  state.injuries.push({
    playerId: victim.playerId,
    teamId: victim.teamId,
    severity: outcome.severity,
    gamesOut: outcome.gamesOut,
    label: outcome.label,
    quarter: play.quarter,
  });

  /*
   * Anything worse than a knock ends this player's game. That is what forces
   * the next man up and makes roster depth matter WITHIN a game, not only in
   * the weeks after it. A `minor` injury does not — he is shaken up and returns.
   */
  if (outcome.gamesOut > 0) state.unavailable.add(victim.playerId);
}

function profileFor(
  state: GameState,
  teamId: string,
  playerId: string,
): PlayerSimProfile | undefined {
  const team = state.home.teamId === teamId ? state.home : state.away;
  return team.players.find((p) => p.playerId === playerId);
}

function recordPlay(state: GameState, play: PbpPlay): void {
  if (state.pendingTempo) {
    play.tempo = state.pendingTempo;
    // Stamp the snap itself, not the extra point and kickoff that a touchdown
    // pulls in behind it.
    state.pendingTempo = null;
  }
  applyAttrition(state, play);
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

/**
 * Refill timeouts.
 *
 * Called at the start of each half and each overtime period. It ASSIGNS rather
 * than adds, so unspent timeouts do not carry over — which is both the rule and
 * what keeps the per-half count exactly 3.
 */
function resetTimeouts(state: GameState, count: number): void {
  state.homeTimeouts = count;
  state.awayTimeouts = count;
}

function advanceQuarter(state: GameState): void {
  if (state.inOvertime) {
    state.otPeriod += 1;
    state.clockSeconds = OT_SECONDS;
    resetTimeouts(state, TIMEOUTS_PER_OVERTIME);
    return;
  }
  if (state.quarter === 2) {
    state.secondHalfKickPending = true;
    resetTimeouts(state, TIMEOUTS_PER_HALF);
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
      resetTimeouts(state, TIMEOUTS_PER_OVERTIME);
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

/**
 * Onside kick (A3). Recovered, the kicking team keeps the ball at its own 45;
 * failed, the receiving team takes over there — a real cost, which is why
 * `shouldOnside` only says yes when giving the ball back loses anyway.
 */
function doOnsideKick(state: GameState, kicking: "home" | "away"): void {
  const kickingTeam = kicking === "home" ? state.home : state.away;
  const receiving = kicking === "home" ? state.away : state.home;
  const kicker = selectPlayer(kickingTeam, "K", state);
  const recovered = state.rand() < 0.15;

  startDrive(state, kickingTeam.teamId, 35);
  recordPlay(state, {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: kickingTeam.teamId,
    defenseTeamId: receiving.teamId,
    playType: "onside_kick",
    down: 0,
    distance: 0,
    fieldPosition: 35,
    yardsGained: 10,
    isScoring: false,
    pointsScored: 0,
    // A recovery means possession did NOT change hands, which is the whole
    // point of the play.
    isTurnover: !recovered,
    participants: [participant(kicker, kickingTeam.teamId, "kicker")],
  });
  tickFixedClock(state, 6, 6, true);
  endDrive(state, "turnover");

  if (recovered) {
    state.possession = kicking;
    startDrive(state, kickingTeam.teamId, 45);
  } else {
    state.possession = kicking === "home" ? "away" : "home";
    startDrive(state, receiving.teamId, 55);
  }
  state.openingKickDone = true;
}

function doKickoff(state: GameState, kicking: "home" | "away"): void {
  if (state.features.situational) {
    const kickingScore =
      kicking === "home"
        ? state.homeScore - state.awayScore
        : state.awayScore - state.homeScore;
    if (
      shouldOnside({
        scoreDiff: kickingScore,
        quarter: state.quarter,
        clockSeconds: state.clockSeconds,
        isOvertime: state.inOvertime,
      })
    ) {
      doOnsideKick(state, kicking);
      return;
    }
  }

  const kickingTeam = kicking === "home" ? state.home : state.away;
  const receiving = kicking === "home" ? state.away : state.home;
  const kicker = selectPlayer(kickingTeam, "K", state);
  const returner = selectPlayer(receiving, "RB", state, true);
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
  tickFixedClock(state, 6, 6, true);
  endDrive(state, "turnover");

  state.possession = kicking === "home" ? "away" : "home";
  startDrive(state, receiving.teamId, startField);
  state.openingKickDone = true;
}

function doExtraPoint(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const kicker = selectPlayer(off, "K", state);
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
  tickFixedClock(state, 4, 4, true);
}

function doFieldGoalAttempt(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const kicker = selectPlayer(off, "K", state);
  const dist = yardsToGoal(state) + 17;
  const edge = matchupEdge(state);
  /*
   * Wind and wet do not move the uprights, they shorten the leg — so a 40-yard
   * try into a gale is modelled as a longer kick rather than as a flat accuracy
   * penalty. Dividing by a neutral 1 is exact, so v1 is untouched.
   */
  const effectiveDist = dist / state.weatherMods.kickDistance;
  const makeProb = clamp(
    0.92 - (effectiveDist - 30) * 0.02 + edge * 0.08,
    0.35,
    0.95,
  );
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
  tickFixedClock(state, 5, 5, true);

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
  const punter = selectPlayer(off, "P", state);
  const returner = selectPlayer(def, "WR", state, true);
  const gross = Math.round(
    (38 + state.rand() * 12 - matchupEdge(state) * 10) *
      state.weatherMods.kickDistance,
  );
  const net = clamp(gross - Math.round(state.rand() * 8), 25, 55);
  /*
   * Where the receiving team starts (v2 widens the floor).
   *
   * v1 clamped this to the 15, which meant a team could never be pinned deep —
   * and therefore a safety was geometrically impossible no matter how the rest
   * of the engine behaved. Real punts are downed inside the 5 regularly, so v2
   * lowers the floor to the 1. Costs no random draw, so v1 parity is unaffected.
   */
  const pinFloor = state.features.scoringV2 ? 1 : 15;
  const newField = clamp(100 - (state.fieldPosition + net), pinFloor, 75);

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
  tickFixedClock(state, 7, 7, true);
  endDrive(state, "punt");
  flipPossession(state);
  startDrive(state, offenseTeamId(state), newField);
}

function doRush(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const rusher = selectPlayer(off, "RB", state, true);
  const edge = matchupEdge(state);
  const scheme = schemeMods(state);
  const fumbleProb =
    clamp(0.01 - edge * 0.003, 0.003, 0.015) *
    state.weatherMods.fumbleRate *
    scheme.fumbleRate;
  const tdProb = clamp(0.055 + edge * 0.08, 0.02, 0.15);
  const explosive =
    state.rand() <
    (0.08 + edge * 0.05) *
      state.weatherMods.explosiveRate *
      scheme.explosiveRate;
  let yards = explosive
    ? Math.round((12 + state.rand() * 18) * scheme.rushYards)
    : Math.round((2 + state.rand() * 5 + edge * 4) * scheme.rushYards);
  yards = Math.max(-3, yards);

  const participants: PbpParticipant[] = [
    participant(rusher, off.teamId, "rusher"),
  ];
  const tackler = selectDefender(def, state, "tackle");
  participants.push(participant(tackler, def.teamId, "tackler_solo"));
  if (state.rand() < 0.35) {
    const ast = selectDefender(def, state, "tackle");
    participants.push(participant(ast, def.teamId, "tackler_ast"));
  }

  let isTurnover = false;
  let isScoring = false;
  let points = 0;

  if (state.rand() < fumbleProb) {
    isTurnover = true;
    yards = 0;
    const fumbler = rusher;
    const recoverer = selectDefender(def, state, "tackle");
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
  tickPlayClock(state, 22, 18, isTurnover || isScoring);
  applyPlayResult(state, yards, isScoring, points, isTurnover, play);
}

function doPass(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const passer = selectPlayer(off, "QB", state);
  const receiver = selectPlayer(off, "WR", state, true);
  const edge = matchupEdge(state);
  const scheme = schemeMods(state);
  const sackProb = clamp(0.07 - edge * 0.03, 0.03, 0.12) * scheme.sackRate;
  const intProb =
    clamp(0.025 - edge * 0.01, 0.008, 0.04) * scheme.interceptionRate;

  if (state.rand() < sackProb) {
    const sacker = selectDefender(def, state, "sack");
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

    /*
     * Strip-sack (v2). v1 modelled fumbles on rushes only, so a quarterback
     * could never lose the ball while being sacked — the single most common
     * non-rush fumble in the sport. Gated, and the draw happens ONLY inside
     * the gate so v1's PRNG sequence is untouched.
     */
    if (
      state.features.scoringV2 &&
      state.rand() < 0.12 * state.weatherMods.fumbleRate
    ) {
      const recoverer = selectDefender(def, state, "tackle");
      play.isTurnover = true;
      play.participants.push(participant(passer, off.teamId, "fumbler"));
      play.participants.push(participant(recoverer, def.teamId, "recoverer"));
      recordPlay(state, play);
      tickPlayClock(state, 24, 12, true);
      applyPlayResult(state, yards, false, 0, true, play);
      return;
    }

    recordPlay(state, play);
    tickPlayClock(state, 24, 12, false);
    applyPlayResult(state, yards, false, 0, false, play);
    return;
  }

  if (state.rand() < intProb) {
    const interceptor = selectDefender(def, state, "coverage");
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
    /*
     * Pick-six (v2). v1 always spotted the ball after an interception, so a
     * defense could never score. The return distance already exists; this only
     * decides whether it reached the end zone.
     */
    if (state.features.scoringV2 && rollReturnTouchdown(state, 0.06)) {
      play.returnYards = returnYards;
      play.isReturnTd = true;
      play.defensivePoints = 6;
      awardDefensivePoints(state, 6);
      recordPlay(state, play);
      tickPlayClock(state, 20, 10, true);
      endDrive(state, "turnover");
      // The scoring defense now kicks off to the team that threw it.
      doKickoff(state, state.possession === "home" ? "away" : "home");
      return;
    }

    if (state.features.scoringV2) play.returnYards = returnYards;
    recordPlay(state, play);
    tickPlayClock(state, 20, 10, true);
    endDrive(state, "turnover");
    flipPossession(state);
    const spot = clamp(100 - state.fieldPosition + returnYards, 15, 85);
    startDrive(state, offenseTeamId(state), spot);
    return;
  }

  /*
   * Weather is applied AFTER the clamp on purpose. The 0.45 floor is a v1
   * balance guard, not a law of physics — a sleet game should be allowed to
   * push completion percentage below it.
   */
  const completeProb =
    clamp(0.6 + edge * 0.14, 0.45, 0.8) *
    state.weatherMods.passAccuracy *
    scheme.passAccuracy;
  const complete = state.rand() < completeProb;
  if (!complete) {
    const pd = state.rand() < 0.12 ? selectDefender(def, state, "coverage") : null;
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
    tickPlayClock(state, 18, 10, true);
    applyPlayResult(state, 0, false, 0, false);
    return;
  }

  const explosive =
    state.rand() <
    (0.1 + edge * 0.06) *
      state.weatherMods.explosiveRate *
      scheme.explosiveRate;
  let yards = explosive
    ? Math.round(15 + state.rand() * 25)
    : Math.round(4 + state.rand() * 9 + edge * 5);
  let isScoring = false;
  let points = 0;
  const participants: PbpParticipant[] = [
    participant(passer, off.teamId, "passer"),
    participant(receiver, off.teamId, "receiver"),
  ];
  const tackler = selectDefender(def, state, "tackle");
  participants.push(participant(tackler, def.teamId, "tackler_solo"));
  if (state.rand() < 0.3) {
    participants.push(
      participant(selectDefender(def, state, "tackle"), def.teamId, "tackler_ast"),
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
  tickPlayClock(state, 20, 18, isScoring);
  applyPlayResult(state, yards, isScoring, points, false, play);
}

function doKneel(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const rusher = selectPlayer(off, "QB", state);
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
  tickFixedClock(state, 38, 2, false);
  applyPlayResult(state, -1, false, 0, false);
}


/*
 * ── v2 scoring plays (Epic A1) ────────────────────────────────────────────
 * Reached only when `features.scoringV2` is on, so v1 logs are untouched.
 */

/** Points the DEFENSE just scored go to the other side of the ledger. */
function awardDefensivePoints(state: GameState, points: number): void {
  if (state.possession === "home") state.awayScore += points;
  else state.homeScore += points;
}

/**
 * Tackled in your own end zone: two points to the defense, then a free kick
 * from the 20 by the team that conceded.
 */
function doSafety(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const tackler = selectDefender(def, state, "tackle");

  awardDefensivePoints(state, 2);

  recordPlay(state, {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: "safety",
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: 0,
    // The scoring side is the DEFENSE, so `pointsScored` (an offense-relative
    // field in v1) stays 0 and `defensivePoints` carries the 2. Readers that
    // sum `pointsScored` for a team must add `defensivePoints` for the other.
    isScoring: false,
    pointsScored: 0,
    defensivePoints: 2,
    isTurnover: true,
    participants: [participant(tackler, def.teamId, "tackler_solo")],
  });

  tickFixedClock(state, 6, 6, true);
  endDrive(state, "turnover");
  // The conceding team free-kicks, so possession passes to the scoring side.
  flipPossession(state);
  startDrive(state, offenseTeamId(state), 35);
}

/**
 * Whether to go for two rather than kick.
 *
 * Deliberately deterministic — no random draw. The classic chart: down 2, 5 or
 * 8 late, a two-point try changes the number of scores needed. Anything else
 * kicks. A3 can widen this once it owns situational decisions.
 */
function shouldGoForTwo(state: GameState): boolean {
  if (state.quarter < 4 && !state.inOvertime) return false;
  const scoring = state.possession === "home" ? state.homeScore : state.awayScore;
  const opposing = state.possession === "home" ? state.awayScore : state.homeScore;
  const deficit = opposing - scoring;
  return deficit === 2 || deficit === 5 || deficit === 8;
}

/** Two-point try from the 2. Succeeds a shade under half the time. */
function doTwoPointConversion(state: GameState): void {
  const off = offenseTeam(state);
  const def = defenseTeam(state);
  const passer = selectPlayer(off, "QB", state);
  const target = selectPlayer(off, "WR", state, true);
  const edge = matchupEdge(state);
  const success = state.rand() < clamp(0.45 + edge * 0.1, 0.3, 0.62);

  if (success) {
    if (state.possession === "home") state.homeScore += 2;
    else state.awayScore += 2;
  }

  recordPlay(state, {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: off.teamId,
    defenseTeamId: def.teamId,
    playType: success ? "two_point_convert" : "two_point_fail",
    down: 0,
    distance: 2,
    fieldPosition: 98,
    yardsGained: success ? 2 : 0,
    isScoring: success,
    pointsScored: success ? 2 : 0,
    isTurnover: false,
    participants: [
      participant(passer, off.teamId, "passer"),
      participant(target, off.teamId, "receiver"),
    ],
  });
  tickFixedClock(state, 5, 5, true);
}

/**
 * Did a return reach the end zone?
 *
 * Called ONLY inside a `scoringV2` branch — it draws, so calling it while the
 * gate is off would desynchronize the PRNG.
 */
function rollReturnTouchdown(state: GameState, baseProb: number): boolean {
  return state.rand() < baseProb;
}


/*
 * ── Penalties (Epic A2) ───────────────────────────────────────────────────
 */

/** Mean roster awareness, or `strength` when no attribute data exists. */
function teamDiscipline(team: TeamSimProfile): number {
  if (typeof team.discipline === "number") return team.discipline;
  return meanAwareness(team.players, team.strength);
}

/**
 * Roll a flag for the play just built, and apply the accept/decline outcome.
 *
 * Returns the yardage adjustment to apply INSTEAD of the play result when the
 * penalty is accepted and negates the play, or `null` when the play stands.
 *
 * Draws from the PRNG, so it is called ONLY inside the `penalties` gate — a
 * draw while disabled would desynchronize every later play.
 */
function applyPenalty(
  state: GameState,
  play: PbpPlay,
  context: { playYards: number; isScoring: boolean; isTurnover: boolean },
): { negated: boolean; penaltyYards: number } | null {
  const rolled = rollPenalty({
    rand: state.rand,
    playType: play.playType,
    offenseDiscipline: teamDiscipline(offenseTeam(state)),
    defenseDiscipline: teamDiscipline(defenseTeam(state)),
  });
  if (!rolled) return null;

  const decision = acceptOrDecline({
    penalty: rolled.def,
    playYards: context.playYards,
    playIsScoring: context.isScoring,
    playIsTurnover: context.isTurnover,
    distance: state.distance,
  });

  play.penalty = {
    code: rolled.def.code,
    label: rolled.def.label,
    yards: rolled.yards,
    onOffense: rolled.def.onOffense,
    accepted: decision.accepted,
    negatesPlay: decision.accepted && rolled.def.negatesPlay,
    reason: decision.reason,
  };

  // Declined: the flag is recorded for the play-by-play, but nothing changes.
  if (!decision.accepted) return null;

  // Accepted but not play-negating (defensive holding, PI): the play is wiped
  // and the ball moves by the penalty yardage from the previous spot.
  const signed = rolled.def.onOffense ? -rolled.yards : rolled.yards;
  return {
    negated: rolled.def.negatesPlay || !rolled.def.onOffense,
    penaltyYards: signed,
  };
}

function applyPlayResult(
  state: GameState,
  yards: number,
  isScoring: boolean,
  points: number,
  isTurnover: boolean,
  /*
   * The play just recorded, passed explicitly so the penalty roll can attach
   * its flag to it. Optional because non-scrimmage plays (kickoff, punt, field
   * goal) do not draw flags in A2.
   */
  play?: PbpPlay,
): void {
  if (state.features.penalties && play) {
    const outcome = applyPenalty(state, play, {
      playYards: yards,
      isScoring,
      isTurnover,
    });
    if (outcome) {
      /*
       * An accepted flag replaces the play entirely: yardage is assessed from
       * the previous spot and the down replays (or resets on an automatic
       * first down). The play stays in the log so the drive chart can show
       * what was wiped, but `negatesPlay` keeps it out of the stat lines.
       */
      state.fieldPosition = clamp(
        state.fieldPosition + outcome.penaltyYards,
        1,
        99,
      );
      // A flag stops the clock, so the next snap pays no huddle runoff (A3).
      state.clockStopped = true;
      const auto = !play.penalty?.onOffense && outcome.penaltyYards > 0;
      if (auto) {
        state.down = 1;
        state.distance = Math.min(10, 100 - state.fieldPosition) || 1;
      } else {
        state.distance = Math.max(1, state.distance - outcome.penaltyYards);
      }
      return;
    }
  }

  if (isTurnover) {
    endDrive(state, "turnover");
    flipPossession(state);
    const spot = clamp(100 - state.fieldPosition, 20, 80);
    startDrive(state, offenseTeamId(state), spot);
    return;
  }

  /*
   * Safety (v2). v1 clamped field position to a floor of 1, so being tackled
   * in your own end zone was silently impossible. Detect it BEFORE the clamp.
   *
   * Costs no random draw — it is pure geometry — but it is still gated,
   * because emitting the play at all would change the log.
   */
  if (state.features.scoringV2 && !isScoring && state.fieldPosition + yards <= 0) {
    doSafety(state);
    return;
  }

  state.fieldPosition = clamp(state.fieldPosition + yards, 1, 99);

  if (isScoring) {
    if (state.possession === "home") state.homeScore += points;
    else state.awayScore += points;
    if (points === 6) {
      if (state.features.scoringV2 && shouldGoForTwo(state)) {
        doTwoPointConversion(state);
      } else {
        doExtraPoint(state);
      }
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

/*
 * ── Clock management plays (Epic A3) ──────────────────────────────────────
 * Reached only when `features.situational` is on.
 */

/** A play that stops the clock and nothing else. Costs no random draw. */
function emitClockPlay(
  state: GameState,
  playType: "spike" | "timeout",
  extra: Partial<PbpPlay> = {},
): void {
  recordPlay(state, {
    playId: state.playId,
    driveId: state.driveId,
    quarter: state.quarter,
    clockSeconds: state.clockSeconds,
    offenseTeamId: offenseTeamId(state),
    defenseTeamId: defenseTeamId(state),
    playType,
    down: state.down,
    distance: state.distance,
    fieldPosition: state.fieldPosition,
    yardsGained: 0,
    isScoring: false,
    pointsScored: 0,
    isTurnover: false,
    participants: [],
    ...extra,
  });
  state.clockStopped = true;
}

/** Spend a timeout. Bounded by `spendTimeout`, so the count cannot go negative. */
function doTimeout(state: GameState, side: "home" | "away"): void {
  spendTimeout(state, side);
  emitClockPlay(state, "timeout", {
    timeoutTeamId: side === "home" ? state.home.teamId : state.away.teamId,
  });
  // A timeout consumes no game clock at all — that is the entire point of one.
}

/** Throw it at the turf. Stops the clock, costs a down. */
function doSpike(state: GameState): void {
  emitClockPlay(state, "spike", { tempo: "hurry_up" });
  tickClock(state, 2);
  state.down += 1;
  if (state.down > 4) {
    endDrive(state, "downs");
    flipPossession(state);
    startDrive(state, offenseTeamId(state), clamp(100 - state.fieldPosition, 20, 80));
  }
}

/**
 * v1's 4th-down logic: two hardcoded distance bands and a coin flip.
 *
 * Kept verbatim, and reached whenever `features.situational` is off, so the
 * golden fixture still reproduces byte-for-byte.
 */
function runFourthDownV1(state: GameState): void {
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
}

function runNormalDownPlay(state: GameState, tempo: ClockStrategy): void {
  const edge = matchupEdge(state);
  let passRate = clamp(
    0.52 + edge * 0.1 - (state.down === 1 ? 0 : 0.08),
    0.38,
    0.68,
  );
  /*
   * Scheme moves the split (A6), and it needs a wider band than the baseline
   * clamp allows — a Flexbone that still throws it 38% of the time is not a
   * Flexbone. Guarded on a non-zero delta rather than folded into the
   * expression above so the neutral path keeps the original clamp exactly.
   */
  const schemeDelta = schemeMods(state).passRateDelta;
  if (schemeDelta !== 0) {
    passRate = clamp(passRate + schemeDelta, 0.12, 0.9);
  }
  if (state.features.situational) {
    /*
     * Tempo changes what you call, not just how fast you snap it. A hurry-up
     * offense throws because an incompletion stops the clock; a team protecting
     * a lead runs because a handoff does not.
     */
    if (tempo === "hurry_up") passRate = clamp(passRate + 0.25, 0.38, 0.92);
    else if (tempo === "burn") passRate = clamp(passRate - 0.25, 0.08, 0.68);
  }
  if (state.rand() < passRate) doPass(state);
  else doRush(state);
}

function runScrimmagePlay(state: GameState): void {
  if (!state.features.situational) {
    if (shouldKneel(state)) {
      doKneel(state);
      return;
    }
    if (state.down === 4) {
      runFourthDownV1(state);
      return;
    }
    runNormalDownPlay(state, "normal");
    return;
  }

  /*
   * ── A3 path ─────────────────────────────────────────────────────────────
   *
   * Order matters and mirrors the real sequence between snaps: the clock is
   * running, somebody may stop it, and only then does a play happen.
   */
  const tempo = currentClockStrategy(state);
  const offenseSide = state.possession;
  const defenseSide = offenseSide === "home" ? "away" : "home";
  const halfLeft = secondsLeftInHalf(
    state.quarter,
    state.clockSeconds,
    state.inOvertime,
  );
  const gameLeft = secondsLeftInGame(
    state.quarter,
    state.clockSeconds,
    state.inOvertime,
  );
  const scoreDiff = offenseScoreDiff(state);

  // The trailing DEFENSE stops the clock to get the ball back at all.
  if (
    shouldUseTimeout({
      isOffense: false,
      scoreDiff: -scoreDiff,
      secondsLeftInHalf: halfLeft,
      secondsLeftInGame: gameLeft,
      quarter: state.quarter,
      timeoutsRemaining: timeoutsFor(state, defenseSide),
      clockStopped: state.clockStopped,
    })
  ) {
    doTimeout(state, defenseSide);
    return;
  }

  if (
    shouldUseTimeout({
      isOffense: true,
      scoreDiff,
      secondsLeftInHalf: halfLeft,
      secondsLeftInGame: gameLeft,
      quarter: state.quarter,
      timeoutsRemaining: timeoutsFor(state, offenseSide),
      clockStopped: state.clockStopped,
    })
  ) {
    doTimeout(state, offenseSide);
    return;
  }

  if (
    shouldSpike({
      strategy: tempo,
      secondsLeftInHalf: halfLeft,
      down: state.down,
      timeoutsRemaining: timeoutsFor(state, offenseSide),
      clockStopped: state.clockStopped,
    })
  ) {
    doSpike(state);
    return;
  }

  /*
   * The huddle and play clock between snaps. v1 folded this into each play's
   * duration and therefore charged it even to incompletions, which is what
   * capped a game at ~96 scrimmage plays.
   */
  /*
   * Scheme tempo scales the HUDDLE, not the play (A6) — which is what tempo
   * physically is. It therefore only has anything to scale when `situational`
   * is on, because the v1 clock model folded the huddle into each play's
   * duration and had no separate runoff to speed up.
   */
  tickClock(
    state,
    Math.round(runoffSeconds(tempo, state.clockStopped) * schemeMods(state).tempo),
  );
  state.clockStopped = false;
  if (state.clockSeconds <= 0) return;

  if (shouldKneel(state)) {
    doKneel(state);
    return;
  }

  if (state.down === 4) {
    const call = fourthDownDecision({
      yardsToGo: state.distance,
      yardsToGoal: yardsToGoal(state),
      scoreDiff,
      quarter: state.quarter,
      clockSeconds: state.clockSeconds,
      isOvertime: state.inOvertime,
      aggression: coachAggression(offenseTeam(state)),
    });
    if (call === "field_goal") {
      doFieldGoalAttempt(state);
      return;
    }
    if (call === "punt") {
      doPunt(state);
      return;
    }
    // Going for it: the chart chose to go, a draw only picks run or pass.
    if (state.rand() < 0.45) doRush(state);
    else doPass(state);
    return;
  }

  state.pendingTempo = tempo === "normal" ? null : tempo;
  runNormalDownPlay(state, tempo);
  state.pendingTempo = null;
}

function simulateGameLog(input: PbpGameInput): PbpGameLog {
  const weights = weightsForFlavor(
    normalizeSimulationFlavor(input.flavor ?? DEFAULT_SIMULATION_FLAVOR),
  );
  const rand = mulberry32(input.seed >>> 0);
  const state: GameState = {
    rand,
    features: {
      scoringV2: input.features?.scoringV2 === true,
      penalties: input.features?.penalties === true,
      situational: input.features?.situational === true,
      balance: input.features?.balance === true,
      weather: input.features?.weather === true,
      injuries: input.features?.injuries === true,
      schemes: input.features?.schemes === true,
    },
    snaps: new Map(),
    unavailable: new Set(),
    injuries: [],
    /*
     * Default 1 (normal) rather than 0. A caller that enabled the gate but did
     * not pass a dial wants injuries at the usual rate — reading absence as
     * "off" would make the gate silently do nothing.
     */
    injurySeverityScale: input.injurySeverityScale ?? 1,
    home: input.home,
    away: input.away,
    strengthWeight: weights.strengthWeight,
    edgeScale: weights.edgeScale,
    /*
     * Crowd blending is a no-op with neutral inputs: `crowdHomeFieldEdge`
     * multiplies by exactly 1 when prestige is 50 and rivalry is 0, which is
     * every matchup nobody has configured.
     */
    homeFieldEdge:
      input.features?.weather === true
        ? crowdHomeFieldEdge({
            base:
              input.features?.balance === true
                ? HOME_FIELD_EDGE_V2
                : HOME_FIELD_EDGE,
            venuePrestige: input.venuePrestige,
            rivalryIntensity: input.rivalryIntensity,
          })
        : input.features?.balance === true
          ? HOME_FIELD_EDGE_V2
          : HOME_FIELD_EDGE,
    weatherMods:
      input.features?.weather === true && input.weather
        ? weatherModifiers(input.weather)
        : NEUTRAL_MODIFIERS,
    /*
     * Resolved once per game, not per play: a scheme is what a program runs,
     * and re-deriving it 120 times would be the same answer at 120x the cost.
     * Note the argument order — the modifiers describe the OFFENSE, so the
     * home-possession set is built from the home team's offense against the
     * away team's defense.
     */
    homeSchemeMods:
      input.features?.schemes === true
        ? schemeModifiers(input.home.scheme, input.away.scheme)
        : NEUTRAL_SCHEME_MODIFIERS,
    awaySchemeMods:
      input.features?.schemes === true
        ? schemeModifiers(input.away.scheme, input.home.scheme)
        : NEUTRAL_SCHEME_MODIFIERS,
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
    homeTimeouts: TIMEOUTS_PER_HALF,
    awayTimeouts: TIMEOUTS_PER_HALF,
    clockStopped: true,
    pendingTempo: null,
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
    /*
     * Record the conditions the game was ACTUALLY played under — only when the
     * gate was on. Absence means "not modelled", and a reader must not fill it
     * in from the derived forecast: the forecast is what a scheduled game shows,
     * not evidence about a game that has already happened.
     */
    ...(state.features.weather && input.weather
      ? { weather: input.weather }
      : {}),
    /*
     * Record which gates were live, so a reader never has to infer it from the
     * engine version. Omitted entirely when nothing was on — that absence is
     * what keeps a fully-gated-off log byte-identical to v1, which the golden
     * parity fixture pins.
     */
    ...(activeFeatures(state.features) ?? {}),
    /*
     * An empty array is not the same as absence here: it says injuries WERE
     * modelled and nobody got hurt, which a reader must be able to distinguish
     * from a game that never rolled for them.
     */
    ...(state.features.injuries ? { injuries: state.injuries } : {}),
  };
}

/**
 * `{ features }` when at least one gate is on, otherwise `null`.
 *
 * Only the gates that were ON are recorded. Writing `penalties: false` would
 * claim the engine considered penalties and declined, which is indistinguishable
 * in the data from a build that never had them — and Epic D's record book would
 * later read that claim as history.
 */
function activeFeatures(
  features: Required<PbpFeatureGates>,
): { features: PbpFeatureGates } | null {
  const active: PbpFeatureGates = {};
  for (const [key, value] of Object.entries(features)) {
    if (value === true) active[key as keyof PbpFeatureGates] = true;
  }
  return Object.keys(active).length > 0 ? { features: active } : null;
}

export { simulateGameLog, positionGroup, POSITION_TO_GROUP };
