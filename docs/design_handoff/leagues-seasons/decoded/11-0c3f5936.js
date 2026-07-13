/* =============================================================================
   GameView — right-docked drawer. Pre-kickoff shows a matchup PREVIEW; a final
   game shows the GAMECAST recap. Works for both regular-season fixtures and
   playoff matchups.
   ========================================================================== */

function formLast5(fixtures, teamId) {
  const games = fixtures.filter((f) => f.status === "final" && (f.homeId === teamId || f.awayId === teamId))
    .slice(-5);
  return games.map((f) => {
    const us = f.homeId === teamId ? f.homeScore : f.awayScore;
    const them = f.homeId === teamId ? f.awayScore : f.homeScore;
    return us > them ? "W" : us < them ? "L" : "T";
  });
}

function WinProb({ series }) {
  const w = 560, h = 72, n = series.length;
  const pts = series.map((v, i) => [(i / (n - 1)) * w, h - (v / 100) * h]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const last = series[series.length - 1];
  const col = last >= 50 ? "var(--accent)" : "var(--text-muted)";
  return (
    <svg className="wp" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      <path d={area} fill={col} opacity="0.12" />
      <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function TeamPill({ id, seed, align }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: align === "right" ? "row-reverse" : "row", textAlign: align === "right" ? "right" : "left" }}>
      <TeamMark id={id} size={40} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, font: "700 16px/1.15 inherit", letterSpacing: "-.2px" }}>{SL.TEAM_BY_ID[id].name}</p>
        <p className="subtle" style={{ margin: "2px 0 0", fontSize: 12 }}>
          {seed ? `#${seed} seed · ` : ""}{SL.TEAM_BY_ID[id].mascot}
        </p>
      </div>
    </div>
  );
}

