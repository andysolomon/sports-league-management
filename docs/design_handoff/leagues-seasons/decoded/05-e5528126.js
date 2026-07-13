/* =============================================================================
   Store — all mutable state + actions for the prototype.
   State is plain/serializable; App orchestrates modals and calls these mutators.
   ========================================================================== */

const WEEKS = 11;
const TARGET_ROSTER = 48;
const LS_KEY = "sl-proto-state-v4";
const SCREENS = ["overview", "leagues", "league", "league-manage", "seasons", "season",
  "schedule", "standings", "playoffs", "teams", "players", "divisions", "import", "billing", "discover"];

/* ---- deterministic season builders --------------------------------------- */
function simFixtureScore(fx, flavor, noTies) {
  const { homeScore, awayScore } = SL.simGame(fx, flavor, { noTies });
  return { ...fx, homeScore, awayScore, status: "final" };
}
function simAllRegular(fixtures, flavor) {
  return fixtures.map((fx) => (fx.status === "final" ? fx : simFixtureScore(fx, flavor, false)));
}
function simMatchup(m, flavor) {
  const r = SL.simGame({ id: m.id, homeId: m.homeId, awayId: m.awayId }, flavor, { noTies: true });
  const winnerId = r.homeScore >= r.awayScore ? m.homeId : m.awayId;
  return { ...m, homeScore: r.homeScore, awayScore: r.awayScore, winnerId, status: "final" };
}
function playBracketFully(bracket, flavor) {
  let b = { ...bracket, rounds: bracket.rounds.map((r) => ({ ...r, matchups: r.matchups.map((m) => ({ ...m })) })) };
  let guard = 0;
  while (guard++ < 12) {
    const idx = b.rounds.findIndex((r) => !SL.roundComplete(r));
    if (idx === -1) {
      const next = SL.buildNextRound(b, b.rounds.length - 1);
      if (!next) break;
      b.rounds = [...b.rounds, next];
      continue;
    }
    b.rounds = b.rounds.map((r, i) => i === idx ? { ...r, matchups: r.matchups.map((m) => m.status === "final" ? m : simMatchup(m, flavor)) } : r);
  }
  b.champion = SL.deriveChampion(b);
  return b;
}

function buildInitialState() {
  const flavor = "balanced";
  // 2026 — fully completed season with a crowned champion (for "review past season")
  const f26 = simAllRegular(SL.generateFixtures("s2026", "2025-07-11", WEEKS), flavor);
  const st26 = SL.computeStandings(f26);
  const b26 = playBracketFully(SL.seedBracket(st26, 8), flavor);
  // 2027 — active, end of regular season (all regular games final, no bracket yet)
  const f27 = simAllRegular(SL.generateFixtures("s2027", "2026-07-10", WEEKS), flavor);

  const rostersFull = () => Object.fromEntries(SL.TEAMS.map((t) => [t.id, TARGET_ROSTER]));

  return {
    version: LS_KEY,
    league: { id: "cobb", name: "Cobb County Football", org: true },
    seasons: [
      { id: "s2026", leagueId: "cobb", name: "Cobb Football", year: 2026, status: "completed",
        start: "2025-07-11", end: "2025-10-31", playoffTeams: 8, playoffFormat: "single" },
      { id: "s2027", leagueId: "cobb", name: "Cobb Football 2027", year: 2027, status: "active",
        start: "2026-07-10", end: "2026-10-30", playoffTeams: 8, playoffFormat: "single" },
    ],
    fixtures: { s2026: f26, s2027: f27 },
    brackets: { s2026: b26, s2027: null },
    rosters: { s2026: rostersFull(), s2027: rostersFull() },
    classDist: SL.defaultClassDist(),
    seq: 1, // for id generation
  };
}

