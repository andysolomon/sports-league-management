"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonDto } from "@sports-management/shared-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, CheckCircle2, Users } from "lucide-react";
import {
  createSeasonAction,
  updateSeasonAction,
  activateSeasonAction,
  deleteSeasonAction,
  copyRostersAction,
} from "./actions";

const inputClass =
  "rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground";

/** Empty string from a date input → null (the schema stores nullable dates). */
function nullableDate(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Bye-friendly playoff team counts (any value ≥ 2 is supported; the bracket
 *  rounds up to the next power of two and gives top seeds first-round byes). */
const PLAYOFF_TEAM_OPTIONS = [2, 4, 6, 8, 10, 12, 16] as const;

/** Playoff setup fields shared by the create + edit season forms (WSM-000184,
 *  WSM-flex-brackets: bye-friendly counts + single/double elimination). */
function PlayoffConfigFields({
  playoffTeams,
  setPlayoffTeams,
  playoffFormat,
  setPlayoffFormat,
  divisionWinnersQualify,
  setDivisionWinnersQualify,
}: {
  playoffTeams: number;
  setPlayoffTeams: (n: number) => void;
  playoffFormat: string;
  setPlayoffFormat: (f: string) => void;
  divisionWinnersQualify: boolean;
  setDivisionWinnersQualify: (b: boolean) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Playoffs
        <select
          className={inputClass}
          value={playoffTeams}
          onChange={(e) => setPlayoffTeams(Number(e.target.value))}
          aria-label="Number of playoff teams"
        >
          <option value={0}>None</option>
          {PLAYOFF_TEAM_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} teams
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Format
        <select
          className={inputClass}
          value={playoffFormat}
          onChange={(e) => setPlayoffFormat(e.target.value)}
          aria-label="Playoff format"
          disabled={playoffTeams === 0}
        >
          <option value="single">Single elimination</option>
          <option value="double">Double elimination</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={divisionWinnersQualify}
          onChange={(e) => setDivisionWinnersQualify(e.target.checked)}
        />
        Division winners qualify
      </label>
    </>
  );
}

export function CreateSeasonButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [playoffTeams, setPlayoffTeams] = useState(8);
  const [playoffFormat, setPlayoffFormat] = useState("single");
  const [divisionWinnersQualify, setDivisionWinnersQualify] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setStartDate("");
    setEndDate("");
    setPlayoffTeams(8);
    setPlayoffFormat("single");
    setDivisionWinnersQualify(false);
    setOpen(false);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await createSeasonAction({
      leagueId,
      name: trimmed,
      startDate: nullableDate(startDate),
      endDate: nullableDate(endDate),
      playoffTeams,
      playoffFormat,
      divisionWinnersQualify,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Created ${trimmed}.`);
      reset();
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can add seasons." : res.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New season
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") reset();
        }}
        placeholder="Season name (e.g. 2026)"
        className={inputClass}
      />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Start
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        End
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <PlayoffConfigFields
        playoffTeams={playoffTeams}
        setPlayoffTeams={setPlayoffTeams}
        playoffFormat={playoffFormat}
        setPlayoffFormat={setPlayoffFormat}
        divisionWinnersQualify={divisionWinnersQualify}
        setDivisionWinnersQualify={setDivisionWinnersQualify}
      />
      <Button size="sm" disabled={busy} onClick={submit}>
        {busy ? "…" : "Create"}
      </Button>
      <Button size="sm" variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * Copy rosters from the most recent prior season into this one (WSM-000163).
 * Mirrors the GenerateScheduleButton confirm flow: a populated target surfaces
 * `needsConfirm`, and the user is asked before the clean-replace proceeds.
 */
export function CopyRostersButton({ season }: { season: SeasonDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(confirm: boolean) {
    setBusy(true);
    const res = await copyRostersAction({
      targetSeasonId: season.id,
      confirm,
    });
    setBusy(false);

    if (res.ok) {
      toast.success(
        `Copied ${res.copiedAssignments} roster ${
          res.copiedAssignments === 1 ? "player" : "players"
        } into ${season.name}.`,
      );
      router.refresh();
      return;
    }

    if ("needsConfirm" in res) {
      const proceed = window.confirm(
        `${season.name} already has rosters. Copying replaces them with last season's rosters. This can't be undone. Continue?`,
      );
      if (proceed) run(true);
      return;
    }

    toast.error(
      res.error === "not_admin"
        ? "Only league admins can copy rosters."
        : res.error,
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => run(false)}
      aria-label={`Copy rosters from last season into ${season.name}`}
    >
      <Users className="mr-1 h-3.5 w-3.5" />
      {busy ? "…" : "Copy rosters"}
    </Button>
  );
}

export function SeasonRowActions({ season }: { season: SeasonDto }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(season.name);
  const [startDate, setStartDate] = useState(season.startDate ?? "");
  const [endDate, setEndDate] = useState(season.endDate ?? "");
  const [playoffTeams, setPlayoffTeams] = useState(season.playoffTeams ?? 8);
  const [playoffFormat, setPlayoffFormat] = useState(
    season.playoffFormat ?? "single",
  );
  const [divisionWinnersQualify, setDivisionWinnersQualify] = useState(
    season.divisionWinnersQualify ?? false,
  );
  const [busy, setBusy] = useState(false);

  const isActive = season.status === "active";

  async function activate() {
    setBusy(true);
    const res = await activateSeasonAction(season.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`${season.name} is now the active season.`);
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can do that." : res.error);
    }
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await updateSeasonAction({
      seasonId: season.id,
      name: trimmed,
      startDate: nullableDate(startDate),
      endDate: nullableDate(endDate),
      playoffTeams,
      playoffFormat,
      divisionWinnersQualify,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Season updated.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can edit seasons." : res.error);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${season.name}" and its schedule, results, and attributes? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await deleteSeasonAction(season.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`Deleted ${season.name}.`);
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can delete seasons." : res.error);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className={inputClass}
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputClass}
          aria-label="End date"
        />
        <PlayoffConfigFields
          playoffTeams={playoffTeams}
          setPlayoffTeams={setPlayoffTeams}
          playoffFormat={playoffFormat}
          setPlayoffFormat={setPlayoffFormat}
          divisionWinnersQualify={divisionWinnersQualify}
          setDivisionWinnersQualify={setDivisionWinnersQualify}
        />
        <Button size="sm" disabled={busy} onClick={save}>
          {busy ? "…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {!isActive && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={activate}
          aria-label={`Make ${season.name} active`}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          Make active
        </Button>
      )}
      <CopyRostersButton season={season} />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${season.name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={remove}
        aria-label={`Delete ${season.name}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
