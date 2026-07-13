/* =============================================================================
   Screens — league side: Overview, Leagues, League (info), Manage, Dynasty,
   season-lifecycle flows, and shared page furniture.
   ========================================================================== */

/* ---- shared furniture ----------------------------------------------------- */
function Crumbs({ items }) {
  return (
    <nav className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <span className="crumbs__sep"><Icon name="chevron-right" size={13} /></span> : null}
          {it.onClick ? <a className="link--muted" style={{ cursor: "pointer" }} onClick={it.onClick}>{it.label}</a>
            : <span style={{ color: "var(--text)" }}>{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
function BackLink({ label, onClick }) {
  return <a className="backlink" onClick={onClick} style={{ cursor: "pointer" }}><Icon name="arrow-left" size={15} />{label}</a>;
}
function PageHeader({ title, sub, actions, badge }) {
  return (
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="page-h1">{title}</h1>{badge}
        </div>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>{actions}</div> : null}
    </header>
  );
}
function StandingsList({ standings, limit = 5, onTeam }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {standings.slice(0, limit).map((r) => (
        <li key={r.teamId} className="stat-row">
          <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <span className="sl-mono subtle" style={{ width: 16, fontSize: 12 }}>{r.rank}</span>
            <TeamMark id={r.teamId} size={24} />
            <a className="link--muted" style={{ cursor: "pointer", color: "var(--text)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              onClick={() => onTeam && onTeam(r.teamId)}>{r.teamName}</a>
          </span>
          <span className="sl-mono muted" style={{ fontSize: 13 }}>{SL.recordStr(r)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- season-lifecycle flows (shared, promise-based) ----------------------- */
function undersizedMessage(under) {
  const list = under.map((t) => `${t.name} (${t.count}/${TARGET_ROSTER})`).join(", ");
  return `Some teams are below the target roster size of ${TARGET_ROSTER}: ${list}. You can still activate, but rosters may be incomplete.`;
}
async function activateSeasonFlow({ api, ui, state, season, onDone }) {
  const under = derive.undersized(state, season.id);
  if (under.length === 0) {
    api.makeActive(season.id);
    toast.success(`${season.name} is now the active season.`);
    onDone && onDone();
    return;
  }
  const choice = await ui.confirm({
    title: "Activate with undersized rosters?",
    description: undersizedMessage(under),
    body: <p className="sl-dialog__body" style={{ margin: "10px 0 0" }}>Proceed to make <b style={{ color: "var(--text)" }}>{season.name}</b> the active season anyway?</p>,
    confirmLabel: "Proceed anyway",
    tone: "primary",
    extraAction: { label: "Auto-fill rosters", icon: "wand", variant: "outline" },
  });
  if (!choice) return;
  if (choice === "extra") {
    await ui.process({
      title: "Filling rosters",
      subtitle: `Generating ~${TARGET_ROSTER} synthetic players for ${under.length} teams. Not real people.`,
      steps: ["Loading roster targets", "Generating synthetic players", "Assigning positions & numbers", "Seeding ratings", "Saving rosters"],
      doneLabel: "Rosters filled",
    });
    api.fillRosters(season.id);
    toast.success(`Filled rosters for ${under.length} teams.`);
  }
  api.makeActive(season.id);
  toast.success(`${season.name} is now the active season.`);
  onDone && onDone();
}
async function generateScheduleFlow({ api, ui, season, hasFixtures }) {
  if (hasFixtures) {
    const ok = await ui.confirm({
      title: "Regenerate schedule?",
      description: `Replace the current schedule for ${season.name} with a fresh round-robin? Existing fixtures and any recorded results will be removed. This can’t be undone.`,
      confirmLabel: "Regenerate", tone: "danger",
    });
    if (!ok) return false;
  }
  await ui.process({
    title: "Generating schedule",
    subtitle: `Round-robin across ${SL.TEAMS.length} teams · ${WEEKS} weeks.`,
    steps: ["Reading league teams (16)", "Building round-robin pairings", "Assigning weeks & kickoff dates", `Writing ${WEEKS * 8} fixtures`, "Refreshing standings"],
    doneLabel: "Schedule generated",
  });
  api.generateSchedule(season.id);
  toast.success(`Generated ${WEEKS * 8} games across ${WEEKS} weeks for ${SL.TEAMS.length} teams.`);
  return true;
}
async function fillRostersFlow({ api, ui, season }) {
  await ui.process({
    title: "Generating rosters",
    subtitle: `Filling every team to ~${TARGET_ROSTER} players. Not real people.`,
    steps: ["Loading roster targets", "Generating synthetic players", "Assigning positions & numbers", "Seeding ratings", "Saving rosters"],
    doneLabel: "Rosters generated",
  });
  api.fillRosters(season.id);
  toast.success(`Filled rosters for ${SL.TEAMS.length} teams.`);
}
async function generateAttributesFlow({ ui }) {
  await ui.process({
    title: "Generating attributes",
    subtitle: "Rolling ratings & traits from position archetypes.",
    steps: ["Loading rosters", "Sampling position archetypes", "Rolling ratings & traits", "Writing attribute snapshots"],
    doneLabel: "Attributes generated",
  });
  toast.success("Player attributes generated.");
}

/* ---- Dynasty panel -------------------------------------------------------- */
function DynastyPanel({ leagueId, seasonId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const active = derive.activeSeason(state);
  const upcoming = derive.upcomingSeason(state);
  const decided = active ? derive.seasonDecided(state, active.id) : false;
  const cd = state.classDist;
  const activeTotal = cd.FR + cd.SO + cd.JR + cd.SR + cd.unknown;

  let statusLabel = "No active season", statusVar = "neutral";
  if (active && upcoming) { statusLabel = `Offseason · upcoming ${upcoming.name}`; statusVar = "outline"; }
  else if (active && decided) { statusLabel = "Decided"; statusVar = "success"; }
  else if (active) { statusLabel = "In progress"; statusVar = "neutral"; }

  const canStart = !!active && decided && !upcoming;
  const progress = active ? derive.regularProgress(state, active.id) : { total: 0, final: 0 };
  const gateMsg = !active ? "Create an active season first."
    : upcoming ? `An upcoming season already exists (${upcoming.name}).`
      : !decided ? (derive.bracket(state, active.id) ? "Playoffs undecided." : `${progress.total - progress.final} game${progress.total - progress.final === 1 ? "" : "s"} unplayed.`)
        : null;
  const [gradOpen, setGradOpen] = React.useState(false);

  async function run() {
    if (!canStart) return;
    const ok = await ui.confirm({
      title: "Start next season?",
      description: "Seniors graduate, every other player advances a grade, and a new freshman class is generated. The new season becomes active.",
      confirmLabel: "Start next season", tone: "primary",
    });
    if (!ok) return;
    await ui.process({
      title: "Rolling over to next season",
      subtitle: "Graduating seniors · advancing classes · recruiting freshmen.",
      steps: ["Creating next season", "Graduating seniors", "Advancing player grades", "Writing attribute snapshots", "Copying rosters forward", "Recruiting freshman class"],
      doneLabel: "Next season started",
    });
    const { summary, newId } = api.startNextSeason(leagueId, { activateNow: true });
    toast.success("Next season started.", {
      description: `${summary.graduated} graduated · ${summary.advanced} advanced · ${summary.freshmen} freshmen generated`,
    });
    api.navigate("season", { seasonId: newId });
  }

  const graduated = 0; // graduated players are archived; count reflected in rollover summary

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)" }}><Icon name="clock" size={17} /></span>
        <p style={{ margin: 0, font: "600 14px/1 inherit", color: "var(--text)" }}>Dynasty</p>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 14px" }}>
        Season continuity — graduate seniors, advance classes, and recruit freshmen.
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ font: "600 14px/1 inherit" }}>{active ? active.name : "—"}</span>
          <Badge variant={statusVar}>{statusLabel}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <Button size="sm" variant="primary" disabled={!canStart} onClick={run}>Start next season</Button>
          {gateMsg ? <span className="muted" style={{ fontSize: 12.5 }}>{gateMsg}</span> : null}
        </div>
        {upcoming ? (
          <p style={{ margin: "10px 0 0", fontSize: 12.5 }}>
            <a className="link" onClick={() => api.navigate("season", { seasonId: upcoming.id })}>View {upcoming.name} →</a>
          </p>
        ) : null}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", padding: 16, marginTop: 12 }}>
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, font: "600 14px/1 inherit" }}>
          <span style={{ color: "var(--accent)" }}><Icon name="users" size={16} /></span>
          Class distribution <span className="muted" style={{ fontWeight: 400 }}>({activeTotal} active)</span>
        </p>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, textAlign: "center", margin: "14px 0 0" }}>
          {["FR", "SO", "JR", "SR"].map((k) => (
            <div key={k}>
              <dt className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{k}</dt>
              <dd className="sl-mono" style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 600 }}>{cd[k]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ---- Season-complete banner (advance / review) ---------------------------- */
function SeasonCompleteBanner({ seasonId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const season = derive.season(state, seasonId);
  const champ = derive.champion(state, seasonId);
  const upcoming = derive.upcomingSeason(state);
  if (!champ) return null;

  async function startNext() {
    const ok = await ui.confirm({
      title: "Start next season?",
      description: `${season.name} is decided — ${champ.teamName} are champions. Roll over to next season now? Seniors graduate, classes advance, freshmen are recruited, and the new season becomes active.`,
      confirmLabel: "Start next season", tone: "primary",
    });
    if (!ok) return;
    await ui.process({
      title: "Rolling over to next season",
      subtitle: "Graduating seniors · advancing classes · recruiting freshmen.",
      steps: ["Creating next season", "Graduating seniors", "Advancing player grades", "Writing attribute snapshots", "Copying rosters forward", "Recruiting freshman class"],
      doneLabel: "Next season started",
    });
    const { summary, newId } = api.startNextSeason(season.leagueId, { activateNow: true });
    toast.success("Next season started.", { description: `${summary.graduated} graduated · ${summary.advanced} advanced · ${summary.freshmen} freshmen generated` });
    api.navigate("season", { seasonId: newId });
  }

  return (
    <div className="banner-cta banner-cta--accent" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <span style={{ color: "var(--accent)", flex: "none" }}><Icon name="trophy" size={26} /></span>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>Season complete</p>
          <p style={{ margin: "4px 0 0", font: "700 18px/1.2 inherit", letterSpacing: "-.3px" }}>
            {champ.teamName} win {season.name}
          </p>
          <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>Advance to the next season, or review this one.</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="outline" icon="clipboard" onClick={() => api.navigate("season", { seasonId })}>Review past season</Button>
        {!upcoming ? <Button variant="primary" icon="arrow-right" onClick={startNext}>Advance to next season</Button> : null}
      </div>
    </div>
  );
}

/* ---- Overview + placeholder ---------------------------------------------- */
function OverviewScreen() {
  const { state, api } = useStoreCtx();
  const active = derive.activeSeason(state);
  const st = active ? derive.standings(state, active.id) : [];
  const prog = active ? derive.regularProgress(state, active.id) : { final: 0, total: 0 };
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard" }, { label: "Overview" }]} />
      <PageHeader title="Overview" sub="Your league at a glance." />
      <div className="grid2">
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="trophy" size={18} /></span>
            <h3 className="section-title">{state.league.name}</h3>
          </div>
          <div className="stat-row"><span className="muted">Active season</span><span>{active ? active.name : "—"}</span></div>
          <div className="stat-row"><span className="muted">Regular season</span><span className="sl-mono">{prog.final} / {prog.total} played</span></div>
          <div className="stat-row"><span className="muted">Teams</span><span className="sl-mono">{SL.TEAMS.length}</span></div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="primary" onClick={() => api.navigate("league", { leagueId: state.league.id })}>Open league</Button>
            <Button size="sm" onClick={() => api.navigate("seasons")}>Seasons</Button>
          </div>
        </Card>
        <Card>
          <h3 className="section-title" style={{ marginBottom: 14 }}>Standings</h3>
          <StandingsList standings={st} limit={5} onTeam={() => api.navigate("standings", { leagueId: state.league.id, seasonId: active.id })} />
          <a className="link" style={{ display: "inline-block", marginTop: 14 }} onClick={() => api.navigate("standings", { leagueId: state.league.id, seasonId: active.id })}>Full standings →</a>
        </Card>
      </div>
    </div>
  );
}
function PlaceholderScreen({ title, icon }) {
  const { state } = useStoreCtx();
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard" }, { label: title }]} />
      <PageHeader title={title} sub={`${title} for ${state.league.name}.`} />
      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, textAlign: "center", borderStyle: "dashed", borderColor: "var(--border-strong)" }}>
        <span className="subtle"><Icon name={icon} size={28} /></span>
        <p className="muted" style={{ maxWidth: 360 }}>This screen is outside the Leagues &amp; Seasons prototype scope. The nav is live so you can feel the shell.</p>
      </Card>
    </div>
  );
}

/* ---- Leagues list --------------------------------------------------------- */
function LeaguesScreen() {
  const { state, api } = useStoreCtx();
  const seasons = state.seasons.filter((s) => s.leagueId === state.league.id);
  const active = derive.activeSeason(state);
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard" }, { label: "Leagues" }]} />
      <PageHeader title="Leagues" sub="Leagues you operate." actions={<Button variant="primary" icon="plus">New league</Button>} />
      <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} className="rowbtn" onClick={() => api.navigate("league", { leagueId: state.league.id })}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 20 }}>
          <span className="side__logo" style={{ width: 44, height: 44, borderRadius: 12 }}><Icon name="trophy" size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 className="section-title">{state.league.name}</h3>
              <Badge variant="neutral">Organization</Badge>
            </div>
            <p className="muted" style={{ margin: "5px 0 0", fontSize: 13.5 }}>
              {SL.TEAMS.length} teams · {seasons.length} seasons · active {active ? active.name : "—"}
            </p>
          </div>
          <span className="subtle"><Icon name="chevron-right" size={20} /></span>
        </div>
      </Card>
    </div>
  );
}

