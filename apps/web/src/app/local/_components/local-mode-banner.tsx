"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";

const DISMISS_KEY = "wsm-local-banner-dismissed";

/**
 * Persistent (per-session, dismissible) notice that the user is in local mode —
 * data lives only in this browser. Sets expectations honestly (IndexedDB can be
 * evicted / is per-device) and funnels toward a free account for backup + sharing.
 */
export function LocalModeBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-foreground">
        You&rsquo;re in <strong>local mode</strong> — everything is saved only in
        this browser, no account needed. To back it up, sync across devices, or
        share, {" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          create a free account
        </Link>
        .
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
