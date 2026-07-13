/* =============================================================================
   Players — every player on rosters in the active league. Two presentations
   (Cards / List) over the same data, with search, a position-group filter,
   sortable columns (list), and pagination. Rows/cards open the player's team
   in the shared TeamDetailSheet. View choice persists across reloads.
   ========================================================================== */

const PLAYERS_PAGE = { cards: 24, list: 25 };
const POS_GROUPS = [
  { value: "all", label: "All" },
  { value: "off", label: "Offense" },
  { value: "def", label: "Defense" },
  { value: "st", label: "Special" },
];

function PlayerStatus({ status }) {
  const v = status === "Active" ? "success" : status === "Injured" ? "warning" : "neutral";
  return <Badge variant={v}>{status}</Badge>;
}

function PlayerSearch({ value, onChange }) {
  return (
    <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", display: "inline-flex", pointerEvents: "none" }}>
        <Icon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search players or teams…"
        style={{ width: "100%", height: 38, padding: "0 12px 0 36px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", font: "inherit", fontSize: 14, outline: "none" }}
      />
    </div>
  );
}

function PlayersScreen() {
  const { state, api } = useStoreCtx();
  const season = derive.activeSeason(state);
  const [view, setView] = React.useState(() => {
    try { return localStorage.getItem("sl-players-view") || "cards"; } catch (e) { return "cards"; }
  });
  const [group, setGroup] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState({ key: "rating", dir: "desc" });
  const [page, setPage] = React.useState(1);
  const [sel, setSel] = React.useState(null);
  React.useEffect(() => { try { localStorage.setItem("sl-players-view", view); } catch (e) {} }, [view]);

  if (!season) return <PlaceholderScreen title="Players" icon="target" />;

  const counts = state.rosters[season.id] || {};
  const countsKey = SL.TEAMS.map((t) => counts[t.id] || 0).join(",");
  const players = React.useMemo(() => {
    const out = [];
    SL.TEAMS.forEach((t) => {
      const n = counts[t.id] || 0;
      const roster = SL.fullRoster(t.id);
      for (let i = 0; i < n && i < roster.length; i++) {
        out.push(Object.assign({}, roster[i], { teamName: SL.TEAM_BY_ID[t.id].name }));
      }
    });
    return out;
  }, [season.id, countsKey]);

  const q = query.trim().toLowerCase();
  const filtered = players.filter((p) =>
    (group === "all" || p.group === group) &&
    (!q || p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q))
  );

  const dir = sort.dir === "asc" ? 1 : -1;
  const sorted = filtered.slice().sort((a, b) => {
    let av, bv;
    switch (sort.key) {
      case "name": av = a.name; bv = b.name; break;
      case "team": av = a.teamName; bv = b.teamName; break;
      case "pos": av = a.pos; bv = b.pos; break;
      case "num": av = a.num; bv = b.num; break;
      case "status": av = a.status; bv = b.status; break;
      default: av = a.rating; bv = b.rating;
    }
    if (typeof av === "string") return (av.localeCompare(bv) * dir) || a.name.localeCompare(b.name);
    return ((av - bv) * dir) || (b.rating - a.rating);
  });

  const pageSize = PLAYERS_PAGE[view];
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startI = (safePage - 1) * pageSize;
  const pageItems = sorted.slice(startI, startI + pageSize);

  const reset = () => setPage(1);
  function toggleSort(key, defaultDir) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir || "asc" }));
    reset();
  }

  const Th = ({ label, k, align, dd }) => (
    <th onClick={() => toggleSort(k, dd)} style={{ cursor: "pointer", textAlign: align || "left", whiteSpace: "nowrap", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexDirection: align === "right" ? "row-reverse" : "row" }}>
        {label}
        <span style={{ color: sort.key === k ? "var(--accent)" : "var(--text-subtle)", display: "inline-flex" }}>
          <Icon name="chevron-vertical" size={12} />
        </span>
      </span>
    </th>
  );

  return (
    <div className="content__inner">
      <Crumbs items={[{ label: "Dashboard", onClick: () => api.navigate("overview") }, { label: "Players" }]} />
      <PageHeader
        title="Players"
        sub={`All players on rosters · ${season.name}`}
        actions={<>
          <a className="link" onClick={() => api.navigate("teams")}>Teams →</a>
          <a className="link" onClick={() => api.navigate("divisions")}>Divisions →</a>
        </>}
      />

      {/* toolbar: view toggle · position filter · search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Segmented value={view} onChange={(v) => { setView(v); reset(); }}
          options={[{ value: "cards", label: "Cards" }, { value: "list", label: "List" }]} />
        <Segmented value={group} onChange={(v) => { setGroup(v); reset(); }} options={POS_GROUPS} />
        <div style={{ flex: 1 }} />
        <PlayerSearch value={query} onChange={(v) => { setQuery(v); reset(); }} />
      </div>

      {total === 0 ? (
        <Card style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No players found</p>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
            {players.length === 0 ? "Rosters haven’t been generated for this season yet." : "Try a different search or filter."}
          </p>
        </Card>
      ) : view === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(244px, 1fr))", gap: 14 }}>
          {pageItems.map((p) => (
            <button key={p.id} className="rowbtn" onClick={() => setSel(p.teamId)}
              style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface)", padding: 16, cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--text)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p className="subtle" style={{ margin: "3px 0 0", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span className="sl-mono">{p.pos}</span> · {p.teamName}
                  </p>
                </div>
                <TeamMark id={p.teamId} size={34} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "6px 10px", borderRadius: "var(--r)", background: "var(--accent-soft)" }}>
                  <span className="sl-mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{p.rating}</span>
                  <span className="subtle" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>OVR</span>
                </span>
                <span className="chip sl-mono">#{p.num}</span>
                <PlayerStatus status={p.status} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <Th label="Name" k="name" dd="asc" />
                  <Th label="Team" k="team" dd="asc" />
                  <Th label="Pos" k="pos" dd="asc" />
                  <Th label="#" k="num" dd="asc" align="right" />
                  <Th label="OVR" k="rating" dd="desc" align="right" />
                  <Th label="Status" k="status" dd="asc" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} className="rowbtn" onClick={() => setSel(p.teamId)}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="muted">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <TeamMark id={p.teamId} size={22} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.teamName}</span>
                      </span>
                    </td>
                    <td className="sl-mono muted">{p.pos}</td>
                    <td className="tbl__num" style={{ textAlign: "right" }}>{p.num}</td>
                    <td className="tbl__num" style={{ textAlign: "right", fontWeight: 600, color: "var(--accent)" }}>{p.rating}</td>
                    <td><PlayerStatus status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* pagination */}
      {total > 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Showing <span className="sl-mono">{startI + 1}–{Math.min(startI + pageSize, total)}</span> of <span className="sl-mono">{total}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="sl-iconbtn" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
              aria-label="Previous page" style={{ opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? "default" : "pointer" }}>
              <Icon name="chevron-right" size={16} style={{ transform: "rotate(180deg)" }} />
            </button>
            <span className="sl-mono muted" style={{ fontSize: 13 }}>Page {safePage} of {totalPages}</span>
            <button className="sl-iconbtn" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
              aria-label="Next page" style={{ opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? "default" : "pointer" }}>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <TeamDetailSheet teamId={sel} seasonId={season.id} onClose={() => setSel(null)} />
    </div>
  );
}

Object.assign(window, { PlayersScreen });
