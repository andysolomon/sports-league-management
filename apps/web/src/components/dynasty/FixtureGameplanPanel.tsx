"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveFixtureGameplanAction } from "@/app/dashboard/_actions/fixture-gameplan";
import {
  GAMEPLAN_FOCUS_OPTIONS,
  type GameplanFocus,
} from "@/lib/program/gameplan";
import type { FixtureGameplanDto } from "@/lib/data-api";

const UNSET = "";

export interface FixtureGameplanPanelProps {
  fixtureId: string;
  seasonId: string;
  teamId: string;
  teamLabel: string;
  initial: FixtureGameplanDto | null;
  canManage: boolean;
}

export function FixtureGameplanPanel({
  fixtureId,
  seasonId,
  teamId,
  teamLabel,
  initial,
  canManage,
}: FixtureGameplanPanelProps) {
  const [focus, setFocus] = useState(initial?.focus ?? UNSET);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (!canManage && !saved?.focus) return null;

  function save() {
    startTransition(async () => {
      const result = await saveFixtureGameplanAction({
        fixtureId,
        seasonId,
        teamId,
        focus: focus === UNSET ? undefined : focus,
      });
      if (!result.ok) {
        toast.error(`Could not save gameplan: ${result.error}`);
        return;
      }
      setSaved(result.data);
      toast.success("Gameplan saved.");
    });
  }

  return (
    <div
      className="rounded-md border border-border p-3"
      data-testid={`fixture-gameplan-${teamId}`}
    >
      <p className="text-caption-12 text-text-muted">{teamLabel} gameplan</p>
      {canManage ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-caption-12 text-text-muted">Focus</span>
            <select
              className="h-9 min-w-[10rem] rounded-control border border-border bg-surface px-2 text-body-15"
              value={focus}
              data-testid={`fixture-gameplan-focus-${teamId}`}
              onChange={(e) => setFocus(e.target.value)}
            >
              <option value={UNSET}>No gameplan</option>
              {GAMEPLAN_FOCUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            disabled={pending}
            data-testid={`fixture-gameplan-save-${teamId}`}
            onClick={save}
          >
            {pending ? "Saving…" : "Save gameplan"}
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-body-15" data-testid={`fixture-gameplan-readonly-${teamId}`}>
          {(saved?.focus as GameplanFocus | null)?.replaceAll("_", " ") ??
            "No gameplan"}
        </p>
      )}
    </div>
  );
}
