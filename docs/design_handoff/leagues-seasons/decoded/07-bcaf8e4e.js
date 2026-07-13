/* =============================================================================
   Screens — seasons: Seasons list (+ New season dialog, row actions) and the
   Season hub (landing screen).
   ========================================================================== */

function seasonArchive(state, season) {
  const fx = derive.fixtures(state, season.id);
  const total = fx.length;
  const final = fx.filter((f) => f.status === "final").length;
  const st = derive.standings(state, season.id);
  const leader = final > 0 ? st[0] : null;
  const champ = derive.champion(state, season.id);
  return { total, final, leader, champ };
}

/* ---- New season dialog ---------------------------------------------------- */
function NewSeasonDialog({ open, onClose, leagueId }) {
  const { api } = useStoreCtx();
  const [name, setName] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [teams, setTeams] = React.useState("8");
  const [fmt, setFmt] = React.useState("single");
  const [createdId, setCreatedId] = React.useState(null);

  React.useEffect(() => { if (open) { setName(""); setStart(""); setEnd(""); setTeams("8"); setFmt("single"); setCreatedId(null); } }, [open]);

  const inputStyle = { width: "100%", height: 38, padding: "0 12px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", font: "500 14px/1 inherit", outline: "none" };
  const label = { fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 6, display: "block" };

  function submit() {
    if (!name.trim()) return;
    const id = api.createSeason(leagueId, { name, start: start || null, end: end || null, playoffTeams: Number(teams), playoffFormat: fmt });
    setCreatedId(id);
  }

  return (
    <Modal open={open} onClose={onClose} width={480} labelledBy="new-season-title">
      {createdId === null ? (
        <>
          <DialogHead id="new-season-title" title="New season" description="Add a season to unlock rosters, schedules, and player attributes." onClose={onClose} />
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <div><label style={label}>Season name</label><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cobb Football 2028" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={label}>Start date</label><input type="date" style={inputStyle} value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><label style={label}>End date</label><input type="date" style={inputStyle} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={label}>Playoff teams</label>
                <Select value={teams} onChange={setTeams} options={[{ value: "0", label: "None" }, { value: "4", label: "4 teams" }, { value: "8", label: "8 teams" }, { value: "16", label: "16 teams" }]} /></div>
              <div><label style={label}>Playoff format</label>
                <Select value={fmt} onChange={setFmt} options={[{ value: "single", label: "Single elimination" }, { value: "double", label: "Double elimination" }]} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={!name.trim()}>Create season</Button>
            </DialogFooter>
          </form>
        </>
      ) : (
        <>
          <DialogHead id="new-season-title" title="Season created" description={`${name} is ready. Next, generate a schedule so teams have fixtures to play.`} onClose={onClose} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="check-circle" size={20} /></span>
            <span>Created {name}. Rosters start empty (0/{TARGET_ROSTER}).</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Done</Button>
            <Button variant="primary" icon="calendar-plus" onClick={() => { onClose(); api.navigate("schedule", { leagueId, seasonId: createdId }); }}>Generate schedule</Button>
          </DialogFooter>
        </>
      )}
    </Modal>
  );
}