function GameView() {
  const { state, api, gameView } = useStoreCtx();
  const [recording, setRecording] = React.useState(false);
  const [hs, setHs] = React.useState("");
  const [as, setAs] = React.useState("");
  React.useEffect(() => { setRecording(false); setHs(""); setAs(""); }, [gameView && gameView.id]);

  const kind = gameView && gameView.kind;
  const seasonId = gameView && gameView.seasonId;
  const id = gameView && gameView.id;
  const season = seasonId ? derive.season(state, seasonId) : null;
  const fixtures = seasonId ? derive.fixtures(state, seasonId) : [];
  const standings = seasonId ? derive.standings(state, seasonId) : [];
  const recOf = (tid) => { const r = standings.find((x) => x.teamId === tid); return r ? SL.recordStr(r) : "0-0"; };

  // resolve entity (no hooks in here)
  let ent = null;
  if (gameView) {
    if (kind === "fixture") ent = fixtures.find((f) => f.id === id);
    else { const b = derive.bracket(state, seasonId); if (b) for (const r of b.rounds) { const m = r.matchups.find((x) => x.id === id); if (m) { ent = m; break; } } }
  }
  const homeId = ent ? ent.homeId : null, awayId = ent ? ent.awayId : null;
  const isFinal = !!ent && ent.status === "final";

  // gamecast memo — MUST run on every render, before any early return
  const cast = React.useMemo(
    () => (isFinal && ent) ? SL.buildGamecast({ id: ent.id, homeId, awayId, homeScore: ent.homeScore, awayScore: ent.awayScore }) : null,
    [ent && ent.id, isFinal, ent && ent.homeScore, ent && ent.awayScore] // eslint-disable-line
  );

  const open = !!ent && (kind !== "matchup" || (ent.homeId && ent.awayId));
  const close = () => api.closeGame();
  if (!gameView || !ent) return <Sheet open={false} onClose={close}>{null}</Sheet>;

  const roundLabel = kind === "matchup" && season ? SL.roundLabel(ent.round, SL.totalRoundsFor((derive.bracket(state, seasonId) || {}).size || 8)) : null;
  const whenLabel = kind === "fixture" ? SL.formatWhen(ent.dateISO) : (season ? `Playoffs · ${season.name}` : "Playoffs");

  function doSim() {
    if (kind === "fixture") api.simFixture(seasonId, id); else api.simMatchup(seasonId, id);
  }
  function saveResult() {
    const h = parseInt(hs, 10), a = parseInt(as, 10);
    if (isNaN(h) || isNaN(a)) return;
    if (kind === "fixture") api.recordResult(seasonId, id, h, a); else api.recordMatchup(seasonId, id, h, a);
    setRecording(false);
    toast.success(`Recorded: ${SL.TEAM_BY_ID[homeId].name} ${h}–${a} ${SL.TEAM_BY_ID[awayId].name}.`);
  }

  const inp = { width: 64, height: 38, textAlign: "center", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", font: "600 16px/1 'JetBrains Mono', monospace", outline: "none" };

  // ------- header -------
  const header = (
    <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant={isFinal ? "neutral" : "outline"}>{isFinal ? "Final" : "Preview"}</Badge>
          {roundLabel ? <span className="sl-mono subtle" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".5px" }}>{roundLabel}</span> : null}
        </div>
        <button className="sl-iconbtn" onClick={close} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <p className="subtle" style={{ margin: "8px 0 0", fontSize: 12 }}>{whenLabel}</p>
    </div>
  );

  // ------- scoreboard -------
  const scoreboard = (
    <div style={{ padding: "22px 20px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
      <TeamPill id={homeId} seed={ent.homeSeed} align="left" />
      <div style={{ textAlign: "center" }}>
        {isFinal ? (
          <div className="sl-mono" style={{ display: "flex", alignItems: "center", gap: 10, font: "700 30px/1 'JetBrains Mono', monospace" }}>
            <span style={{ color: ent.homeScore >= ent.awayScore ? "var(--text)" : "var(--text-subtle)" }}>{ent.homeScore}</span>
            <span className="subtle" style={{ fontSize: 16 }}>–</span>
            <span style={{ color: ent.awayScore >= ent.homeScore ? "var(--text)" : "var(--text-subtle)" }}>{ent.awayScore}</span>
          </div>
        ) : <span className="subtle" style={{ font: "700 20px/1 inherit" }}>vs</span>}
      </div>
      <TeamPill id={awayId} seed={ent.awaySeed} align="right" />
    </div>
  );

  // ------- preview body -------
  function tapeRow(label, left, right) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--border)" }}>
        <span className="sl-mono" style={{ fontSize: 13 }}>{left}</span>
        <span className="subtle" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", padding: "0 12px" }}>{label}</span>
        <span className="sl-mono" style={{ fontSize: 13, textAlign: "right" }}>{right}</span>
      </div>
    );
  }
  const hOvr = SL.TEAM_BY_ID[homeId].ovr, aOvr = SL.TEAM_BY_ID[awayId].ovr;
  const spread = Math.round((hOvr + 2.5 - aOvr) / 2);
  const favName = spread === 0 ? null : spread > 0 ? SL.TEAM_BY_ID[homeId].name : SL.TEAM_BY_ID[awayId].name;
  const lineText = spread === 0 ? "Pick’em" : `${favName} by ${Math.abs(spread)}`;
  const hForm = formLast5(fixtures, homeId), aForm = formLast5(fixtures, awayId);
  const hStars = SL.starPlayers(homeId), aStars = SL.starPlayers(awayId);
  const FormChips = ({ form, align }) => (
    <div style={{ display: "flex", gap: 4, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {form.length ? form.map((r, i) => (
        <span key={i} className="sl-mono" style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 5, fontSize: 11, fontWeight: 600,
          background: r === "W" ? "var(--accent-soft)" : "var(--surface-3)", color: r === "W" ? "var(--accent)" : r === "L" ? "var(--text-muted)" : "var(--text-subtle)" }}>{r}</span>
      )) : <span className="subtle" style={{ fontSize: 12 }}>No games</span>}
    </div>
  );

  const preview = (
    <div style={{ padding: "0 20px 24px" }}>
      <div className="banner-cta" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent)" }}><Icon name="target" size={18} /></span>
          <div><p className="eyebrow">Projected line</p><p style={{ margin: "3px 0 0", font: "700 15px/1 inherit" }}>{lineText}</p></div>
        </div>
        <span className="chip"><Icon name="dot" size={12} style={{ color: "var(--accent)" }} />Sim uses team ratings</span>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: "6px 16px 12px" }}>
        <p className="eyebrow" style={{ padding: "10px 0 2px" }}>Tale of the tape</p>
        {tapeRow("Record", recOf(homeId), recOf(awayId))}
        {tapeRow("Team rating", hOvr, aOvr)}
        {tapeRow("Form (last 5)", "", "")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "2px 0 10px" }}>
          <FormChips form={hForm} align="left" /><FormChips form={aForm} align="right" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        {[[homeId, hStars], [awayId, aStars]].map(([tid, stars]) => (
          <div key={tid} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><TeamMark id={tid} size={22} /><span style={{ fontSize: 13, fontWeight: 600 }}>Key players</span></div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {stars.map((p) => (
                <li key={p.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span className="subtle sl-mono" style={{ fontSize: 11, marginRight: 6 }}>{p.pos}</span>{p.name}</span>
                  <span className="sl-mono muted" style={{ fontSize: 12 }}>{p.rating}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {recording ? (
        <div style={{ marginTop: 18, border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Record result</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
            <span style={{ fontSize: 13 }}>{SL.TEAM_BY_ID[homeId].name}</span>
            <input style={inp} value={hs} onChange={(e) => setHs(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Home score" />
            <span className="subtle">–</span>
            <input style={inp} value={as} onChange={(e) => setAs(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Away score" />
            <span style={{ fontSize: 13 }}>{SL.TEAM_BY_ID[awayId].name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Button size="sm" variant="ghost" onClick={() => setRecording(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={saveResult} disabled={hs === "" || as === ""}>Save result</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <Button variant="primary" icon="dices" onClick={doSim}>Sim game</Button>
          <Button icon="pencil" onClick={() => setRecording(true)}>Record result</Button>
          <Button variant="ghost" icon="radio" onClick={() => toast("Go live is outside the prototype scope.")}>Go live</Button>
        </div>
      )}
    </div>
  );

  // ------- gamecast body ------- (cast computed above, before early return)
  const winnerId = isFinal ? (ent.homeScore >= ent.awayScore ? homeId : awayId) : null;
  const isChampGame = kind === "matchup" && season && ent.round === SL.totalRoundsFor((derive.bracket(state, seasonId) || {}).size || 8);

  const gamecast = isFinal && cast ? (
    <div style={{ padding: "0 20px 26px" }}>
      {isChampGame && winnerId ? (
        <div className="banner-cta banner-cta--accent" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name="trophy" size={22} style={{ color: "var(--accent)" }} /><div><p className="eyebrow" style={{ color: "var(--accent)" }}>Champion</p><p style={{ margin: "3px 0 0", font: "700 16px/1 inherit" }}>{SL.TEAM_BY_ID[winnerId].name}</p></div></div>
        </div>
      ) : null}

      {/* quarters */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <table className="tbl" style={{ fontSize: 13 }}>
          <thead><tr><th>Team</th>{cast.quarters.map((q) => <th key={q.q} style={{ textAlign: "center" }}>Q{q.q}</th>)}<th style={{ textAlign: "center" }}>T</th></tr></thead>
          <tbody>
            {[["home", homeId, ent.homeScore], ["away", awayId, ent.awayScore]].map(([side, tid, tot]) => (
              <tr key={side}>
                <td style={{ display: "flex", alignItems: "center", gap: 8 }}><TeamMark id={tid} size={22} />{SL.TEAM_BY_ID[tid].name}</td>
                {cast.quarters.map((q) => <td key={q.q} className="tbl__num" style={{ textAlign: "center" }}>{side === "home" ? q.home : q.away}</td>)}
                <td className="tbl__num" style={{ textAlign: "center", fontWeight: 700 }}>{tot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* win probability */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <p className="eyebrow">Win probability</p>
          <span className="sl-mono subtle" style={{ fontSize: 11 }}>{SL.TEAM_BY_ID[homeId].name}</span>
        </div>
        <WinProb series={cast.winProb} />
      </div>

      {/* scoring plays */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "6px 16px 12px", marginBottom: 16 }}>
        <p className="eyebrow" style={{ padding: "10px 0 6px" }}>Scoring summary</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {cast.plays.map((p, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span className="sl-mono subtle" style={{ fontSize: 11, width: 42, flex: "none" }}>Q{p.q} {p.clock}</span>
              <TeamMark id={p.teamId} size={20} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{p.text}</span>
              <span className="sl-mono muted" style={{ fontSize: 12, flex: "none" }}>{p.home}–{p.away}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* leaders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[[homeId, cast.leaders.home], [awayId, cast.leaders.away]].map(([tid, rows]) => (
          <div key={tid} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><TeamMark id={tid} size={22} /><span style={{ fontSize: 13, fontWeight: 600 }}>Leaders</span></div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <li key={r.name}><p style={{ margin: 0, fontSize: 13 }}><span className="subtle sl-mono" style={{ fontSize: 11, marginRight: 6 }}>{r.pos}</span>{r.name}</p><p className="muted" style={{ margin: "1px 0 0", fontSize: 12 }}>{r.line}</p></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        <Button icon="clipboard" onClick={() => toast("Full box score is outside the prototype scope.")}>Box score</Button>
        <Button variant="ghost" icon="pencil" onClick={() => setRecording(true)}>Edit result</Button>
      </div>
      {recording ? (
        <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
            <span style={{ fontSize: 13 }}>{SL.TEAM_BY_ID[homeId].name}</span>
            <input style={inp} value={hs === "" ? String(ent.homeScore) : hs} onChange={(e) => setHs(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Home score" />
            <span className="subtle">–</span>
            <input style={inp} value={as === "" ? String(ent.awayScore) : as} onChange={(e) => setAs(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Away score" />
            <span style={{ fontSize: 13 }}>{SL.TEAM_BY_ID[awayId].name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Button size="sm" variant="ghost" onClick={() => setRecording(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={saveResult}>Save result</Button>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <Sheet open={open} onClose={close} width={640} label="Game details">
      {header}
      {scoreboard}
      {isFinal ? gamecast : preview}
    </Sheet>
  );
}

Object.assign(window, { GameView, WinProb, formLast5 });
