"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LocalWorkspaceProvider } from "@/lib/local/local-workspace-provider";
import {
  clearLocalWorkspace,
  serializeLocalWorkspace,
  type LocalWorkspaceExport,
} from "@/lib/local/local-export";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "wsm-migrate-dismissed";

/**
 * On first authenticated load, if the browser holds a local workspace (from the
 * free no-login tier), offer a one-click import into the account — the AC #3
 * upgrade-without-data-loss path. Explicit (not silent) per the RFC §8 decision.
 * Detection is client-side because the data lives in IndexedDB.
 */
export function MigrateLocalPrompt() {
  const router = useRouter();
  const [data, setData] = useState<LocalWorkspaceExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    let cancelled = false;
    void (async () => {
      const provider = new LocalWorkspaceProvider();
      const exported = await serializeLocalWorkspace(provider);
      if (!cancelled && exported) {
        setData(exported);
        setHidden(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || !data) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function onImport() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/local/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Migration failed");
      }
      // Clear local mode so this never re-fires and there's no duplicate copy.
      await clearLocalWorkspace();
      sessionStorage.setItem(DISMISS_KEY, "1");
      setHidden(true);
      toast.success(
        `Imported ${data.counts.teams} team${
          data.counts.teams === 1 ? "" : "s"
        } from local mode into your account.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setBusy(false);
    }
  }

  const { teams, players } = data.counts;

  return (
    <Card className="mb-6 border-primary/40">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Bring your local workspace in?
          </CardTitle>
          <CardDescription className="mt-1">
            You have {teams} team{teams === 1 ? "" : "s"} and {players} player
            {players === 1 ? "" : "s"} saved in this browser from local mode.
            Import them into your account — your schedule comes too, and the local
            copy is cleared afterward.
          </CardDescription>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button onClick={onImport} disabled={busy}>
            {busy ? "Importing…" : "Import my workspace"}
          </Button>
          <Button variant="outline" onClick={dismiss} disabled={busy}>
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