/* ---- League page (info-first) — the destination for "Back to Leagues" ----- */
function LeagueScreen({ leagueId }) {
  const { state, api } = useStoreCtx();
  const league = state.league;
  const active = derive.activeSeason(state);
  const seasons = state.seasons.filter((s) => s.leagueId === leagueId);
  const st = active ? derive.standings(state, active.id) : [];
  const prog = active ? derive.regularProgress(state, active.id) : { final: 0, total: 0, complete: false };
  const phase = active ? derive.playoffPhase(state, active.id) : null;
  const champ = active ? derive.champion(state, active.id) : null;
  const go = (screen, extra) => api.navigate(screen, { leagueId, ...(extra || {}) });

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Leagues", onClick: () => api.navigate("leagues") }, { label: league.name }]} />
      <PageHeader
        title={league.name}
        badge={<Badge variant="neutral">Organization</Badge>}
        sub={`${SL.TEAMS.length} teams · ${seasons.length} seasons`}
        actions={<>
          <Button icon="settings" onClick={() => go("league-manage")}>Manage</Button>
          <Button variant="primary" icon="calendar" onClick={() => api.navigate("seasons")}>Seasons</Button>
        </>}
      />

      {champ ? <SeasonCompleteBanner seasonId={active.id} /> : null}
      {active && !champ && prog.complete && phase !== "bracket_live" ? (
        <div className="banner-cta banner-cta--primary" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "var(--text)" }}><Icon name="trophy" size={22} /></span>
            <div>
              <p style={{ margin: 0, font: "700 16px/1.2 inherit" }}>Regular season complete</p>
              <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>{prog.final} of {prog.total} games final · seed the bracket to begin the playoffs.</p>
            </div>
          </div>
          <Button variant="primary" icon="trophy" onClick={() => go("playoffs", { seasonId: active.id })}>Start playoffs</Button>
        </div>
      ) : null}

      <div className="grid2">
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 className="section-title">Current season</h3>
            {active ? <StatusBadge status={active.status} /> : null}
          </div>
          {active ? <>
            <div className="stat-row"><span className="muted">Season</span>
              <a className="link" onClick={() => api.navigate("season", { seasonId: active.id })}>{active.name} →</a></div>
            <div className="stat-row"><span className="muted">Regular season</span><span className="sl-mono">{prog.final} / {prog.total} played</span></div>
            <div className="stat-row"><span className="muted">Playoff format</span><span>{active.playoffTeams} teams · single elimination</span></div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16 }}>
              <a className="link" onClick={() => go("schedule", { seasonId: active.id })}>Schedule →</a>
              <a className="link" onClick={() => go("standings", { seasonId: active.id })}>Standings →</a>
              <a className="link" onClick={() => go("playoffs", { seasonId: active.id })}>Playoffs →</a>
            </div>
          </> : <p className="muted">No active season.</p>}
        </Card>
        <Card>
          <h3 className="section-title" style={{ marginBottom: 14 }}>Standings</h3>
          {st.length ? <>
            <StandingsList standings={st} limit={5} onTeam={() => go("standings", { seasonId: active.id })} />
            <a className="link" style={{ display: "inline-block", marginTop: 14 }} onClick={() => go("standings", { seasonId: active.id })}>Full standings →</a>
          </> : <p className="muted">No recorded results yet.</p>}
        </Card>
      </div>

      <Card style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 className="section-title">Teams <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>({SL.TEAMS.length})</span></h3>
        </div>
        <div className="grid-cards">
          {st.map((r) => (
            <button key={r.teamId} className="rowbtn" onClick={() => go("standings", { seasonId: active.id })}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--text)" }}>
              <TeamMark id={r.teamId} size={30} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.teamName}</span>
                <span className="sl-mono subtle" style={{ fontSize: 11.5 }}>{SL.recordStr(r)} · {SL.TEAM_BY_ID[r.teamId].mascot}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {active ? (
        <Card style={{ marginTop: 20 }}>
          <DynastyPanel leagueId={leagueId} seasonId={active.id} />
        </Card>
      ) : null}
    </div>
  );
}

