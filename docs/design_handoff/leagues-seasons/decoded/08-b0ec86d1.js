/* =============================================================================
   Teams — every team in the league, sorted by standing. Rows open a team
   detail drawer (record, form, division standing, key players). The shared
   TeamDetailSheet defined here is reused by the Players and Divisions screens.
   ========================================================================== */

/* ---- shared team detail drawer -------------------------------------------- */
function TeamDetailSheet({ teamId, seasonId, onClose }) {
  const { state, api } = useStoreCtx();
  const open = !!teamId;
  const team = teamId ? SL.TEAM_BY_ID[teamId] : null;
  if (!team) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const standings = derive.standings(state, seasonId);
  const row = standings.find((r) => r.teamId === teamId) ||
    { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, diff: 0, pct: 0, gp: 0, rank: 0 };
  const divId = team.division;
  const divRows = SL.divisionStandings(standings, divId);
  const divRank = (divRows.find((r) => r.teamId === teamId) || {}).divRank || 0;
  const roster = (state.rosters[seasonId] || {})[teamId] || 0;
  const stars = SL.starPlayers(teamId);
  const form = formLast5(derive.fixtures(state, seasonId), teamId);
  const go = (screen) => { onClose(); api.navigate(screen, { leagueId: state.league.id, seasonId }); };

  const stat = (label, value, tone) => (
    <div>
      <p className="subtle" style={{ margin: 0, font: "600 10.5px/1 'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</p>
      <p className="sl-mono" style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 600, color: tone || "var(--text)" }}>{value}</p>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} width={560} label="Team details">
      {/* header */}
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge variant="neutral">{SL.divisionName(divId)} Division</Badge>
            {row.rank ? <span className="sl-mono subtle" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".5px" }}>#{row.rank} overall</span> : null}
          </div>
          <button className="sl-iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: "20px 20px 4px", display: "flex", alignItems: "center", gap: 14 }}>
        <TeamMark id={teamId} size={44} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, font: "800 22px/1.1 inherit", letterSpacing: "-.4px" }}>{team.name}</p>
          <p className="subtle" style={{ margin: "3px 0 0", fontSize: 13 }}>{team.mascot} · OVR <span className="sl-mono">{team.ovr}</span></p>
        </div>
      </div>

      <div style={{ padding: "16px 20px 26px" }}>
        {/* stats */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px 12px" }}>
          {stat("Record", SL.recordStr(row))}
          {stat("Win %", row.gp ? (row.pct * 100).toFixed(1) : "—")}
          {stat("Diff", (row.diff > 0 ? "+" : "") + row.diff, row.diff > 0 ? "var(--accent)" : row.diff < 0 ? "var(--text-muted)" : "var(--text)")}
          {stat("Points for", row.pf)}
          {stat("Points against", row.pa)}
          {stat("Roster", `${roster}/${TARGET_ROSTER}`)}
        </div>

        {/* form + division */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Form · last 5</p>
            <div style={{ display: "flex", gap: 4 }}>
              {form.length ? form.map((r, i) => (
                <span key={i} className="sl-mono" style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: r === "W" ? "var(--accent-soft)" : "var(--surface-3)", color: r === "W" ? "var(--accent)" : r === "L" ? "var(--text-muted)" : "var(--text-subtle)" }}>{r}</span>
              )) : <span className="subtle" style={{ fontSize: 12 }}>No games</span>}
            </div>
          </div>
          <button className="rowbtn" onClick={() => go("divisions")}
            style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface)", cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--text)" }}>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Division standing</p>
            <p style={{ margin: 0, fontSize: 13 }}>{SL.divisionName(divId)} · <span className="sl-mono" style={{ fontWeight: 600 }}>#{divRank}</span> of {divRows.length} <span className="subtle">→</span></p>
          </button>
        </div>

        {/* key players */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="target" size={16} /></span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Key players</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {stars.map((p) => (
              <li key={p.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span className="sl-mono subtle" style={{ fontSize: 11, width: 26 }}>{p.pos}</span>
                  <span style={{ fontSize: 14 }}>{p.name}</span>
                </span>
                <span className="sl-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{p.rating}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <Button variant="primary" icon="grid" onClick={() => go("standings")}>View in standings</Button>
          <Button icon="calendar" onClick={() => go("schedule")}>Schedule</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---- Teams list ----------------------------------------------------------- */
function TeamsScreen() {
  const { state, api } = useStoreCtx();
  const season = derive.activeSeason(state);
  const [sel, setSel] = React.useState(null);
  if (!season) return <PlaceholderScreen title="Teams" icon="users" />;

  const standings = derive.standings(state, season.id);
  const rosters = state.rosters[season.id] || {};

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Teams" }]} />
      <PageHeader
        title="Teams"
        sub={`${SL.TEAMS.length} teams · ${season.name}`}
        badge={<Badge variant="neutral">{SL.TEAMS.length}</Badge>}
        actions={<>
          <a className="link" onClick={() => api.navigate("divisions")}>Divisions →</a>
          <a className="link" onClick={() => api.navigate("players")}>Players →</a>
        </>}
      />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Team</th>
                <th>Division</th>
                <th style={{ textAlign: "right" }}>Record</th>
                <th style={{ textAlign: "right" }}>PF</th>
                <th style={{ textAlign: "right" }}>Diff</th>
                <th style={{ textAlign: "right" }}>Roster</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => {
                const team = SL.TEAM_BY_ID[r.teamId];
                const roster = rosters[team.id] || 0;
                return (
                  <tr key={team.id} className="rowbtn" onClick={() => setSel(team.id)}>
                    <td className="sl-mono subtle">{r.rank}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <TeamMark id={team.id} size={26} />
                        <span>
                          <span style={{ display: "block", fontWeight: 600 }}>{team.name}</span>
                          <span className="subtle" style={{ fontSize: 12 }}>{team.mascot}</span>
                        </span>
                      </span>
                    </td>
                    <td className="muted">{SL.divisionName(team.division)}</td>
                    <td className="tbl__num" style={{ textAlign: "right" }}>{SL.recordStr(r)}</td>
                    <td className="tbl__num" style={{ textAlign: "right" }}>{r.pf}</td>
                    <td className="tbl__num" style={{ textAlign: "right", color: r.diff > 0 ? "var(--accent)" : r.diff < 0 ? "var(--text-muted)" : "var(--text-subtle)" }}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                    <td className="tbl__num" style={{ textAlign: "right" }}>{roster}/{TARGET_ROSTER}</td>
                    <td style={{ color: "var(--text-subtle)" }}><Icon name="chevron-right" size={16} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <TeamDetailSheet teamId={sel} seasonId={season.id} onClose={() => setSel(null)} />
    </div>
  );
}

Object.assign(window, { TeamsScreen, TeamDetailSheet });
