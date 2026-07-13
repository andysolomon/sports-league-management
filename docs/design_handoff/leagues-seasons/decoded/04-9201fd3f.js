/* =============================================================================
   UI primitives for the Leagues & Seasons prototype.
   Built on the Sports League design-system classes (.sl-*) + tokens.
   Exposes components on window for the other Babel scripts.
   ========================================================================== */

/* ---- Icons (Lucide-style, 24px grid, inherit currentColor) ---------------- */
const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></>,
  trophy: <><path d="M6 9a6 6 0 0 0 12 0V4H6Z" /><path d="M9 20h6M12 14v6" /><path d="M6 5H3.5v2A3 3 0 0 0 6 9.9M18 5h2.5v2A3 3 0 0 1 18 9.9" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5z" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /><path d="M20.5 20a5 5 0 0 0-4-4.9" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.4" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  upload: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-3.6-3.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  "check-circle": <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-vertical": <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  "arrow-left": <path d="M19 12H5M12 19l-7-7 7-7" />,
  "arrow-right": <path d="M5 12h14M12 5l7 7-7 7" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  alert: <><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  pencil: <path d="M12 20h9M16.5 3.5a2.05 2.05 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  dices: <><rect x="3" y="9" width="12" height="12" rx="2" /><path d="M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" /><circle cx="7" cy="13" r="1" /><circle cx="11" cy="17" r="1" /><circle cx="17" cy="7" r="1" /></>,
  wand: <><path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /><path d="M4 20 14 10" /><path d="m14 10 1.5 1.5" /></>,
  tv: <><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="m7 3 5 3 5-3" /></>,
  radio: <><circle cx="12" cy="12" r="2" /><path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" /></>,
  cap: <><path d="m3 9 9-4 9 4-9 4Z" /><path d="M7 11v4c0 1 2 2 5 2s5-1 5-2v-4" /><path d="M21 9v5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  "calendar-plus": <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" /></>,
  clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></>,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  flag: <><path d="M4 21V4M4 4h13l-2 4 2 4H4" /></>,
  dot: <circle cx="12" cy="12" r="4" />,
  play: <path d="M6 4l14 8-14 8z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.4L4.5 8.3a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" /></>,
};
function Icon({ name, size = 16, strokeWidth = 1.9, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={style} className={className}>
      {ICONS[name] || null}
    </svg>
  );
}

/* ---- Button --------------------------------------------------------------- */
function Button({ variant = "secondary", size, icon, iconRight, children, className = "", style, ...rest }) {
  const cls = ["sl-btn"];
  if (variant === "primary") cls.push("sl-btn--primary");
  else if (variant === "ghost") cls.push("sl-btn--ghost");
  else if (variant === "danger") cls.push("sl-btn--danger");
  else if (variant === "outline") cls.push("sl-btn--outline");
  else cls.push("sl-btn--secondary");
  if (size === "sm") cls.push("sl-btn--sm");
  if (size === "lg") cls.push("sl-btn--lg");
  return (
    <button className={cls.join(" ") + " " + className} style={style} {...rest}>
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 15 : 17} /> : null}
    </button>
  );
}

/* ---- Badge / StatusBadge -------------------------------------------------- */
function Badge({ variant = "neutral", children, className = "", style }) {
  const cls = ["sl-badge"];
  const map = { outline: "sl-badge--outline", neutral: "sl-badge--neutral", solid: "sl-badge--solid", success: "sl-badge--success", danger: "sl-badge--danger" };
  if (variant === "warning") {
    style = { background: "rgba(255,158,74,.16)", color: "#ff9e4a", ...style };
  } else cls.push(map[variant] || map.neutral);
  return <span className={cls.join(" ") + " " + className} style={style}>{children}</span>;
}
const STATUS = {
  scheduled: ["outline", "Scheduled"], final: ["neutral", "Final"], live: ["live", "Live"],
  completed: ["success", "Completed"], active: ["success", "Active"], upcoming: ["outline", "Upcoming"],
};
function StatusBadge({ status }) {
  const [variant, label] = STATUS[String(status).toLowerCase()] || ["neutral", status];
  if (variant === "live") {
    return <span className="sl-badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
      <span className="sl-badge__dot" style={{ animation: "slPulse 1.4s infinite" }} />Live</span>;
  }
  return <Badge variant={variant}>{label}</Badge>;
}

/* ---- Card ----------------------------------------------------------------- */
function Card({ children, className = "", style, ...rest }) {
  return <div className={"sl-card " + className} style={style} {...rest}>{children}</div>;
}