/* ---- League manage (admin settings) — reachable via "Manage" -------------- */
function LeagueManageScreen({ leagueId }) {
  const { state, api } = useStoreCtx();
  const ui = useUI();
  const league = state.league;
  async function del() {
    const ok = await ui.confirm({ title: "Delete league?", description: `Delete ${league.name} and all its seasons, schedules, and rosters? This can’t be undone.`, confirmLabel: "Delete league", tone: "danger" });
    if (ok) toast.error("Delete is disabled in the prototype.");
  }
  const Row = ({ title, desc, children }) => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
      <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</p><p className="muted" style={{ margin: "3px 0 0", fontSize: 12.5 }}>{desc}</p></div>
      <div style={{ display: "flex", gap: 8 }}>{children}</div>
    </div>
  );
  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Leagues", onClick: () => api.navigate("leagues") }, { label: league.name, onClick: () => api.navigate("league", { leagueId }) }, { label: "Manage" }]} />
      <BackLink label="Back to League" onClick={() => api.navigate("league", { leagueId })} />
      <PageHeader title="Manage league" sub="Settings, members, and roster tools." />
      <Card>
        <h3 className="section-title">Settings</h3>
        <Row title="League name" desc="Rename this league."><Button size="sm" icon="pencil">Rename</Button></Row>
        <Row title="Members & invites" desc="Invite operators and coaches."><Button size="sm">Manage members</Button></Row>
        <Row title="Visibility" desc="Public leagues appear in Discover."><Segmented value="org" onChange={() => {}} options={[{ value: "org", label: "Organization" }, { value: "public", label: "Public" }]} /></Row>
        <Row title="Teams" desc="Add a team to this league."><Button size="sm" icon="plus">Add team</Button></Row>
        <Row title="Synthetic rosters" desc="Fill every team with ~48 fake players for demos.">
          <Button size="sm" icon="users" onClick={async () => { const active = derive.activeSeason(state); await fillRostersFlow({ api, ui, season: active }); }}>Generate rosters</Button>
          <Button size="sm" icon="activity" onClick={() => generateAttributesFlow({ ui })}>Generate attributes</Button>
        </Row>
        <Row title="Danger zone" desc="Delete this league and all its data."><Button size="sm" variant="danger" icon="trash" onClick={del}>Delete league</Button></Row>
      </Card>
    </div>
  );
}

Object.assign(window, {
  Crumbs, BackLink, PageHeader, StandingsList, DynastyPanel, SeasonCompleteBanner,
  OverviewScreen, PlaceholderScreen, LeaguesScreen, LeagueScreen, LeagueManageScreen,
  undersizedMessage, activateSeasonFlow, generateScheduleFlow, fillRostersFlow, generateAttributesFlow,
});
