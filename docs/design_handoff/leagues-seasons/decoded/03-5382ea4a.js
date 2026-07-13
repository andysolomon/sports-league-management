/* =============================================================================
   Sports League — Leagues & Seasons prototype
   Data + pure logic layer. Everything here is serializable (no functions in
   state) so the store can persist to localStorage and reload cleanly.
   Attaches to window.SL.
   ========================================================================== */
(function () {
  "use strict";

  // ---- tiny deterministic RNG -------------------------------------------------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(key) { return mulberry32(hashStr(String(key))); }

  // ---- teams (real Cobb County, GA high schools; ovr drives sim) --------------
  // division: two balanced divisions (alternating by rating so each has a mix
  // of strong and weak programs; standings sort within a division).
  const TEAMS = [
    { id: "pebblebrook", name: "Pebblebrook", mascot: "Falcons", ovr: 92, division: "east" },
    { id: "pope", name: "Pope", mascot: "Greyhounds", ovr: 90, division: "west" },
    { id: "allatoona", name: "Allatoona", mascot: "Buccaneers", ovr: 89, division: "east" },
    { id: "osborne", name: "Osborne", mascot: "Cardinals", ovr: 87, division: "west" },
    { id: "campbell", name: "Campbell", mascot: "Spartans", ovr: 85, division: "east" },
    { id: "sprayberry", name: "Sprayberry", mascot: "Yellow Jackets", ovr: 84, division: "west" },
    { id: "walton", name: "Walton", mascot: "Raiders", ovr: 83, division: "east" },
    { id: "lassiter", name: "Lassiter", mascot: "Trojans", ovr: 81, division: "west" },
    { id: "northcobb", name: "North Cobb", mascot: "Warriors", ovr: 80, division: "east" },
    { id: "mceachern", name: "McEachern", mascot: "Panthers", ovr: 78, division: "west" },
    { id: "hillgrove", name: "Hillgrove", mascot: "Hawks", ovr: 77, division: "east" },
    { id: "wheeler", name: "Wheeler", mascot: "Wildcats", ovr: 76, division: "west" },
    { id: "harrison", name: "Harrison", mascot: "Hoyas", ovr: 74, division: "east" },
    { id: "southcobb", name: "South Cobb", mascot: "Eagles", ovr: 72, division: "west" },
    { id: "kell", name: "Kell", mascot: "Longhorns", ovr: 70, division: "east" },
    { id: "kennesaw", name: "Kennesaw Mountain", mascot: "Mustangs", ovr: 68, division: "west" },
  ];
  const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

  // ---- divisions --------------------------------------------------------------
  const DIVISIONS = [
    { id: "east", name: "Eastern" },
    { id: "west", name: "Western" },
  ];
  function divisionOf(id) { return TEAM_BY_ID[id] ? TEAM_BY_ID[id].division : null; }
  function divisionName(divId) { const d = DIVISIONS.find((x) => x.id === divId); return d ? d.name : ""; }
  // Given overall-sorted standings, keep one division and re-rank within it.
  function divisionStandings(standings, divId) {
    return standings
      .filter((r) => TEAM_BY_ID[r.teamId] && TEAM_BY_ID[r.teamId].division === divId)
      .map((r, i) => ({ ...r, divRank: i + 1 }));
  }

  // stable monogram color per team (subtle, token-independent)
  function teamColor(id) {
    const h = hashStr(id) % 360;
    return `oklch(0.62 0.12 ${h})`;
  }
  function initials(name) {
    return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  // ---- dates ------------------------------------------------------------------
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fromISO(iso) { return new Date(iso + "T12:00:00Z"); }
  function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function formatDate(iso) {
    if (!iso) return "—";
    const d = fromISO(iso);
    return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }
  function formatWhen(iso) {
    if (!iso) return "TBD";
    const d = fromISO(iso);
    return `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }

  // ---- schedule (circle-method round robin, take N weeks) ---------------------
  function roundRobin(ids) {
    const arr = ids.slice();
    const n = arr.length;
    const fixed = arr[0];
    let rest = arr.slice(1);
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const row = [fixed, ...rest];
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        const a = row[i], b = row[n - 1 - i];
        const home = (r + i) % 2 === 0 ? a : b;
        const away = home === a ? b : a;
        games.push([home, away]);
      }
      rounds.push(games);
      rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
    }
    return rounds;
  }

  function generateFixtures(seasonId, startISO, weeks) {
    const rounds = roundRobin(TEAMS.map((t) => t.id)).slice(0, weeks);
    const start = fromISO(startISO);
    const out = [];
    rounds.forEach((games, wi) => {
      const week = wi + 1;
      const dateISO = toISO(addDays(start, wi * 7));
      games.forEach(([home, away], gi) => {
        out.push({
          id: `${seasonId}-w${week}-g${gi}`,
          seasonId, week, dateISO,
          stage: "regular",
          homeId: home, awayId: away,
          homeScore: null, awayScore: null,
          status: "scheduled",
        });
      });
    });
    return out;
  }

  // ---- game simulation --------------------------------------------------------
  function teamPoints(strength, rng) {
    const expTD = Math.max(0.4, Math.min(6, (strength - 55) / 8));
    let td = Math.max(0, Math.round(expTD + (rng() * 2 - 1) * 1.5));
    let fg = Math.max(0, Math.round(1 + (rng() * 2 - 1) * 1.3));
    const missXP = rng() < 0.12 ? 1 : 0;
    return td * 7 + fg * 3 - missXP;
  }
  // flavor: "chalk" (favorites hold) | "balanced" | "upsets" (more variance)
  function simGame(fx, flavor, opts) {
    opts = opts || {};
    const rng = rngFor(fx.id + "|" + (flavor || "balanced") + (opts.salt || ""));
    const home = TEAM_BY_ID[fx.homeId], away = TEAM_BY_ID[fx.awayId];
    const amp = flavor === "chalk" ? 3 : flavor === "upsets" ? 11 : 6;
    const hfa = 2.5;
    const hs = home.ovr + hfa + (rng() * 2 - 1) * amp;
    const as = away.ovr + (rng() * 2 - 1) * amp;
    let h = teamPoints(hs, rng);
    let a = teamPoints(as, rng);
    if (opts.noTies && h === a) {
      // OT: nudge toward the stronger side
      if (hs >= as) h += 3 + (rng() < 0.5 ? 4 : 0); else a += 3 + (rng() < 0.5 ? 4 : 0);
      if (h === a) h += 3;
    }
    return { homeScore: h, awayScore: a };
  }

  // ---- standings --------------------------------------------------------------
  function computeStandings(fixtures) {
    const rows = {};
    TEAMS.forEach((t) => (rows[t.id] = {
      teamId: t.id, teamName: t.name, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0,
    }));
    fixtures.forEach((fx) => {
      if (fx.stage !== "regular" || fx.status !== "final") return;
      const h = rows[fx.homeId], a = rows[fx.awayId];
      h.pf += fx.homeScore; h.pa += fx.awayScore;
      a.pf += fx.awayScore; a.pa += fx.homeScore;
      if (fx.homeScore > fx.awayScore) { h.wins++; a.losses++; }
      else if (fx.homeScore < fx.awayScore) { a.wins++; h.losses++; }
      else { h.ties++; a.ties++; }
    });
    const list = Object.values(rows).map((r) => {
      const gp = r.wins + r.losses + r.ties;
      return { ...r, gp, pct: gp ? (r.wins + r.ties * 0.5) / gp : 0, diff: r.pf - r.pa };
    });
    list.sort((x, y) =>
      y.pct - x.pct || y.diff - x.diff || y.wins - x.wins ||
      TEAM_BY_ID[y.teamId].ovr - TEAM_BY_ID[x.teamId].ovr
    );
    list.forEach((r, i) => (r.rank = i + 1));
    return list;
  }
  function recordStr(r) { return `${r.wins}-${r.losses}${r.ties ? "-" + r.ties : ""}`; }

  // ---- bracket ----------------------------------------------------------------
  function roundLabel(round, totalRounds) {
    const fromEnd = totalRounds - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semifinals";
    if (fromEnd === 2) return "Quarterfinals";
    if (fromEnd === 3) return "Round of 16";
    return `Round ${round}`;
  }
  // standard seed pairings for a power-of-two bracket
  function seedOrder(n) {
    let rounds = [[1, 2]];
    while (rounds[0].length < n) {
      const prev = rounds[0];
      const m = prev.length * 2 + 1;
      const next = [];
      for (const s of prev) { next.push(s); next.push(m - s); }
      rounds = [next];
    }
    return rounds[0];
  }
  function totalRoundsFor(size) { return Math.round(Math.log2(size)); }

  function seedBracket(standings, size) {
    const seeds = standings.slice(0, size).map((r, i) => ({
      seed: i + 1, teamId: r.teamId, teamName: r.teamName,
    }));
    const order = seedOrder(size); // e.g. [1,8,4,5,2,7,3,6]
    const matchups = [];
    for (let i = 0; i < order.length; i += 2) {
      const hi = order[i], lo = order[i + 1];
      const home = seeds[hi - 1], away = seeds[lo - 1];
      matchups.push(makeMatchup(1, i / 2, home, away));
    }
    return {
      size, totalRounds: totalRoundsFor(size),
      seeds, rounds: [{ round: 1, matchups }], champion: null,
    };
  }
  function makeMatchup(round, slot, home, away) {
    return {
      id: `m-r${round}-s${slot}`, round, slot,
      homeSeed: home ? home.seed : null, awaySeed: away ? away.seed : null,
      homeId: home ? home.teamId : null, awayId: away ? away.teamId : null,
      homeName: home ? home.teamName : null, awayName: away ? away.teamName : null,
      homeScore: null, awayScore: null, winnerId: null, status: "scheduled",
    };
  }
  function matchupWinner(m) {
    if (m.winnerId == null) return null;
    return m.winnerId === m.homeId ? "home" : "away";
  }
  function roundComplete(round) {
    return round.matchups.length > 0 && round.matchups.every((m) => m.status === "final");
  }
  // build the next round from the winners of `round`
  function buildNextRound(bracket, roundIdx) {
    const cur = bracket.rounds[roundIdx];
    if (!roundComplete(cur)) return null;
    const nextRoundNo = cur.round + 1;
    if (nextRoundNo > bracket.totalRounds) return null;
    const winners = cur.matchups.map((m) => {
      const side = matchupWinner(m);
      const seed = side === "home" ? m.homeSeed : m.awaySeed;
      const teamId = side === "home" ? m.homeId : m.awayId;
      const teamName = side === "home" ? m.homeName : m.awayName;
      return { seed, teamId, teamName };
    });
    const matchups = [];
    for (let i = 0; i < winners.length; i += 2) {
      // higher seed (smaller number) is home
      const a = winners[i], b = winners[i + 1];
      const home = a.seed <= b.seed ? a : b;
      const away = home === a ? b : a;
      matchups.push(makeMatchup(nextRoundNo, i / 2, home, away));
    }
    return { round: nextRoundNo, matchups };
  }
  function deriveChampion(bracket) {
    const finalRound = bracket.rounds.find((r) => r.round === bracket.totalRounds);
    if (!finalRound) return null;
    const f = finalRound.matchups[0];
    if (!f || f.status !== "final") return null;
    const side = matchupWinner(f);
    return {
      teamId: side === "home" ? f.homeId : f.awayId,
      teamName: side === "home" ? f.homeName : f.awayName,
      seed: side === "home" ? f.homeSeed : f.awaySeed,
    };
  }

  // ---- fake star players (deterministic, for game previews) -------------------
  const FIRST = ["Jaylen", "Marcus", "Trey", "Xavier", "Deshawn", "Cade", "Bryce", "Malik",
    "Tyson", "Elijah", "Kobe", "Amari", "Zion", "Landon", "Isaiah", "Dorian", "Rashad", "Kellen"];
  const LAST = ["Harris", "Boone", "Vega", "Okafor", "Sims", "Whitfield", "Duran", "Colter",
    "Pruitt", "Ellison", "Baptiste", "Rhodes", "Calloway", "Means", "Dawkins", "Fontaine"];
  const POSN = ["QB", "RB", "WR", "WR", "LB", "DB", "DL"];
  function starPlayers(teamId) {
    const rng = rngFor("stars|" + teamId);
    const base = TEAM_BY_ID[teamId].ovr;
    const used = new Set();
    return POSN.slice(0, 4).map((pos) => {
      let name;
      do {
        name = FIRST[Math.floor(rng() * FIRST.length)] + " " + LAST[Math.floor(rng() * LAST.length)];
      } while (used.has(name));
      used.add(name);
      return { name, pos, rating: Math.min(99, Math.round(base + (rng() * 12 - 4))) };
    });
  }
  // ---- full synthetic rosters (deterministic; drives the Players screen) ------
  // Every team gets a realistic 48-man depth chart. Not real people.
  const R_FIRST = ["Jaylen", "Marcus", "Trey", "Xavier", "Deshawn", "Cade", "Bryce", "Malik",
    "Tyson", "Elijah", "Kobe", "Amari", "Zion", "Landon", "Isaiah", "Dorian", "Rashad", "Kellen",
    "Aiden", "Brody", "Carter", "Deacon", "Emory", "Gage", "Hudson", "Jamal", "Keon", "Lucas",
    "Micah", "Nolan", "Owen", "Preston", "Quinn", "Reggie", "Silas", "Tavian", "Vince", "Wyatt"];
  const R_LAST = ["Harris", "Boone", "Vega", "Okafor", "Sims", "Whitfield", "Duran", "Colter",
    "Pruitt", "Ellison", "Baptiste", "Rhodes", "Calloway", "Means", "Dawkins", "Fontaine",
    "Bryant", "Cross", "Coleman", "Fields", "Grant", "Holloway", "Ibarra", "Jennings", "Knox",
    "Lang", "Mercer", "Nash", "Ortega", "Paige", "Quintero", "Reese", "Salazar", "Tran", "Underwood"];
  // position → count; sums to 48
  const ROSTER_TEMPLATE = [
    ["QB", 3], ["RB", 4], ["WR", 6], ["TE", 3], ["OL", 8],
    ["DE", 3], ["DT", 3], ["ILB", 3], ["OLB", 3], ["CB", 5], ["FS", 2], ["SS", 2],
    ["K", 1], ["P", 1], ["LS", 1],
  ];
  const POS_GROUP = {
    QB: "off", RB: "off", WR: "off", TE: "off", OL: "off",
    DE: "def", DT: "def", ILB: "def", OLB: "def", CB: "def", FS: "def", SS: "def",
    K: "st", P: "st", LS: "st",
  };
  const _rosterCache = {};
  function fullRoster(teamId) {
    if (_rosterCache[teamId]) return _rosterCache[teamId];
    const rng = rngFor("roster|" + teamId);
    const base = TEAM_BY_ID[teamId].ovr;
    const usedNums = new Set();
    const players = [];
    let idx = 0;
    for (const [pos, count] of ROSTER_TEMPLATE) {
      for (let i = 0; i < count; i++) {
        const name = R_FIRST[Math.floor(rng() * R_FIRST.length)] + " " + R_LAST[Math.floor(rng() * R_LAST.length)];
        let num = 0, guard = 0;
        do { num = Math.floor(rng() * 100); guard++; } while (usedNums.has(num) && guard < 300);
        usedNums.add(num);
        const starter = i === 0; // first at each position = starter, rated a touch higher
        let rating = Math.round(base + (starter ? 7 : 0) + (rng() * 22 - 13));
        rating = Math.max(41, Math.min(99, rating));
        const roll = rng();
        const status = roll > 0.945 ? "Injured" : roll > 0.915 ? "Inactive" : "Active";
        players.push({ id: teamId + "-" + idx, teamId, name, pos, group: POS_GROUP[pos], num, rating, status, starter });
        idx++;
      }
    }
    _rosterCache[teamId] = players;
    return players;
  }

  // one headline stat line per team for the gamecast leaders panel
  function leaderLines(teamId, pts, rng) {
    const s = starPlayers(teamId);
    const qb = s.find((p) => p.pos === "QB");
    const rb = s.find((p) => p.pos === "RB");
    const wr = s.find((p) => p.pos === "WR");
    const passYd = 120 + Math.round(rng() * 210);
    const rushYd = 40 + Math.round(rng() * 160);
    const recYd = 30 + Math.round(rng() * 130);
    return [
      qb && { name: qb.name, pos: "QB", line: `${passYd} yds, ${Math.max(1, Math.round(pts / 9))} TD` },
      rb && { name: rb.name, pos: "RB", line: `${rushYd} yds rush` },
      wr && { name: wr.name, pos: "WR", line: `${recYd} yds, ${Math.round(rng() * 2)} TD` },
    ].filter(Boolean);
  }

  // ---- gamecast recap (deterministic from final score) ------------------------
  function buildGamecast(fx) {
    const home = TEAM_BY_ID[fx.homeId], away = TEAM_BY_ID[fx.awayId];
    const rng = rngFor("cast|" + fx.id);
    const hs = fx.homeScore, as = fx.awayScore;
    // distribute points across 4 quarters, ending at the final
    function splitQuarters(total) {
      const q = [0, 0, 0, 0];
      let left = total;
      const scores = [0, 3, 6, 7, 7, 7, 10, 14];
      let guard = 0;
      while (left > 0 && guard++ < 20) {
        const s = scores[Math.floor(rng() * scores.length)];
        if (s <= left) { q[Math.floor(rng() * 4)] += s; left -= s; }
        else { q[3] += left; left = 0; }
      }
      return q;
    }
    const hq = splitQuarters(hs), aq = splitQuarters(as);
    const quarters = [0, 1, 2, 3].map((i) => ({ q: i + 1, home: hq[i], away: aq[i] }));
    const winProb = [];
    let cum = 50;
    for (let i = 0; i <= 12; i++) {
      const drift = ((hs - as) / 30) * (i / 12) * 50;
      const noise = (rng() * 2 - 1) * 8 * (1 - i / 14);
      cum = Math.max(2, Math.min(98, 50 + drift + noise));
      if (i === 12) cum = hs > as ? 100 : hs < as ? 0 : 50;
      winProb.push(Math.round(cum));
    }
    const plays = [];
    const evTeams = [fx.homeId, fx.awayId];
    let hh = 0, aa = 0;
    for (let q = 1; q <= 4; q++) {
      const n = 2 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const tId = evTeams[Math.floor(rng() * 2)];
        const isHome = tId === fx.homeId;
        const kind = rng() < 0.62 ? "TD" : "FG";
        const pts = kind === "TD" ? 7 : 3;
        if (isHome) hh += pts; else aa += pts;
        const sp = starPlayers(tId);
        const scorer = sp[Math.floor(rng() * sp.length)];
        plays.push({
          q, clock: `${Math.floor(rng() * 12)}:${String(Math.floor(rng() * 60)).padStart(2, "0")}`,
          teamId: tId, teamName: TEAM_BY_ID[tId].name,
          text: kind === "TD"
            ? `${scorer.name} ${rng() < 0.5 ? Math.round(2 + rng() * 40) + "-yd" : ""} ${["rushing TD", "receiving TD", "TD"][Math.floor(rng() * 3)]}`
            : `${Math.round(20 + rng() * 30)}-yd field goal`,
          home: hh, away: aa,
        });
      }
    }
    return {
      quarters, winProb, plays,
      leaders: {
        home: leaderLines(fx.homeId, hs, rng),
        away: leaderLines(fx.awayId, as, rng),
      },
    };
  }

  // ---- class distribution (dynasty) -------------------------------------------
  function defaultClassDist() {
    // ~48 players/team * 16 teams = 768, spread across four grades
    return { FR: 196, SO: 194, JR: 192, SR: 186, unknown: 0 };
  }
  function rolloverClassDist(prev) {
    // seniors graduate, everyone advances a grade, freshmen refill to seniors' size
    const graduated = prev.SR;
    return {
      dist: { FR: graduated, SO: prev.FR, JR: prev.SO, SR: prev.JR, unknown: 0 },
      graduated, advanced: prev.FR + prev.SO + prev.JR, freshmen: graduated,
    };
  }

  window.SL = {
    TEAMS, TEAM_BY_ID, teamColor, initials,
    DIVISIONS, divisionOf, divisionName, divisionStandings,
    formatDate, formatWhen, toISO, fromISO, addDays,
    generateFixtures, simGame, computeStandings, recordStr,
    roundLabel, seedBracket, buildNextRound, roundComplete, matchupWinner,
    deriveChampion, totalRoundsFor,
    starPlayers, fullRoster, buildGamecast,
    defaultClassDist, rolloverClassDist,
    rngFor, hashStr,
  };
})();
