"use client";

import { useEffect, useState } from "react";

/**
 * History Back control (WSM-000571, ASR-7). Falls back gracefully when there
 * is no previous in-app history entry: it disables rather than navigating
 * to a foreign origin or `document.referrer`, which would otherwise break
 * the existing topbar/history contract.
 */
export function HistoryBackButton({
  label = "Back",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    // `popstate` fires on history navigations; reading length inside the
    // listener keeps the value current without forcing an extra render on
    // mount and avoids the cascading-render lint pattern.
    const update = () => setHasHistory(window.history.length > 1);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (!hasHistory) return;
        window.history.back();
      }}
      disabled={!hasHistory}
      aria-label={label}
      data-testid="history-back-button"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1 text-sm text-text-muted transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <span aria-hidden>←</span>
      <span>{label}</span>
    </button>
  );
}