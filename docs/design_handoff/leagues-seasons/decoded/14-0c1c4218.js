/* =============================================================================
   App — shell (sidebar + topbar), UI (confirm/process) context, tweaks, routing,
   and mount. Loads last after seed/ui/store/screens.
   ========================================================================== */

const UICtx = React.createContext(null);
const useUI = () => React.useContext(UICtx);

/* ---- sidebar -------------------------------------------------------------- */
const NAV = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "leagues", label: "Leagues", icon: "trophy" },
  { id: "discover", label: "Discover", icon: "compass" },
  { id: "teams", label: "Teams", icon: "users" },
  { id: "players", label: "Players", icon: "target" },
  { id: "seasons", label: "Seasons", icon: "calendar" },
  { id: "divisions", label: "Divisions", icon: "layers" },
  { id: "import", label: "Import", icon: "upload" },
  { id: "billing", label: "Billing", icon: "card" },
];
const NAV_GROUP = {
  league: "leagues", "league-manage": "leagues", schedule: "leagues", standings: "leagues", playoffs: "leagues",
  season: "seasons",
};
function activeNav(screen) { return NAV_GROUP[screen] || screen; }

function Sidebar() {
  const { nav, api } = useStoreCtx();
  const active = activeNav(nav.screen);
  return (
    <nav className="side">
      <div className="side__brand">
        <span className="side__logo"><Icon name="trophy" size={17} /></span>
        <span className="side__word">Sports League</span>
      </div>
      <div className="side__nav">
        {NAV.map((n) => (
          <button key={n.id} className={"sl-nav" + (active === n.id ? " is-active" : "")} onClick={() => api.navigate(n.id)}>
            <Icon name={n.icon} size={18} />{n.label}
          </button>
        ))}
      </div>
      <div className="side__foot">
        <p className="sl-mono subtle" style={{ fontSize: 10.5, padding: "0 8px", lineHeight: 1.5 }}>
          Leagues &amp; Seasons prototype
        </p>
      </div>
    </nav>
  );
}

/* ---- topbar --------------------------------------------------------------- */
function Topbar({ theme, onToggleTheme }) {
  const { state, nav, api } = useStoreCtx();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const showOnLeague = ["league", "league-manage", "schedule", "standings", "playoffs"].includes(nav.screen);
  return (
    <div className="topbar">
      {nav.history.length > 0 ? (
        <button className="sl-iconbtn" onClick={() => api.back({ screen: "overview", params: {} })} aria-label="Back" title="Back">
          <Icon name="arrow-left" size={17} />
        </button>
      ) : null}
      <button className="sl-btn sl-btn--secondary sl-btn--sm" style={{ gap: 8 }} onClick={() => api.navigate("league", { leagueId: state.league.id })}>
        <Icon name="trophy" size={15} style={{ color: "var(--accent)" }} />
        {state.league.name}
        <Icon name="chevron-vertical" size={14} style={{ color: "var(--text-subtle)" }} />
      </button>
      <div className="sl-search" style={{ width: 280, maxWidth: "34vw" }}>
        <Icon name="search" size={16} />
        <input placeholder="Search…" aria-label="Search" onFocus={(e) => e.target.blur()} />
        <span className="sl-kbd">⌘K</span>
      </div>
      <div className="topbar__spacer" />
      <button className="sl-iconbtn" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
      </button>
      <span style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen((o) => !o)} aria-label="Account" style={{ width: 32, height: 32, borderRadius: 999, border: "none", cursor: "pointer", background: "var(--accent-soft)", color: "var(--accent)", font: "700 12px/1 'JetBrains Mono', monospace" }}>OP</button>
        {menuOpen ? (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
            <div className="sl-menu" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50 }}>
              <div style={{ padding: "8px 10px" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Operator</p>
                <p className="subtle" style={{ margin: "2px 0 0", fontSize: 11.5 }}>demo@sportsleague.dev</p>
              </div>
              <div className="sl-menu__sep" />
              <button className="sl-menu__item" onClick={() => { setMenuOpen(false); api.navigate("billing"); }}><Icon name="card" size={15} />Billing</button>
              <button className="sl-menu__item" onClick={() => { setMenuOpen(false); if (window.confirm("Reset the prototype to its starting state (end of the 2027 regular season)?")) api.reset(); }}><Icon name="refresh" size={15} />Reset demo</button>
            </div>
          </>
        ) : null}
      </span>
    </div>
  );
}