/* ---- Season row ----------------------------------------------------------- */
function SeasonRow({ season }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const arc = seasonArchive(state, season);
  const isActive = season.status === "active";

  async function makeActive() { await activateSeasonFlow({ api, ui, state, season }); }
  async function complete() {
    const decided = derive.seasonDecided(state, season.id);
    if (!decided) {
      const ok = await ui.confirm({ title: "Complete season anyway?", description: `No champion has been decided for ${season.name}. Completing locks schedule generation, result recording, and simulation. Complete anyway?`, confirmLabel: "Complete anyway", tone: "danger" });
      if (!ok) return;
    } else {
      const ok = await ui.confirm({ title: `Complete ${season.name}?`, description: "Schedule generation, result recording, and simulation will be locked for it.", confirmLabel: "Complete season", tone: "primary" });
      if (!ok) return;
    }
    api.completeSeason(season.id);
    toast.success(`${season.name} completed.`, { description: "Start the next season from the league page.", action: { label: "League page", onClick: () => api.navigate("league", { leagueId: season.leagueId }) } });
  }
  async function copyRosters() {
    const under = derive.undersized(state, season.id);
    const populated = under.length < SL.TEAMS.length;
    if (populated) {
      const ok = await ui.confirm({ title: "Replace rosters?", description: `${season.name} already has rosters. Copying replaces them with the most recent prior season’s rosters. This can’t be undone.`, confirmLabel: "Copy & replace", tone: "danger" });
      if (!ok) return;
    }
    await ui.process({ title: "Copying rosters", subtitle: "Cloning roster assignments from the most recent prior season.", steps: ["Resolving prior season", "Reading roster assignments", "Cloning depth charts", "Writing rosters"], doneLabel: "Rosters copied" });
    api.fillRosters(season.id);
    toast.success(`Copied rosters into ${season.name}.`);
  }
  async function rename() {
    const ok = await ui.confirm({ title: "Rename in prototype", description: "Inline rename is stubbed here — the edit form opens in the full app.", confirmLabel: "OK", cancelLabel: "Close" });
    if (ok) toast("Rename is stubbed in the prototype.");
  }
  async function remove() {
    const ok = await ui.confirm({ title: `Delete ${season.name}?`, description: "Delete this season and its schedule, results, and attributes? This can’t be undone.", confirmLabel: "Delete season", tone: "danger" });
    if (!ok) return;
    api.deleteSeason(season.id);
    toast.success(`Deleted ${season.name}.`);
  }

  return (
    <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 4px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a className="link--muted" style={{ cursor: "pointer", color: "var(--text)", font: "700 16px/1.2 inherit", letterSpacing: "-.2px" }} onClick={() => api.navigate("season", { seasonId: season.id })}>{season.name}</a>
          <StatusBadge status={season.status} />
          <span className="muted" style={{ fontSize: 12.5 }}>{SL.formatDate(season.start)} – {SL.formatDate(season.end)}</span>
        </div>
        <p className="muted" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "6px 0 0", fontSize: 12.5 }}>
          {arc.total === 0 ? <span>No games yet</span> : <span className="sl-mono">{arc.final} / {arc.total} games</span>}
          {arc.leader ? <><span className="subtle">·</span><span>{arc.leader.teamName} <span className="sl-mono">({SL.recordStr(arc.leader)})</span></span></> : null}
          {arc.champ ? <><span className="subtle">·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text)" }}><Icon name="trophy" size={13} style={{ color: "var(--accent)" }} />{arc.champ.teamName}</span></> : null}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {!isActive ? <Button size="sm" icon="check-circle" onClick={makeActive}>Make active</Button>
          : <Button size="sm" icon="trophy" onClick={complete}>Complete</Button>}
        <Button size="sm" icon="users" onClick={copyRosters}>Copy rosters</Button>
        <Button size="sm" variant="ghost" onClick={rename} aria-label="Edit"><Icon name="pencil" size={15} /></Button>
        <Button size="sm" variant="ghost" onClick={remove} aria-label="Delete"><Icon name="trash" size={16} style={{ color: "var(--danger)" }} /></Button>
      </div>
    </li>
  );
}

/* ---- Seasons list --------------------------------------------------------- */
function SeasonsScreen() {
  const { state } = useStoreCtx();
  const [newOpen, setNewOpen] = React.useState(false);
  const league = state.league;
  const seasons = state.seasons.filter((s) => s.leagueId === league.id)
    .slice().sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : (b.year || 0) - (a.year || 0)));
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard" }, { label: "Seasons" }]} />
      <PageHeader title="Seasons" sub="Seasons and their schedules across your leagues." />
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={20} /></span>
            <h3 className="section-title">{league.name}</h3>
            <Badge variant="neutral">{seasons.length} season{seasons.length === 1 ? "" : "s"}</Badge>
          </div>
          <Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New season</Button>
        </div>
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, borderTop: "1px solid var(--border)" }}>
          {seasons.map((s) => (
            <li key={s.id} style={{ borderBottom: "1px solid var(--border)" }}><SeasonRow season={s} /></li>
          ))}
        </ul>
      </Card>
      <NewSeasonDialog open={newOpen} onClose={() => setNewOpen(false)} leagueId={league.id} />
    </div>
  );
}

