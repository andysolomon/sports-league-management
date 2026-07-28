"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  removeRivalryAction,
  saveRivalryAction,
} from "@/app/dashboard/_actions/rivalries";
import {
  RIVALRY_INTENSITY_DEFAULT,
  RIVALRY_INTENSITY_MAX,
  RIVALRY_INTENSITY_MIN,
} from "@/lib/rivalries";
import type { RivalryDto } from "@/lib/data-api";

/*
 * Rivalry management (A5).
 *
 * A rivalry is a property of the SCHEDULE, not of one team — it changes how a
 * game between two programs plays for both of them — so it lives on League
 * Settings alongside the other commissioner controls rather than on Team Home.
 */

export interface RivalryTeamOption {
  id: string;
  name: string;
}

function teamName(teams: RivalryTeamOption[], id: string): string {
  return teams.find((t) => t.id === id)?.name ?? "Unknown team";
}

export function RivalriesCard({
  leagueId,
  teams,
  initialRivalries,
}: {
  leagueId: string;
  teams: RivalryTeamOption[];
  initialRivalries: RivalryDto[];
}) {
  const [rivalries, setRivalries] = useState<RivalryDto[]>(initialRivalries);
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [name, setName] = useState("");
  const [intensity, setIntensity] = useState(RIVALRY_INTENSITY_DEFAULT);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...rivalries].sort((a, b) =>
        teamName(teams, a.teamAId).localeCompare(teamName(teams, b.teamAId)),
      ),
    [rivalries, teams],
  );

  // The two selects must not name the same program, and the pairing has to be
  // complete before there is anything to save.
  const canSave = teamAId !== "" && teamBId !== "" && teamAId !== teamBId;

  function add() {
    if (!canSave) return;
    startTransition(async () => {
      const result = await saveRivalryAction({
        leagueId,
        teamAId,
        teamBId,
        name: name.trim() === "" ? undefined : name.trim(),
        intensity,
      });
      if (!result.ok) {
        toast.error(`Could not save rivalry: ${result.error}`);
        return;
      }
      // Upsert, so replace any existing row for this pairing rather than
      // appending a duplicate the server already merged.
      setRivalries((prev) => [
        ...prev.filter((r) => r.pairKey !== result.data.pairKey),
        result.data,
      ]);
      setTeamAId("");
      setTeamBId("");
      setName("");
      toast.success("Rivalry saved.");
    });
  }

  function remove(rivalry: RivalryDto) {
    startTransition(async () => {
      const result = await removeRivalryAction({
        leagueId,
        rivalryId: rivalry.id,
      });
      if (!result.ok) {
        toast.error(`Could not remove rivalry: ${result.error}`);
        return;
      }
      setRivalries((prev) => prev.filter((r) => r.id !== rivalry.id));
      toast.success("Rivalry removed.");
    });
  }

  return (
    <div className="space-y-4" data-testid="rivalries-settings">
      <div>
        <h3 className="text-label-14 text-foreground">Rivalries</h3>
        <p className="text-caption-12 text-text-muted">
          Declared rivalries carry extra weight. A rivalry game damps home-field
          advantage — the one night nobody is intimidated.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-caption-12 text-text-muted">Team</span>
          <select
            className="h-9 w-44 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
            value={teamAId}
            data-testid="rivalry-team-a"
            onChange={(e) => setTeamAId(e.target.value)}
          >
            <option value="">Select…</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption-12 text-text-muted">Rival</span>
          <select
            className="h-9 w-44 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
            value={teamBId}
            data-testid="rivalry-team-b"
            onChange={(e) => setTeamBId(e.target.value)}
          >
            <option value="">Select…</option>
            {teams
              .filter((team) => team.id !== teamAId)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption-12 text-text-muted">Name</span>
          <input
            className="h-9 w-44 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
            value={name}
            placeholder="Optional"
            data-testid="rivalry-name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption-12 text-text-muted">
            Intensity {RIVALRY_INTENSITY_MIN}–{RIVALRY_INTENSITY_MAX}
          </span>
          <input
            type="number"
            min={RIVALRY_INTENSITY_MIN}
            max={RIVALRY_INTENSITY_MAX}
            className="h-9 w-24 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
            value={intensity}
            data-testid="rivalry-intensity"
            onChange={(e) => setIntensity(Number(e.target.value))}
          />
        </label>

        <Button
          size="sm"
          disabled={!canSave || pending}
          data-testid="rivalry-save"
          onClick={add}
        >
          Add rivalry
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-caption-12 text-text-muted" data-testid="rivalries-empty">
          No rivalries declared.
        </p>
      ) : (
        <ul className="divide-y divide-border" data-testid="rivalries-list">
          {sorted.map((rivalry) => (
            <li
              key={rivalry.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              data-testid="rivalry-row"
            >
              <div className="min-w-0">
                <p className="text-label-14 text-foreground">
                  {teamName(teams, rivalry.teamAId)} vs{" "}
                  {teamName(teams, rivalry.teamBId)}
                </p>
                <p className="text-caption-12 text-text-muted">
                  {rivalry.name ? `${rivalry.name} · ` : ""}Intensity{" "}
                  {rivalry.intensity}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                data-testid="rivalry-remove"
                onClick={() => remove(rivalry)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