/* ---- screen router -------------------------------------------------------- */
function Screen() {
  const { nav } = useStoreCtx();
  const { screen, params } = nav;
  switch (screen) {
    case "overview": return <OverviewScreen />;
    case "leagues": return <LeaguesScreen />;
    case "league": return <LeagueScreen leagueId={params.leagueId} />;
    case "league-manage": return <LeagueManageScreen leagueId={params.leagueId} />;
    case "seasons": return <SeasonsScreen />;
    case "season": return <SeasonHubScreen seasonId={params.seasonId} />;
    case "schedule": return <ScheduleScreen leagueId={params.leagueId} seasonId={params.seasonId} />;
    case "standings": return <StandingsScreen leagueId={params.leagueId} seasonId={params.seasonId} />;
    case "playoffs": return <PlayoffsScreen leagueId={params.leagueId} seasonId={params.seasonId} />;
    case "teams": return <TeamsScreen />;
    case "players": return <PlayersScreen />;
    case "divisions": return <DivisionsScreen />;
    case "import": return <PlaceholderScreen title="Import" icon="upload" />;
    case "billing": return <PlaceholderScreen title="Billing" icon="card" />;
    case "discover": return <PlaceholderScreen title="Discover" icon="compass" />;
    default: return <OverviewScreen />;
  }
}

/* ---- tweaks --------------------------------------------------------------- */
const ACCENTS = [
  { id: "green", hex: "#46c964" }, { id: "blue", hex: "#5b8dff" },
  { id: "violet", hex: "#a17bff" }, { id: "orange", hex: "#ff9e4a" },
];
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "green",
  "theme": "dark",
  "flavor": "balanced",
  "bracketSize": 8,
  "density": "comfortable"
}/*EDITMODE-END*/;

function ProtoTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Simulation" />
      <TweakRadio label="Sim flavor" value={t.flavor} options={["chalk", "balanced", "upsets"]}
        onChange={(v) => setTweak("flavor", v)} />
      <TweakRadio label="Bracket size" value={String(t.bracketSize)} options={["4", "8", "16"]}
        onChange={(v) => setTweak("bracketSize", Number(v))} />
      <TweakSection label="Appearance" />
      <TweakRow label="Accent">
        <div style={{ display: "flex", gap: 8 }}>
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setTweak("accent", a.id)} aria-label={a.id} title={a.id}
              style={{ width: 26, height: 26, borderRadius: 8, background: a.hex, cursor: "pointer",
                border: t.accent === a.id ? "2px solid var(--text)" : "2px solid transparent", outline: "1px solid var(--border)" }} />
          ))}
        </div>
      </TweakRow>
      <TweakToggle label="Dark mode" value={t.theme === "dark"} onChange={(v) => setTweak("theme", v ? "dark" : "light")} />
      <TweakRadio label="Density" value={t.density} options={["comfortable", "compact"]}
        onChange={(v) => setTweak("density", v)} />
    </TweaksPanel>
  );
}

/* ---- app root ------------------------------------------------------------- */
function App() {
  const store = useStore();
  const { state, nav, gameView, api } = store;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // UI (confirm / process) promise machinery
  const confirmRef = React.useRef(null);
  const procRef = React.useRef(null);
  const [confirm, setConfirm] = React.useState({ open: false, opts: {} });
  const [proc, setProc] = React.useState({ open: false, opts: {} });
  const ui = React.useMemo(() => ({
    confirm: (opts) => new Promise((res) => { confirmRef.current = res; setConfirm({ open: true, opts }); }),
    process: (opts) => new Promise((res) => { procRef.current = res; setProc({ open: true, opts }); }),
  }), []);
  const closeConfirm = (val) => { const r = confirmRef.current; confirmRef.current = null; setConfirm((c) => ({ ...c, open: false })); r && r(val); };
  const closeProc = () => { const r = procRef.current; procRef.current = null; setProc((p) => ({ ...p, open: false })); r && r(); };

  // tweaks → engine
  React.useEffect(() => { api.setFlavor(t.flavor); }, [t.flavor]);
  React.useEffect(() => {
    const active = derive.activeSeason(state);
    if (active && !derive.bracket(state, active.id) && active.playoffTeams !== t.bracketSize) {
      api.setPlayoffTeams(active.id, t.bracketSize);
    }
  }, [t.bracketSize, nav.screen]); // eslint-disable-line

  const rootStyle = { theme: t.theme };

  return (
    <div className="sl-root" data-theme={t.theme} data-accent={t.accent} data-round="default"
      style={{ height: "100%" }}>
      <StoreCtx.Provider value={store}>
        <UICtx.Provider value={ui}>
          <div className="app" data-density={t.density}>
            <Sidebar />
            <div className="main">
              <Topbar theme={t.theme} onToggleTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")} />
              <div className="content">
                <Screen />
              </div>
            </div>
          </div>

          <GameView />

          <ConfirmDialog
            open={confirm.open}
            {...confirm.opts}
            extraAction={confirm.opts.extraAction ? { ...confirm.opts.extraAction, onClick: () => closeConfirm("extra") } : undefined}
            onConfirm={() => closeConfirm(true)}
            onCancel={() => closeConfirm(false)}
          />
          <ProcessingModal open={proc.open} {...proc.opts} onDone={closeProc} />

          <Toaster />
          <ProtoTweaks t={t} setTweak={setTweak} />
        </UICtx.Provider>
      </StoreCtx.Provider>
    </div>
  );
}

Object.assign(window, { useUI, App });

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
