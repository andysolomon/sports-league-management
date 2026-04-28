"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SyncConfig, SyncReport } from "@sports-management/shared-types";
import { Button } from "@/components/ui/8bit/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

type CardState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; config: SyncConfig; syncing: boolean };

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function SyncReportDisplay({ report }: { report: SyncReport }) {
  const hasImportResult = report.importResult !== null;
  const hasErrors =
    (report.importResult?.errors?.length ?? 0) > 0 ||
    report.adapterErrors.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="h-4 w-4" />
        <span>{formatDate(report.completedAt)}</span>
        <span className="text-gray-300">|</span>
        <span>{formatDuration(report.durationMs)}</span>
      </div>

      {hasImportResult && report.importResult && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["leagues", "divisions", "teams", "players"] as const).map(
            (entity) => (
              <div key={entity} className="rounded-md bg-gray-50 p-2 text-center">
                <p className="text-xs font-medium capitalize text-gray-500">
                  {entity}
                </p>
                <p className="text-sm">
                  <span className="font-semibold text-green-700">
                    {report.importResult!.created[entity]}
                  </span>
                  {" / "}
                  <span className="text-gray-600">
                    {report.importResult!.updated[entity]}
                  </span>
                </p>
                <p className="text-[10px] text-gray-400">created / updated</p>
              </div>
            ),
          )}
        </div>
      )}

      {hasErrors && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2">
          <p className="text-xs font-medium text-red-700">
            {report.adapterErrors.length > 0 &&
              report.adapterErrors.map((e, i) => (
                <span key={i} className="block">
                  {e}
                </span>
              ))}
            {(report.importResult?.errors ?? []).map((e, i) => (
              <span key={i} className="block">
                {e.entity} &quot;{e.name}&quot;: {e.message}
              </span>
            ))}
          </p>
        </div>
      )}

      {!hasImportResult && report.adapterErrors.length === 0 && (
        <p className="text-sm text-gray-500">No data returned from sync.</p>
      )}
    </div>
  );
}

export function NflSyncCard() {
  const [state, setState] = useState<CardState>({ phase: "loading" });

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/import/nfl-sync-config");
      if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
      const config: SyncConfig = await res.json();
      setState({ phase: "ready", config, syncing: false });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to load config",
      });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleToggle = useCallback(async () => {
    if (state.phase !== "ready") return;
    const newEnabled = !state.config.syncEnabled;

    // Optimistic update
    setState({
      ...state,
      config: { ...state.config, syncEnabled: newEnabled },
    });

    try {
      const res = await fetch("/api/import/nfl-sync-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: newEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update toggle");
      toast.success(
        `Nightly sync ${newEnabled ? "enabled" : "disabled"}`,
      );
    } catch {
      // Revert
      setState({
        ...state,
        config: { ...state.config, syncEnabled: !newEnabled },
      });
      toast.error("Failed to update sync toggle");
    }
  }, [state]);

  const handleSyncNow = useCallback(async () => {
    if (state.phase !== "ready") return;
    setState({ ...state, syncing: true });

    try {
      const res = await fetch("/api/import/nfl-sync", { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const report: SyncReport = await res.json();

      setState({
        phase: "ready",
        config: { ...state.config, lastSyncReport: report },
        syncing: false,
      });

      if (
        report.adapterErrors.length > 0 ||
        (report.importResult?.errors?.length ?? 0) > 0
      ) {
        toast.warning("Sync completed with errors");
      } else {
        toast.success("NFL sync completed successfully");
      }
    } catch (err) {
      setState({ ...state, syncing: false });
      toast.error(
        err instanceof Error ? err.message : "Sync failed",
      );
    }
  }, [state]);

  if (state.phase === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-gray-600">Loading sync config...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "error") {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            NFL Live Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{state.message}</p>
          <Button variant="outline" className="mt-3" onClick={loadConfig}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { config, syncing } = state;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              NFL Live Data
            </CardTitle>
            <CardDescription>
              Sync all 32 NFL teams and rosters from ESPN
            </CardDescription>
          </div>
          <button
            role="switch"
            aria-checked={config.syncEnabled}
            onClick={handleToggle}
            disabled={syncing}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              config.syncEnabled ? "bg-primary" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                config.syncEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button onClick={handleSyncNow} disabled={syncing} size="sm">
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              "Sync Now"
            )}
          </Button>
          <span className="text-xs text-gray-500">
            {config.syncEnabled
              ? "Nightly sync enabled (4 AM UTC)"
              : "Nightly sync disabled"}
          </span>
        </div>

        {config.lastSyncReport ? (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Last Sync
            </h4>
            <SyncReportDisplay report={config.lastSyncReport} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No sync has been run yet. Click &quot;Sync Now&quot; to import NFL data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
