"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { csvToLeagueImport } from "@/lib/csv-import";
import { useLocalProvider } from "@/lib/local/use-local-provider";
import {
  importLeagueIntoLocal,
  type LeagueImportPayload,
  type LocalImportResult,
} from "@/lib/local/local-import";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Preview {
  leagueName: string;
  divisions: number;
  teams: number;
  players: number;
}

type State =
  | { step: "idle" }
  | { step: "invalid"; fileName: string; errors: string[] }
  | { step: "preview"; fileName: string; preview: Preview; payload: LeagueImportPayload }
  | { step: "importing"; fileName: string }
  | { step: "done"; result: LocalImportResult };

function previewOf(payload: LeagueImportPayload): Preview {
  let teams = 0;
  let players = 0;
  for (const d of payload.divisions) {
    teams += d.teams.length;
    for (const t of d.teams) players += t.players.length;
  }
  return {
    leagueName: payload.league.name,
    divisions: payload.divisions.length,
    teams,
    players,
  };
}

export default function LocalImportPage() {
  const provider = useLocalProvider();
  const [state, setState] = useState<State>({ step: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const isCsv =
      file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let raw: unknown;

      if (isCsv) {
        const { payload, rowErrors } = csvToLeagueImport(text);
        if (rowErrors.length > 0 || payload === null) {
          setState({
            step: "invalid",
            fileName: file.name,
            errors:
              rowErrors.length > 0
                ? rowErrors
                : ["Could not read any rows from the CSV file."],
          });
          return;
        }
        raw = payload;
      } else {
        try {
          raw = JSON.parse(text);
        } catch {
          setState({
            step: "invalid",
            fileName: file.name,
            errors: ["File is not valid JSON."],
          });
          return;
        }
      }

      const parsed = LeagueImportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({
          step: "invalid",
          fileName: file.name,
          errors: parsed.error.issues.map(
            (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
          ),
        });
        return;
      }

      setState({
        step: "preview",
        fileName: file.name,
        preview: previewOf(parsed.data),
        payload: parsed.data,
      });
    };
    reader.readAsText(file);
  }, []);

  const onInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  async function onImport() {
    if (state.step !== "preview" || !provider) return;
    const { fileName, payload } = state;
    setState({ step: "importing", fileName });
    try {
      const result = await importLeagueIntoLocal(provider, payload);
      setState({ step: "done", result });
      toast.success("Imported into your local workspace.");
    } catch {
      toast.error("Import failed.");
      setState({ step: "idle" });
    }
  }

  function reset() {
    setState({ step: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/local"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspace
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Import</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Seed your local workspace from a CSV or JSON file — the same format the
          full importer uses. CSV is one row per player with a header row
          (league, division, team, city, stadium, playerName, position,
          jerseyNumber, …). Existing teams and players are matched by name.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a file</CardTitle>
          <CardDescription>
            Everything imports into this browser only — no account needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-card"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            aria-label="Upload import file"
          >
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a <code>.csv</code> or <code>.json</code> file here or click to
              browse
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json,.csv,text/csv"
              onChange={onInput}
              className="hidden"
              aria-label="Choose import file"
            />
          </div>
        </CardContent>
      </Card>

      {state.step === "invalid" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="h-5 w-5" />
              Couldn&rsquo;t read {state.fileName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div role="alert" className="space-y-1">
              {state.errors.slice(0, 8).map((err, i) => (
                <p key={i} className="text-sm text-destructive">
                  {err}
                </p>
              ))}
            </div>
            <Button variant="outline" className="mt-4" onClick={reset}>
              Try another file
            </Button>
          </CardContent>
        </Card>
      )}

      {state.step === "preview" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Ready to import</CardTitle>
            <CardDescription>{state.fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="League" value={state.preview.leagueName} />
              <Stat label="Divisions" value={state.preview.divisions} />
              <Stat label="Teams" value={state.preview.teams} />
              <Stat label="Players" value={state.preview.players} />
            </div>
            <div className="flex gap-2">
              <Button onClick={onImport} disabled={!provider}>
                Import into my workspace
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === "importing" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing…</p>
          </CardContent>
        </Card>
      )}

      {state.step === "done" && (
        <Card className="border-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-accent">
              <CheckCircle2 className="h-5 w-5" />
              Import complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Added {state.result.created.divisions} division(s),{" "}
              {state.result.created.teams} team(s), and{" "}
              {state.result.created.players} player(s).
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/local">Go to workspace</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                Import another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-card p-3 text-center">
      <p className="truncate text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
