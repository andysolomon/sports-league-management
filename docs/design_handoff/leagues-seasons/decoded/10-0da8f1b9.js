/* =============================================================================
   Divisions — teams grouped into the two league divisions, each with its own
   within-division standings. Rows open the shared TeamDetailSheet.
   ========================================================================== */

function DivisionsScreen() {
  const { state, api } = useStoreCtx();
  const season = derive.activeSeason(state);
  const [sel, setSel] = React.useState(null);
  if (!season) return <PlaceholderScreen title="Divisions" icon="layers" />;

  const standings = derive.standings(state, season.id);
  const played = derive.regularProgress(state, season.id).final > 0;

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Divisions" }]} />
      <PageHeader
        title="Divisions"
        sub={`${SL.DIVISIONS.length} divisions · ${season.name}`}
        actions={<>
          <a className="link" onClick={() => api.navigate("teams")}>Teams →</a>
          <a className="link" onClick={() => api.navigate("standings", { leagueId: state.league.id, seasonId: season.id })}>Full standings →</a>
        </>}
      />
      <div className="grid2">
        {SL.DIVISIONS.map((div) => {
          const rows = SL.divisionStandings(standings, div.id);
          const leader = played ? rows[0] : null;
          return (
            <Card key={div.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ color: "var(--accent)" }}><Icon name="layers" size={18} /></span>
                  <h3 className="section-title">{div.name}</h3>
                  <Badge variant="neutral">{rows.length}</Badge>
                </div>
                {leader ? (
                  <span className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, minWidth: 0 }}>
                    <Icon name="trophy" size={13} style={{ color: "var(--accent)", flex: "none" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leader.teamName}</span>
                  </span>
                ) : null}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ minWidth: 380 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Team</th>
                      <th style={{ textAlign: "right" }}>Record</th>
                      <th style={{ textAlign: "right" }}>PF</th>
                      <th style={{ textAlign: "right" }}>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const team = SL.TEAM_BY_ID[r.teamId];
                      return (
                        <tr key={team.id} className="rowbtn" onClick={() => setSel(team.id)}>
                          <td className="sl-mono subtle">{r.divRank}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                              <TeamMark id={team.id} size={22} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
                              {played && r.divRank === 1 ? <Badge variant="success">Leader</Badge> : null}
                            </span>
                          </td>
                          <td className="tbl__num" style={{ textAlign: "right" }}>{SL.recordStr(r)}</td>
                          <td className="tbl__num" style={{ textAlign: "right" }}>{r.pf}</td>
                          <td className="tbl__num" style={{ textAlign: "right", color: r.diff > 0 ? "var(--accent)" : r.diff < 0 ? "var(--text-muted)" : "var(--text-subtle)" }}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
      <TeamDetailSheet teamId={sel} seasonId={season.id} onClose={() => setSel(null)} />
    </div>
  );
}

Object.assign(window, { DivisionsScreen });