/* ---- derived helpers (read-only) ----------------------------------------- */
const derive = {
  season: (s, id) => s.seasons.find((x) => x.id === id) || null,
  activeSeason: (s) => s.seasons.find((x) => x.status === "active") || null,
  upcomingSeason: (s) => s.seasons.find((x) => x.status === "upcoming") || null,
  fixtures: (s, id) => s.fixtures[id] || [],
  bracket: (s, id) => s.brackets[id] || null,
  regularProgress(s, id) {
    const fx = (s.fixtures[id] || []).filter((f) => f.stage === "regular");
    const final = fx.filter((f) => f.status === "final").length;
    return { total: fx.length, final, complete: fx.length > 0 && final === fx.length };
  },
  standings: (s, id) => SL.computeStandings(s.fixtures[id] || []),
  undersized(s, id) {
    const r = s.rosters[id] || {};
    return SL.TEAMS.filter((t) => (r[t.id] || 0) < TARGET_ROSTER)
      .map((t) => ({ id: t.id, name: t.name, count: r[t.id] || 0 }));
  },
  seasonDecided(s, id) {
    const b = s.brackets[id];
    if (b) return !!b.champion;
    return derive.regularProgress(s, id).complete;
  },
  champion(s, id) { const b = s.brackets[id]; return b ? b.champion : null; },
  // playoff phase: mirrors playoffPagePhase in the real app
  playoffPhase(s, id) {
    const season = derive.season(s, id);
    if (!season || !season.playoffTeams || season.playoffTeams < 2) return "no_playoffs_config";
    if (s.brackets[id]) return "bracket_live";
    if (derive.regularProgress(s, id).complete) return "ready";
    return "in_progress";
  },
  // index of the current active (incomplete-but-fillable) playoff round; -1 if all done
  activeRoundIndex(b) { return b.rounds.findIndex((r) => !SL.roundComplete(r)); },
};

