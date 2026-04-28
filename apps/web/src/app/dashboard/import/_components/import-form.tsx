"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import type { ImportResult } from "@sports-management/shared-types";
import { Button } from "@/components/ui/8bit/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type ValidationError = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

interface Preview {
  leagueName: string;
  divisionCount: number;
  teamCount: number;
  playerCount: number;
}

type FormState =
  | { step: "idle" }
  | { step: "invalid"; fileName: string; errors: ValidationError }
  | { step: "preview"; fileName: string; preview: Preview; rawPayload: unknown }
  | { step: "importing"; fileName: string }
  | { step: "done"; fileName: string; result: ImportResult };

function computePreview(data: ReturnType<typeof LeagueImportSchema.parse>): Preview {
  let teamCount = 0;
  let playerCount = 0;
  for (const div of data.divisions) {
    teamCount += div.teams.length;
    for (const team of div.teams) {
      playerCount += team.players.length;
    }
  }
  return {
    leagueName: data.league.name,
    divisionCount: data.divisions.length,
    teamCount,
    playerCount,
  };
}

export function ImportForm() {
  const [state, setState] = useState<FormState>({ step: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let json: unknown;
      try {
        json = JSON.parse(e.target?.result as string);
      } catch {
        setState({
          step: "invalid",
          fileName: file.name,
          errors: { formErrors: ["File is not valid JSON"], fieldErrors: {} },
        });
        return;
      }

      const parsed = LeagueImportSchema.safeParse(json);
      if (!parsed.success) {
        setState({
          step: "invalid",
          fileName: file.name,
          errors: parsed.error.flatten(),
        });
        return;
      }

      setState({
        step: "preview",
        fileName: file.name,
        preview: computePreview(parsed.data),
        rawPayload: json,
      });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = useCallback(async () => {
    if (state.step !== "preview") return;
    const { fileName, rawPayload } = state;

    setState({ step: "importing", fileName });

    try {
      const res = await fetch("/api/cli/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawPayload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error ?? `Import failed: ${res.status} ${res.statusText}`,
        );
      }

      const result: ImportResult = await res.json();
      setState({ step: "done", fileName, result });

      if (result.errors.length > 0) {
        toast.warning(
          `Import completed with ${result.errors.length} error(s)`,
        );
      } else {
        toast.success("Import completed successfully");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setState({ step: "idle" });
    }
  }, [state]);

  const handleReset = useCallback(() => {
    setState({ step: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>JSON Import</CardTitle>
          <CardDescription>
            Upload a JSON file containing league, division, team, and player
            data. Existing records are matched by name and updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-primary hover:bg-gray-50"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            aria-label="Upload JSON file"
          >
            <Upload className="mb-3 h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              Drop a <code>.json</code> file here or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleInputChange}
              className="hidden"
              aria-label="Choose JSON file"
            />
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {state.step === "invalid" && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Validation Failed
            </CardTitle>
            <CardDescription>
              <FileJson className="mr-1 inline h-4 w-4" />
              {state.fileName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div role="alert" className="space-y-2">
              {state.errors.formErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-600">
                  {err}
                </p>
              ))}
              {Object.entries(state.errors.fieldErrors).map(([field, errs]) =>
                errs.map((err, i) => (
                  <p key={`${field}-${i}`} className="text-sm text-red-600">
                    <code className="mr-1 rounded bg-red-50 px-1 text-xs">
                      {field}
                    </code>
                    {err}
                  </p>
                )),
              )}
            </div>
            <Button variant="outline" className="mt-4" onClick={handleReset}>
              Try another file
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {state.step === "preview" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Ready to Import
            </CardTitle>
            <CardDescription>{state.fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold">{state.preview.leagueName}</p>
                <p className="text-xs text-gray-500">League</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold">{state.preview.divisionCount}</p>
                <p className="text-xs text-gray-500">Divisions</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold">{state.preview.teamCount}</p>
                <p className="text-xs text-gray-500">Teams</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold">{state.preview.playerCount}</p>
                <p className="text-xs text-gray-500">Players</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport}>Start Import</Button>
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing */}
      {state.step === "importing" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-gray-600">
              Importing data from {state.fileName}...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {state.step === "done" && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["leagues", "divisions", "teams", "players"] as const).map(
                (entity) => (
                  <div key={entity} className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-medium capitalize text-gray-500">
                      {entity}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-green-700">
                        {state.result.created[entity]} created
                      </span>
                      {", "}
                      <span className="text-gray-600">
                        {state.result.updated[entity]} updated
                      </span>
                    </p>
                  </div>
                ),
              )}
            </div>

            {state.result.errors.length > 0 && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-sm font-medium text-red-700">
                  {state.result.errors.length} error(s) during import:
                </p>
                {state.result.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600">
                    {err.entity} &quot;{err.name}&quot;: {err.message}
                  </p>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={handleReset}>
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