/* ---- Season hub (landing screen) ----------------------------------------- */
function SeasonHubScreen({ seasonId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const season = derive.season(state, seasonId);
  if (!season) return <div className="content__inner"><p className="muted">Season not found.</p></div>;
  const league = state.league;
  const prog = derive.regularProgress(state, seasonId);
  const fx = derive.fixtures(state, seasonId);
  const bracket = derive.bracket(state, seasonId);
  const playoffFx = 0;
  const st = derive.standings(state, seasonId);
  const champ = derive.champion(state, seasonId);
  const phase = derive.playoffPhase(state, seasonId);
  const isUpcoming = season.status === "upcoming";
  const noSchedule = fx.length === 0;
  const go = (screen) => api.navigate(screen, { leagueId: league.id, seasonId });

  async function generate() { await generateScheduleFlow({ api, ui, season, hasFixtures: fx.length > 0 }); }

  return (
    <div className="content__inner" style={{ maxWidth: 960 }}>
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Seasons", onClick: () => api.navigate("seasons") }, { label: season.name }]} />
      <BackLink label="Back to Seasons" onClick={() => api.navigate("seasons")} />
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="page-h1" style={{ fontSize: 28 }}>{season.name}</h1>
          <StatusBadge status={season.status} />
        </div>
        <p className="page-sub" style={{ marginTop: 6 }}>
          <a className="link" onClick={() => api.navigate("league", { leagueId: league.id })}>{league.name}</a>
          {" · "}{SL.formatDate(season.start)} – {SL.formatDate(season.end)}
        </p>
        <nav style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16 }}>
          <a className="link" onClick={() => go("schedule")}>Schedule →</a>
          <a className="link" onClick={() => go("standings")}>Standings →</a>
          <a className="link" onClick={() => go("playoffs")}>Playoffs →</a>
          <a className="link" onClick={() => toast("Stat leaders is outside the prototype scope.")}>Stat leaders →</a>
        </nav>
      </header>

      {champ ? <SeasonCompleteBanner seasonId={seasonId} /> : null}

      {isUpcoming && noSchedule ? (
        <div className="banner-cta banner-cta--primary" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "var(--text)" }}><Icon name="calendar-plus" size={22} /></span>
            <div><p style={{ margin: 0, font: "700 16px/1.2 inherit" }}>Offseason — no schedule yet</p>
              <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>Rosters are set. Generate a schedule to start playing games.</p></div>
          </div>
          <Button variant="primary" icon="calendar-plus" onClick={generate}>Generate schedule</Button>
        </div>
      ) : null}

      {!champ && season.status === "active" && prog.complete && phase === "ready" ? (
        <div className="banner-cta banner-cta--accent" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={24} /></span>
            <div>
              <p className="eyebrow" style={{ color: "var(--accent)" }}>Regular season complete</p>
              <p style={{ margin: "4px 0 0", font: "700 17px/1.2 inherit" }}>Ready to start the playoffs</p>
              <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>{prog.final} of {prog.total} games final · seed the {season.playoffTeams}-team bracket from current standings.</p>
            </div>
          </div>
          <Button variant="primary" icon="trophy" onClick={() => go("playoffs")}>Start playoffs</Button>
        </div>
      ) : null}

      <div className="grid2">
        <Card>
          <h3 className="section-title" style={{ marginBottom: 14 }}>Season progress</h3>
          {prog.total === 0 && !bracket ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0", textAlign: "center" }}>
              <span className="subtle"><Icon name="calendar" size={22} /></span>
              <p className="muted">No games scheduled yet.</p>
            </div>
          ) : (
            <>
              <div className="stat-row"><span className="muted">Regular season</span><span className="sl-mono">{prog.final} / {prog.total} played</span></div>
              {bracket ? <div className="stat-row"><span className="muted">Playoffs</span><span className="sl-mono">{bracket.rounds.reduce((n, r) => n + r.matchups.filter((m) => m.status === "final").length, 0)} games played</span></div> : null}
              <div className="stat-row"><span className="muted">Playoff format</span><span>{season.playoffTeams ? `${season.playoffTeams} teams · single elimination` : "Not configured"}</span></div>
              {champ ? <div className="stat-row"><span className="muted">Champion</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="trophy" size={14} style={{ color: "var(--accent)" }} />{champ.teamName}</span></div> : null}
            </>
          )}
        </Card>
        <Card>
          <h3 className="section-title" style={{ marginBottom: 14 }}>Standings</h3>
          {st.length && prog.final > 0 ? <>
            <StandingsList standings={st} limit={5} onTeam={() => go("standings")} />
            <a className="link" style={{ display: "inline-block", marginTop: 14 }} onClick={() => go("standings")}>Full standings →</a>
          </> : <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>No recorded results yet.</p>}
        </Card>
      </div>

      <Card style={{ marginTop: 20 }}>
        <DynastyPanel leagueId={league.id} seasonId={seasonId} />
      </Card>
    </div>
  );
}

Object.assign(window, { NewSeasonDialog, SeasonRow, SeasonsScreen, SeasonHubScreen, seasonArchive });
