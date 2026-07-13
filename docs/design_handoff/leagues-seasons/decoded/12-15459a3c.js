/* =============================================================================
   Screens — play side: shared season sub-header, Schedule (accordion weeks),
   Standings, and the Playoff bracket.
   ========================================================================== */

/* ---- small dropdown menu -------------------------------------------------- */
function Dropdown({ trigger, children, align = "end" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {React.cloneElement(trigger, { onClick: () => setOpen((o) => !o) })}
      {open ? (
        <div className="sl-menu" style={{ position: "absolute", top: "calc(100% + 6px)", [align === "end" ? "right" : "left"]: 0, zIndex: 30, width: 220 }}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </span>
  );
}
function MenuItem({ icon, children, onClick }) {
  return <button className="sl-menu__item" onClick={onClick}>{icon ? <Icon name={icon} size={15} /> : null}{children}</button>;
}

/* ---- season sub-header (schedule / standings / playoffs) ------------------ */
function SeasonSubHeader({ leagueId, seasonId, tab, actions }) {
  const { state, api } = useStoreCtx();
  const season = derive.season(state, seasonId);
  const seasons = state.seasons.filter((s) => s.leagueId === leagueId);
  const tabLabel = { schedule: "Schedule", standings: "Standings", playoffs: "Playoffs" }[tab];
  return (
    <>
      <BackLink label="Back to League" onClick={() => api.navigate("league", { leagueId })} />
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-h1" style={{ fontSize: 26 }}>{state.league.name}</h1>
          <p className="page-sub" style={{ marginTop: 6 }}>{tabLabel}{season ? ` · ${season.name}` : ""}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {season ? (
            <Dropdown trigger={
              <button className="sl-btn sl-btn--secondary sl-btn--sm" style={{ gap: 8 }}>
                <Icon name="calendar" size={15} style={{ color: "var(--text-subtle)" }} />
                {season.name}
                {season.status === "active" ? <span className="subtle" style={{ fontSize: 11 }}>(active)</span> : season.status === "upcoming" ? <span className="subtle" style={{ fontSize: 11 }}>(upcoming)</span> : null}
                <Icon name="chevron-vertical" size={14} style={{ color: "var(--text-subtle)" }} />
              </button>
            }>
              {(close) => seasons.map((s) => (
                <button key={s.id} className="sl-menu__item" onClick={() => { close(); api.navigate(tab, { leagueId, seasonId: s.id }); }}>
                  <span style={{ width: 15, display: "inline-flex", color: "var(--accent)" }}>{s.id === seasonId ? <Icon name="check" size={14} /> : null}</span>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span className="subtle" style={{ fontSize: 11 }}>{s.status}</span>
                </button>
              ))}
            </Dropdown>
          ) : null}
          {actions}
        </div>
      </header>
    </>
  );
}

/* ---- schedule ------------------------------------------------------------- */
function GameRow({ seasonId, fx }) {
  const { api } = useStoreCtx();
  const open = () => api.openGame({ kind: "fixture", seasonId, id: fx.id });
  const stop = (e) => e.stopPropagation();
  const final = fx.status === "final";
  return (
    <tr className="rowbtn" onClick={open}>
      <td className="sl-mono subtle" style={{ fontSize: 12 }}>{SL.formatWhen(fx.dateISO)}</td>
      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><TeamMark id={fx.homeId} size={22} />{SL.TEAM_BY_ID[fx.homeId].name}</span></td>
      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><TeamMark id={fx.awayId} size={22} />{SL.TEAM_BY_ID[fx.awayId].name}</span></td>
      <td className="tbl__num" style={{ textAlign: "right" }}>{final ? `${fx.homeScore} – ${fx.awayScore}` : "—"}</td>
      <td><StatusBadge status={fx.status} /></td>
      <td onClick={stop}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {final ? (
            <button className="link" onClick={open} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="tv" size={14} />Gamecast</button>
          ) : (
            <>
              <Button size="sm" variant="ghost" icon="dices" onClick={() => { const r = api.simFixture(seasonId, fx.id); if (r) toast.success(`Simulated: ${SL.TEAM_BY_ID[fx.homeId].name} ${r.homeScore}–${r.awayScore} ${SL.TEAM_BY_ID[fx.awayId].name}.`); }}>Sim</Button>
              <button className="link" onClick={open}>Preview</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
function WeekTable({ seasonId, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tbl" style={{ minWidth: 620 }}>
        <thead><tr><th>When</th><th>Home</th><th>Away</th><th style={{ textAlign: "right" }}>Score</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((fx) => <GameRow key={fx.id} seasonId={seasonId} fx={fx} />)}</tbody>
      </table>
    </div>
  );
}
function WeekSection({ seasonId, week, rows, open, onToggle }) {
  const { api } = useStoreCtx();
  const ui = useUI();
  const scheduled = rows.filter((f) => f.status !== "final");
  const finals = rows.filter((f) => f.status === "final");
  const [compOpen, setCompOpen] = React.useState(false);
  const allFinal = scheduled.length === 0;
  async function simWeek() {
    const ok = await ui.confirm({ title: `Simulate Week ${week}?`, description: `Simulate every unplayed game in Week ${week}? Already-recorded games are left untouched.`, confirmLabel: "Simulate week", tone: "primary" });
    if (!ok) return;
    const n = api.simWeek(seasonId, week);
    toast.success(n === 0 ? `No unplayed games in Week ${week}.` : `Simulated ${n} game${n === 1 ? "" : "s"} in Week ${week}.`);
  }
  return (
    <AccordionSection
      open={open} onToggle={onToggle}
      title={`Week ${week}`}
      subtitle={`${rows.length} games`}
      tone={allFinal ? <Badge variant="neutral">Final</Badge> : scheduled.length === rows.length ? <Badge variant="outline">Scheduled</Badge> : <Badge variant="warning">{finals.length}/{rows.length} played</Badge>}
      right={scheduled.length > 0 ? <Button size="sm" icon="calendar" onClick={simWeek}>Sim week</Button> : null}
    >
      {scheduled.length > 0 ? <WeekTable seasonId={seasonId} rows={scheduled} /> : null}
      {finals.length > 0 && scheduled.length > 0 ? (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <button className="sl-acc__trigger" onClick={() => setCompOpen((o) => !o)} style={{ width: "100%" }}>
            <span className={"sl-acc__chev" + (compOpen ? " is-open" : "")}><Icon name="chevron-right" size={15} /></span>
            <span className="muted" style={{ fontSize: 13 }}>Completed games ({finals.length})</span>
          </button>
          {compOpen ? <WeekTable seasonId={seasonId} rows={finals} /> : null}
        </div>
      ) : null}
      {finals.length > 0 && scheduled.length === 0 ? <WeekTable seasonId={seasonId} rows={finals} /> : null}
    </AccordionSection>
  );
}
function ScheduleScreen({ leagueId, seasonId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const season = derive.season(state, seasonId);
  const fixtures = derive.fixtures(state, seasonId);
  const prog = derive.regularProgress(state, seasonId);
  const bracket = derive.bracket(state, seasonId);
  // group by week
  const byWeek = {};
  fixtures.forEach((f) => { (byWeek[f.week] = byWeek[f.week] || []).push(f); });
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  // default open = weeks with unplayed games
  const [openSet, setOpenSet] = React.useState(() => new Set(weeks.filter((w) => byWeek[w].some((f) => f.status !== "final"))));
  const toggle = (w) => setOpenSet((s) => { const n = new Set(s); n.has(w) ? n.delete(w) : n.add(w); return n; });
  const allOpen = weeks.length > 0 && weeks.every((w) => openSet.has(w));

  async function generate() { await generateScheduleFlow({ api, ui, season, hasFixtures: fixtures.length > 0 }); }

  const actions = (
    <>
      <a className="link" onClick={() => api.navigate("standings", { leagueId, seasonId })}>Standings →</a>
      <a className="link" onClick={() => api.navigate("playoffs", { leagueId, seasonId })}>Playoffs →</a>
      {fixtures.length >= 1 ? <Button size="sm" icon="calendar-plus" onClick={generate}>{fixtures.length ? "Regenerate schedule" : "Generate schedule"}</Button> : null}
      {fixtures.length > 0 ? (
        <Dropdown trigger={<Button size="sm" icon="wand" iconRight="chevron-down">Simulate</Button>}>
          {(close) => <>
            <div className="sl-menu__item" style={{ cursor: "default", color: "var(--text-subtle)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>Simulation scope</div>
            <div className="sl-menu__sep" />
            <MenuItem icon="dices" onClick={async () => { close(); const ok = await ui.confirm({ title: "Simulate regular season?", description: "Simulate every unplayed regular-season game? Scores come from team ratings. Already-recorded games are left untouched.", confirmLabel: "Simulate", tone: "primary" }); if (!ok) return; const n = api.simRegularSeason(seasonId); toast.success(n === 0 ? "No unplayed regular-season games." : `Simulated ${n} regular-season game${n === 1 ? "" : "s"}.`); }}>Sim regular season</MenuItem>
            <MenuItem icon="trophy" onClick={() => { close(); if (!bracket) { toast.error("No bracket yet — start the playoffs first.", { action: { label: "Playoffs", onClick: () => api.navigate("playoffs", { leagueId, seasonId }) } }); return; } api.navigate("playoffs", { leagueId, seasonId }); }}>Sim playoffs</MenuItem>
          </>}
        </Dropdown>
      ) : null}
    </>
  );

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Leagues", onClick: () => api.navigate("leagues") }, { label: state.league.name, onClick: () => api.navigate("league", { leagueId }) }, { label: "Schedule" }]} />
      <SeasonSubHeader leagueId={leagueId} seasonId={seasonId} tab="schedule" actions={actions} />

      {fixtures.length === 0 ? (
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 44, textAlign: "center", borderStyle: "dashed", borderColor: "var(--border-strong)" }}>
          <span className="subtle"><Icon name="calendar-plus" size={26} /></span>
          <p className="muted">No fixtures scheduled yet for {season.name}. Generate a round-robin to get started.</p>
          <Button variant="primary" icon="calendar-plus" onClick={generate}>Generate schedule</Button>
        </Card>
      ) : (
        <>
          {prog.complete && !bracket ? (
            <div className="banner-cta banner-cta--accent" style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={22} /></span>
                <div><p style={{ margin: 0, font: "700 16px/1.2 inherit" }}>Regular season complete</p><p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>All {prog.total} games are final — seed the bracket to begin the playoffs.</p></div>
              </div>
              <Button variant="primary" icon="trophy" onClick={() => api.navigate("playoffs", { leagueId, seasonId })}>Start playoffs</Button>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}><span className="sl-mono">{prog.final}/{prog.total}</span> regular-season games played</p>
            <button className="link link--muted" onClick={() => setOpenSet(allOpen ? new Set() : new Set(weeks))}>{allOpen ? "Collapse all" : "Expand all"}</button>
          </div>
          {weeks.map((w) => (
            <WeekSection key={w} seasonId={seasonId} week={w} rows={byWeek[w]} open={openSet.has(w)} onToggle={() => toggle(w)} />
          ))}
        </>
      )}
    </div>
  );
}

/* ---- standings ------------------------------------------------------------ */
function StandingsScreen({ leagueId, seasonId }) {
  const { state, api } = useStoreCtx();
  const season = derive.season(state, seasonId);
  const st = derive.standings(state, seasonId);
  const played = derive.regularProgress(state, seasonId).final > 0;
  const playoffCut = season.playoffTeams || 0;
  const actions = <>
    <a className="link" onClick={() => api.navigate("schedule", { leagueId, seasonId })}>Schedule →</a>
    <a className="link" onClick={() => api.navigate("playoffs", { leagueId, seasonId })}>Playoffs →</a>
  </>;
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Leagues", onClick: () => api.navigate("leagues") }, { label: state.league.name, onClick: () => api.navigate("league", { leagueId }) }, { label: "Standings" }]} />
      <SeasonSubHeader leagueId={leagueId} seasonId={seasonId} tab="standings" actions={actions} />
      {!played ? <Card style={{ padding: 40, textAlign: "center" }} className="muted">No recorded results yet.</Card> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th style={{ textAlign: "right" }}>W</th><th style={{ textAlign: "right" }}>L</th><th style={{ textAlign: "right" }}>T</th><th style={{ textAlign: "right" }}>PF</th><th style={{ textAlign: "right" }}>PA</th><th style={{ textAlign: "right" }}>Diff</th></tr></thead>
              <tbody>
                {st.map((r) => (
                  <React.Fragment key={r.teamId}>
                    <tr className="rowbtn">
                      <td className="sl-mono subtle">{r.rank}</td>
                      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                        <TeamMark id={r.teamId} size={24} />{r.teamName}
                        {playoffCut && r.rank <= playoffCut ? <Badge variant="success">Clinched</Badge> : null}
                      </span></td>
                      <td className="tbl__num" style={{ textAlign: "right" }}>{r.wins}</td>
                      <td className="tbl__num" style={{ textAlign: "right" }}>{r.losses}</td>
                      <td className="tbl__num" style={{ textAlign: "right" }}>{r.ties}</td>
                      <td className="tbl__num" style={{ textAlign: "right" }}>{r.pf}</td>
                      <td className="tbl__num" style={{ textAlign: "right" }}>{r.pa}</td>
                      <td className="tbl__num" style={{ textAlign: "right", color: r.diff > 0 ? "var(--accent)" : r.diff < 0 ? "var(--text-muted)" : "var(--text-subtle)" }}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                    </tr>
                    {playoffCut && r.rank === playoffCut ? (
                      <tr><td colSpan={8} style={{ padding: 0 }}><div style={{ borderTop: "2px dashed var(--border-strong)", position: "relative" }}><span className="sl-mono subtle" style={{ position: "absolute", right: 12, top: -8, background: "var(--surface)", padding: "0 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Playoff cut</span></div></td></tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---- playoffs ------------------------------------------------------------- */
function MatchupCard({ seasonId, m, onOpen }) {
  const decided = m.status === "final";
  const winner = SL.matchupWinner(m);
  const Side = ({ side }) => {
    const isHome = side === "home";
    const teamId = isHome ? m.homeId : m.awayId;
    const seed = isHome ? m.homeSeed : m.awaySeed;
    const score = isHome ? m.homeScore : m.awayScore;
    const won = winner === side;
    return (
      <div className={"matchup__side" + (won ? " is-win" : decided ? " is-loss" : "")}>
        <span className="matchup__seed">{seed ?? ""}</span>
        {teamId ? <TeamMark id={teamId} size={20} /> : null}
        <span className={"matchup__name" + (teamId ? "" : " matchup__tbd")}>{teamId ? SL.TEAM_BY_ID[teamId].name : "TBD"}</span>
        <span className="matchup__score">{score ?? ""}</span>
      </div>
    );
  };
  const clickable = !!(m.homeId && m.awayId);
  return (
    <div className={"matchup" + (clickable ? "" : "")} onClick={clickable ? onOpen : undefined}
      style={{ cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.7 }}>
      <Side side="home" /><Side side="away" />
    </div>
  );
}
function PlayoffsScreen({ leagueId, seasonId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const season = derive.season(state, seasonId);
  const prog = derive.regularProgress(state, seasonId);
  const bracket = derive.bracket(state, seasonId);
  const phase = derive.playoffPhase(state, seasonId);
  const champ = bracket ? bracket.champion : null;

  async function start() {
    const ok = await ui.confirm({ title: "Advance to playoffs?", description: `Seed the ${season.playoffTeams}-team single-elimination bracket from the current standings and schedule the first round.`, confirmLabel: "Start playoffs", tone: "primary" });
    if (!ok) return;
    await ui.process({ title: "Seeding bracket", subtitle: `Ranking teams and building the ${season.playoffTeams}-team bracket.`, steps: ["Reading final standings", "Assigning seeds", "Building first-round matchups", "Scheduling games"], doneLabel: "Bracket seeded" });
    api.startPlayoffs(seasonId);
    toast.success(`Playoffs started — ${season.playoffTeams}-team bracket seeded.`);
  }

  const actions = <>
    <a className="link" onClick={() => api.navigate("schedule", { leagueId, seasonId })}>← Schedule</a>
    <a className="link" onClick={() => api.navigate("standings", { leagueId, seasonId })}>Standings →</a>
  </>;

  // bracket controls
  let controls = null, advanceBtn = null;
  if (bracket) {
    const lastIdx = bracket.rounds.length - 1;
    const lastRound = bracket.rounds[lastIdx];
    const lastComplete = SL.roundComplete(lastRound);
    const canAdvance = lastComplete && lastRound.round < bracket.totalRounds;
    const finalBuilt = bracket.rounds.some((r) => r.round === bracket.totalRounds);
    const finalRound = bracket.rounds.find((r) => r.round === bracket.totalRounds);
    const finalUnplayed = finalBuilt && finalRound.matchups.some((m) => m.status !== "final" && m.homeId && m.awayId);
    if (canAdvance) {
      const nextLabel = SL.roundLabel(lastRound.round + 1, bracket.totalRounds);
      advanceBtn = <Button variant="primary" icon="arrow-right" onClick={() => { api.advanceRound(seasonId); toast.success(`${nextLabel} is set.`); }}>{`Advance to ${nextLabel}`}</Button>;
    }
    controls = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {advanceBtn}
        {finalUnplayed ? <Button variant="primary" icon="trophy" onClick={() => { const fm = finalRound.matchups.find((m) => m.status !== "final"); api.openGame({ kind: "matchup", seasonId, id: fm.id }); }}>Play championship</Button> : null}
        {!champ ? <Button icon="wand" onClick={async () => { const ok = await ui.confirm({ title: "Simulate playoffs?", description: "Simulate every unplayed playoff game round by round, up to — but not including — the championship game. You’ll decide the title game yourself.", confirmLabel: "Sim to the final", tone: "primary" }); if (!ok) return; const n = api.simPlayoffsExcludingFinal(seasonId); toast.success(n === 0 ? "Bracket already at the championship." : `Simulated ${n} playoff game${n === 1 ? "" : "s"} — the championship is set.`); }}>Sim playoffs</Button> : null}
        {!champ ? <Button icon="trophy" onClick={async () => { const ok = await ui.confirm({ title: "Sim to champion?", description: "Simulate every remaining playoff game — including the championship — to crown a champion now.", confirmLabel: "Crown a champion", tone: "primary" }); if (!ok) return; api.simToChampion(seasonId); const c = derive.bracket(state, seasonId); toast.success("Champion crowned."); }}>Sim to champion</Button> : null}
      </div>
    );
  }

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Leagues", onClick: () => api.navigate("leagues") }, { label: state.league.name, onClick: () => api.navigate("league", { leagueId }) }, { label: "Playoffs" }]} />
      <SeasonSubHeader leagueId={leagueId} seasonId={seasonId} tab="playoffs" actions={actions} />

      {phase === "no_playoffs_config" ? (
        <Card style={{ padding: 32, textAlign: "center" }} className="muted">{season.name} is not configured for playoffs. Set a playoff team count on the season to enable the bracket.</Card>
      ) : phase === "ready" ? (
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={30} /></span>
          <p className="muted" style={{ maxWidth: 440 }}>Regular season complete ({prog.final} of {prog.total} games final). Ready to seed the bracket from the current standings.</p>
          <Button variant="primary" icon="trophy" onClick={start}>Advance to playoffs</Button>
        </Card>
      ) : phase === "in_progress" ? (
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <p className="muted">Regular season in progress — {prog.final} of {prog.total} games final. Finish the schedule to seed the bracket.</p>
          <Button icon="calendar" onClick={() => api.navigate("schedule", { leagueId, seasonId })}>Go to schedule</Button>
        </Card>
      ) : (
        <>
          {champ ? (
            <div className="banner-cta banner-cta--accent" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={26} /></span>
                <div>
                  <p className="eyebrow" style={{ color: "var(--accent)" }}>Champion</p>
                  <p style={{ margin: "4px 0 0", font: "700 20px/1.1 inherit", letterSpacing: "-.3px" }}>{champ.teamName}</p>
                </div>
              </div>
              <Button variant="outline" icon="arrow-right" onClick={() => api.navigate("season", { seasonId })}>Season recap →</Button>
            </div>
          ) : null}
          {controls ? <div style={{ marginBottom: 18 }}>{controls}</div> : null}
          <Card style={{ padding: 20 }}>
            <div className="bracket">
              {Array.from({ length: bracket.totalRounds }).map((_, i) => {
                const roundNo = i + 1;
                const existing = bracket.rounds.find((r) => r.round === roundNo);
                const label = SL.roundLabel(roundNo, bracket.totalRounds);
                const count = bracket.size / Math.pow(2, roundNo);
                return (
                  <div className="bracket__col" key={roundNo}>
                    <div className="bracket__label" style={{ marginBottom: 0 }}>{label}</div>
                    {existing ? existing.matchups.map((m) => (
                      <MatchupCard key={m.id} seasonId={seasonId} m={m} onOpen={() => api.openGame({ kind: "matchup", seasonId, id: m.id })} />
                    )) : Array.from({ length: count }).map((__, k) => (
                      <div className="matchup" key={k} style={{ opacity: 0.6, cursor: "default" }}>
                        <div className="matchup__side"><span className="matchup__seed" /><span className="matchup__name matchup__tbd">TBD</span></div>
                        <div className="matchup__side"><span className="matchup__seed" /><span className="matchup__name matchup__tbd">TBD</span></div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

Object.assign(window, { Dropdown, MenuItem, SeasonSubHeader, ScheduleScreen, StandingsScreen, PlayoffsScreen, MatchupCard, GameRow });