/* ---- Team monogram + name ------------------------------------------------- */
function TeamMark({ id, size = 28 }) {
  const color = SL.teamColor(id);
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 8, flex: "none",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: color.replace("0.62", "0.28").replace(")", " / .18)").replace("oklch(", "oklch("),
      color: color, border: "1px solid " + color.replace(")", " / .35)"),
      font: "700 11px/1 'JetBrains Mono', monospace",
    }}>{SL.initials(SL.TEAM_BY_ID[id].name)}</span>
  );
}

/* ---- Select --------------------------------------------------------------- */
function Select({ value, onChange, options, className = "", style, "aria-label": aria }) {
  return (
    <span className={"sl-select-wrap " + className} style={style}>
      <select className="sl-select" value={value} aria-label={aria}
        onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="sl-select-wrap__chevron"><Icon name="chevron-vertical" size={15} /></span>
    </span>
  );
}

/* ---- Segmented ------------------------------------------------------------ */
function Segmented({ value, onChange, options }) {
  return (
    <div className="sl-segmented">
      {options.map((o) => (
        <button key={o.value} className={"sl-segmented__item" + (o.value === value ? " is-active" : "")}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---- Spinner -------------------------------------------------------------- */
function Spinner({ size = 18, stroke = 2.5 }) {
  return <span className="sl-spinner" style={{ width: size, height: size, borderWidth: stroke }} />;
}

/* ---- Modal (blocking, centered) ------------------------------------------ */
function Modal({ open, onClose, children, width = 460, labelledBy }) {
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) setMounted(true);
    else { const t = setTimeout(() => setMounted(false), 160); return () => clearTimeout(t); }
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className={"sl-overlay" + (open ? " is-open" : "")}
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={"sl-dialog sl-dialog--anim" + (open ? " is-open" : "")}
        style={{ maxWidth: width, width: "100%" }} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}
function DialogHead({ title, description, onClose, id }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <h3 id={id} className="sl-dialog__title" style={{ flex: 1, margin: 0 }}>{title}</h3>
        {onClose ? <button className="sl-iconbtn" onClick={onClose} aria-label="Close" style={{ width: 30, height: 30 }}><Icon name="x" size={16} /></button> : null}
      </div>
      {description ? <p className="sl-dialog__body" style={{ margin: "8px 0 0" }}>{description}</p> : null}
    </div>
  );
}
function DialogFooter({ children }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>{children}</div>;
}

/* ---- ConfirmDialog (shadcn-style replacement for window.confirm) ---------- */
function ConfirmDialog({ open, title, description, body, confirmLabel = "Confirm", cancelLabel = "Cancel",
  tone = "primary", busy, busyLabel, onConfirm, onCancel, extraAction }) {
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} width={460} labelledBy="confirm-title">
      <DialogHead id="confirm-title" title={title} description={description} onClose={busy ? undefined : onCancel} />
      {body}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        {extraAction ? (
          <Button variant={extraAction.variant || "outline"} icon={extraAction.icon} onClick={extraAction.onClick} disabled={busy}>
            {extraAction.label}
          </Button>
        ) : null}
        <Button variant={tone} onClick={onConfirm} disabled={busy}>
          {busy ? <><Spinner size={15} />{busyLabel || "Working…"}</> : confirmLabel}
        </Button>
      </DialogFooter>
    </Modal>
  );
}

/* ---- ProcessingModal (blocking, self-driving spinner + step log) ---------- */
function ProcessingModal({ open, title, subtitle, steps, onDone, doneLabel }) {
  const [i, setI] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  React.useEffect(() => {
    if (!open) { setI(0); setFinished(false); return; }
    let idx = 0; setI(0); setFinished(false);
    const tick = () => {
      idx += 1;
      if (idx < steps.length) { setI(idx); timer = setTimeout(tick, 620 + Math.random() * 380); }
      else { setI(steps.length); setFinished(true); timer = setTimeout(() => onDone && onDone(), 640); }
    };
    let timer = setTimeout(tick, 560);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line
  if (!open) return null;
  const pct = Math.round((Math.min(i, steps.length) / steps.length) * 100);
  return (
    <div className="sl-overlay is-open">
      <div className="sl-dialog sl-dialog--anim is-open" style={{ maxWidth: 440, width: "100%" }} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          {finished ? <span style={{ color: "var(--accent)" }}><Icon name="check-circle" size={22} /></span> : <Spinner size={20} />}
          <h3 className="sl-dialog__title" style={{ margin: 0 }}>{finished ? (doneLabel || "Done") : title}</h3>
        </div>
        {subtitle ? <p className="sl-dialog__body" style={{ margin: "6px 0 14px" }}>{subtitle}</p> : <div style={{ height: 10 }} />}
        <div className="sl-progress"><div className="sl-progress__bar" style={{ width: pct + "%" }} /></div>
        <ul className="sl-steplog">
          {steps.map((s, si) => {
            const state = si < i ? "done" : si === i && !finished ? "active" : si < i || finished ? "done" : "pending";
            const st = finished ? "done" : si < i ? "done" : si === i ? "active" : "pending";
            return (
              <li key={si} className={"sl-steplog__item is-" + st}>
                <span className="sl-steplog__mark">
                  {st === "done" ? <Icon name="check" size={13} /> : st === "active" ? <Spinner size={12} stroke={2} /> : <span className="sl-steplog__dot" />}
                </span>
                <span>{s}</span>
              </li>
            );
          })}
        </ul>
        <p className="sl-mono" style={{ fontSize: 11, color: "var(--text-subtle)", margin: "12px 0 0", textAlign: "center" }}>
          Working… please don’t navigate away
        </p>
      </div>
    </div>
  );
}

/* ---- Sheet (right-docked drawer for previews / gamecast) ------------------ */
function Sheet({ open, onClose, children, width = 720, label }) {
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) setMounted(true);
    else { const t = setTimeout(() => setMounted(false), 240); return () => clearTimeout(t); }
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className={"sl-overlay sl-overlay--sheet" + (open ? " is-open" : "")}
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <aside className={"sl-sheet" + (open ? " is-open" : "")} style={{ width: Math.min(width, 1000) }}
        role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  );
}

/* ---- Accordion section ---------------------------------------------------- */
function AccordionSection({ open, onToggle, title, subtitle, right, children, tone }) {
  return (
    <div className={"sl-acc" + (open ? " is-open" : "")}>
      <div className="sl-acc__head">
        <button className="sl-acc__trigger" onClick={onToggle} aria-expanded={open}>
          <span className={"sl-acc__chev" + (open ? " is-open" : "")}><Icon name="chevron-right" size={16} /></span>
          <span className="sl-acc__title">{title}</span>
          {subtitle ? <span className="sl-acc__sub">{subtitle}</span> : null}
          {tone ? <span className="sl-acc__tone">{tone}</span> : null}
        </button>
        {right ? <div className="sl-acc__right">{right}</div> : null}
      </div>
      {open ? <div className="sl-acc__body">{children}</div> : null}
    </div>
  );
}

/* ---- Toasts (module-level bus) -------------------------------------------- */
const ToastBus = (function () {
  let subs = [];
  let id = 0;
  return {
    subscribe(fn) { subs.push(fn); return () => (subs = subs.filter((s) => s !== fn)); },
    push(t) { const item = { id: ++id, tone: "default", ...t }; subs.forEach((s) => s(item)); return item.id; },
  };
})();
function toast(t) { return ToastBus.push(t); }
toast.success = (title, opts) => ToastBus.push({ tone: "success", title, ...opts });
toast.error = (title, opts) => ToastBus.push({ tone: "danger", title, ...opts });
function Toaster() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => ToastBus.subscribe((t) => {
    setItems((xs) => [...xs, t]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.duration || 4200);
  }), []);
  return (
    <div className="sl-toaster">
      {items.map((t) => (
        <div key={t.id} className="sl-toast" role="status">
          <span className="sl-toast__icon" style={{ color: t.tone === "success" ? "var(--accent)" : t.tone === "danger" ? "var(--danger)" : "var(--text-muted)" }}>
            <Icon name={t.tone === "success" ? "check-circle" : t.tone === "danger" ? "alert" : "dot"} size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl-toast__title">{t.title}</p>
            {t.description ? <p className="sl-toast__desc">{t.description}</p> : null}
          </div>
          {t.action ? <button className="sl-toast__action" onClick={() => { t.action.onClick(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>{t.action.label}</button> : null}
          <button className="sl-toast__x" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} aria-label="Dismiss"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  Icon, Button, Badge, StatusBadge, Card, TeamMark, Select, Segmented, Spinner,
  Modal, DialogHead, DialogFooter, ConfirmDialog, ProcessingModal, Sheet,
  AccordionSection, Toaster, toast,
});