/* ---- the hook ------------------------------------------------------------- */
function useStore() {
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.data && p.data.version === LS_KEY) return p.data;
      }
    } catch (e) { /* ignore */ }
    return buildInitialState();
  });
  const [nav, setNav] = React.useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.nav && SCREENS.includes(p.nav.screen)) return p.nav; }
    } catch (e) { /* ignore */ }
    return { screen: "season", params: { seasonId: "s2027" }, history: [] };
  });
  const [gameView, setGameView] = React.useState(null); // {mode, fixture?|matchup?, seasonId}

  // persist
  React.useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ data: state, nav: { ...nav, history: nav.history.slice(-12) } })); }
    catch (e) { /* ignore */ }
  }, [state, nav]);

  const flavorRef = React.useRef("balanced");

  const api = React.useMemo(() => {
    const patch = (fn) => setState((s) => fn(s));
    const setFixtures = (s, id, fx) => ({ ...s, fixtures: { ...s.fixtures, [id]: fx } });
    const setBracket = (s, id, b) => ({ ...s, brackets: { ...s.brackets, [id]: b } });

    return {
      setFlavor(f) { flavorRef.current = f; },
      // ---- navigation
      navigate(screen, params = {}) {
        setNav((n) => ({ screen, params, history: [...n.history, { screen: n.screen, params: n.params }] }));
        document.querySelector(".content")?.scrollTo({ top: 0 });
      },
      back(fallback) {
        setNav((n) => {
          if (n.history.length) {
            const prev = n.history[n.history.length - 1];
            return { screen: prev.screen, params: prev.params, history: n.history.slice(0, -1) };
          }
          return fallback ? { ...fallback, history: [] } : n;
        });
      },
      canBack() { return nav.history.length > 0; },
      openGame(v) { setGameView(v); },
      closeGame() { setGameView(null); },

      // ---- schedule / sim
      simFixture(id, fixtureId) {
        let result = null;
        patch((s) => {
          const fx = (s.fixtures[id] || []).map((f) => {
            if (f.id !== fixtureId || f.status === "final") return f;
            const done = simFixtureScore(f, flavorRef.current, false);
            result = done; return done;
          });
          return setFixtures(s, id, fx);
        });
        return result;
      },
      simWeek(id, week) {
        let n = 0;
        patch((s) => {
          const fx = (s.fixtures[id] || []).map((f) => {
            if (f.week !== week || f.status === "final") return f;
            n++; return simFixtureScore(f, flavorRef.current, false);
          });
          return setFixtures(s, id, fx);
        });
        return n;
      },
      simRegularSeason(id) {
        let n = 0;
        patch((s) => {
          const fx = (s.fixtures[id] || []).map((f) => {
            if (f.stage !== "regular" || f.status === "final") return f;
            n++; return simFixtureScore(f, flavorRef.current, false);
          });
          return setFixtures(s, id, fx);
        });
        return n;
      },
      recordResult(id, fixtureId, homeScore, awayScore) {
        patch((s) => setFixtures(s, id, (s.fixtures[id] || []).map((f) =>
          f.id === fixtureId ? { ...f, homeScore, awayScore, status: "final" } : f)));
      },
      generateSchedule(id) {
        patch((s) => {
          const season = derive.season(s, id);
          const fx = SL.generateFixtures(id, season.start, WEEKS);
          return setBracket(setFixtures(s, id, fx), id, null);
        });
      },
      fillRosters(id) {
        patch((s) => ({ ...s, rosters: { ...s.rosters, [id]: Object.fromEntries(SL.TEAMS.map((t) => [t.id, TARGET_ROSTER])) } }));
      },

      // ---- playoffs
      startPlayoffs(id) {
        patch((s) => {
          const season = derive.season(s, id);
          const st = SL.computeStandings(s.fixtures[id] || []);
          const b = SL.seedBracket(st, season.playoffTeams || 8);
          return setBracket(s, id, b);
        });
      },
      advanceRound(id) {
        patch((s) => {
          const b = s.brackets[id]; if (!b) return s;
          const next = SL.buildNextRound(b, b.rounds.length - 1);
          if (!next) return s;
          const nb = { ...b, rounds: [...b.rounds, next] };
          nb.champion = SL.deriveChampion(nb);
          return setBracket(s, id, nb);
        });
      },
      simMatchup(id, matchupId) {
        let res = null;
        patch((s) => {
          const b = s.brackets[id]; if (!b) return s;
          const rounds = b.rounds.map((r) => ({
            ...r, matchups: r.matchups.map((m) => {
              if (m.id !== matchupId || m.status === "final") return m;
              const done = simMatchup(m, flavorRef.current); res = done; return done;
            }),
          }));
          const nb = { ...b, rounds }; nb.champion = SL.deriveChampion(nb);
          return setBracket(s, id, nb);
        });
        return res;
      },
      recordMatchup(id, matchupId, homeScore, awayScore) {
        patch((s) => {
          const b = s.brackets[id]; if (!b) return s;
          const rounds = b.rounds.map((r) => ({
            ...r, matchups: r.matchups.map((m) => {
              if (m.id !== matchupId) return m;
              const winnerId = homeScore >= awayScore ? m.homeId : m.awayId;
              return { ...m, homeScore, awayScore, winnerId, status: "final" };
            }),
          }));
          const nb = { ...b, rounds }; nb.champion = SL.deriveChampion(nb);
          return setBracket(s, id, nb);
        });
      },
      // Sim playoffs round-by-round, but STOP before the championship game.
      simPlayoffsExcludingFinal(id) {
        let played = 0;
        patch((s) => {
          let b = s.brackets[id]; if (!b) return s;
          b = { ...b, rounds: b.rounds.map((r) => ({ ...r, matchups: r.matchups.map((m) => ({ ...m })) })) };
          let guard = 0;
          while (guard++ < 12) {
            const idx = derive.activeRoundIndex(b);
            const isFinalRound = idx === -1 ? false : b.rounds[idx].round === b.totalRounds;
            if (idx === -1) {
              // current rounds all done — build next unless the next would be the final's parent already built
              const next = SL.buildNextRound(b, b.rounds.length - 1);
              if (!next) break;
              if (next.round === b.totalRounds) { b.rounds = [...b.rounds, next]; break; } // stop at final
              b.rounds = [...b.rounds, next];
              continue;
            }
            if (isFinalRound) break; // never sim the championship
            b.rounds = b.rounds.map((r, i) => i === idx
              ? { ...r, matchups: r.matchups.map((m) => { if (m.status === "final") return m; played++; return simMatchup(m, flavorRef.current); }) }
              : r);
          }
          b.champion = SL.deriveChampion(b);
          return setBracket(s, id, b);
        });
        return played;
      },
      simToChampion(id) {
        patch((s) => {
          let b = s.brackets[id];
          if (!b) {
            const season = derive.season(s, id);
            const st = SL.computeStandings(s.fixtures[id] || []);
            b = SL.seedBracket(st, season.playoffTeams || 8);
          }
          return setBracket(s, id, playBracketFully(b, flavorRef.current));
        });
      },
      setPlayoffTeams(id, n) {
        patch((s) => ({ ...s, seasons: s.seasons.map((x) => x.id === id ? { ...x, playoffTeams: n } : x) }));
      },

      // ---- season lifecycle
      completeSeason(id) {
        patch((s) => ({ ...s, seasons: s.seasons.map((x) => x.id === id ? { ...x, status: "completed" } : x) }));
      },
      makeActive(id) {
        patch((s) => ({ ...s, seasons: s.seasons.map((x) => {
          if (x.id === id) return { ...x, status: "active" };
          if (x.status === "active") return { ...x, status: "completed" };
          return x;
        }) }));
      },
      createSeason(leagueId, { name, start, end, playoffTeams, playoffFormat }) {
        let newId = null;
        patch((s) => {
          const seq = s.seq + 1; newId = "s-new-" + seq;
          const season = { id: newId, leagueId, name: name.trim(), year: 0, status: "upcoming",
            start: start || "2027-07-09", end: end || "2027-10-29",
            playoffTeams: playoffTeams ?? 8, playoffFormat: playoffFormat || "single" };
          return {
            ...s, seq,
            seasons: [...s.seasons, season],
            fixtures: { ...s.fixtures, [newId]: [] },
            brackets: { ...s.brackets, [newId]: null },
            rosters: { ...s.rosters, [newId]: Object.fromEntries(SL.TEAMS.map((t) => [t.id, 0])) },
          };
        });
        return newId;
      },
      deleteSeason(id) {
        patch((s) => {
          const seasons = s.seasons.filter((x) => x.id !== id);
          const fixtures = { ...s.fixtures }; delete fixtures[id];
          const brackets = { ...s.brackets }; delete brackets[id];
          const rosters = { ...s.rosters }; delete rosters[id];
          return { ...s, seasons, fixtures, brackets, rosters };
        });
      },
      renameSeason(id, name) {
        patch((s) => ({ ...s, seasons: s.seasons.map((x) => x.id === id ? { ...x, name } : x) }));
      },
      // Dynasty rollover: create next season, graduate/advance/recruit, copy rosters, make active.
      startNextSeason(leagueId, { activateNow }) {
        let summary = null, newId = null;
        patch((s) => {
          const active = derive.activeSeason(s);
          const seq = s.seq + 1; newId = "s-dyn-" + seq;
          const nextYear = (active?.year || 2027) + 1;
          const baseName = (active?.name || "Season").replace(/\d{4}/, "").trim() || "Season";
          const name = `${baseName} ${nextYear}`.replace(/\s+/, " ").trim();
          const roll = SL.rolloverClassDist(s.classDist);
          summary = roll;
          const startY = nextYear - 1; // matches prior pattern (season year is +1 of start)
          const season = { id: newId, leagueId, name, year: nextYear,
            status: activateNow ? "active" : "upcoming",
            start: `${startY}-07-09`, end: `${startY}-10-29`, playoffTeams: 8, playoffFormat: "single" };
          const seasons = s.seasons.map((x) => (activateNow && x.status === "active") ? { ...x, status: "completed" } : x);
          return {
            ...s, seq,
            classDist: roll.dist,
            seasons: [...seasons, season],
            fixtures: { ...s.fixtures, [newId]: [] },
            brackets: { ...s.brackets, [newId]: null },
            // dynasty copies rosters forward → new season starts fully rostered
            rosters: { ...s.rosters, [newId]: Object.fromEntries(SL.TEAMS.map((t) => [t.id, TARGET_ROSTER])) },
          };
        });
        return { summary, newId };
      },
      reset() {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        setState(buildInitialState());
        setNav({ screen: "season", params: { seasonId: "s2027" }, history: [] });
        setGameView(null);
      },
    };
  }, [nav.history.length]); // eslint-disable-line

  return { state, nav, gameView, api };
}

const StoreCtx = React.createContext(null);
const useStoreCtx = () => React.useContext(StoreCtx);

Object.assign(window, { useStore, StoreCtx, useStoreCtx, derive, WEEKS, TARGET_ROSTER });
