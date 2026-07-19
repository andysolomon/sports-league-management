"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonDto, SimulationFlavor } from "@sports-management/shared-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, CheckCircle2, Users, Trophy } from "lucide-react";
import type { UndersizedTeam } from "@/lib/offseason-activate";
import { DEFAULT_TARGET_ROSTER_SIZE } from "@/lib/offseason-activate";
import { ActivateSeasonWarningDialog } from "@/components/offseason/ActivateSeasonWarningDialog";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import {
  createSeasonAction,
  updateSeasonAction,
  activateSeasonAction,
  completeSeasonAction,
  deleteSeasonAction,
  copyRostersAction,
} from "./actions";

const inputClass =
  "rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground";

/** Empty string from a date input → null (the schema stores nullable dates). */
function nullableDate(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Standard playoff field sizes for new seasons (WSM-000241). */
const PLAYOFF_TEAM_OPTIONS = [4, 8, 16] as const;

const SIMULATION_FLAVOR_OPTIONS: {
  value: SimulationFlavor;
  label: string;
}[] = [
  { value: "balanced", label: "Balanced" },
  { value: "chalk", label: "Chalk (favorites)" },
  { value: "upsets", label: "Upsets" },
];

/** Defaults for create — hidden from the two-step dialog (WSM-000255). */
const DEFAULT_CREATE_SIMULATION_FLAVOR: SimulationFlavor = "balanced";

function playoffTeamOptions(current: number): number[] {
  const base = [0, ...PLAYOFF_TEAM_OPTIONS];
  if (current > 0 && !PLAYOFF_TEAM_OPTIONS.includes(current as 4 | 8 | 16)) {
    return [...base, current];
  }
  return base;
}

/** Playoff setup fields shared by the create + edit season forms (WSM-000184,
 *  WSM-flex-brackets: bye-friendly counts + single/double elimination). */
function PlayoffConfigFields({
  playoffTeams,
  setPlayoffTeams,
  playoffFormat,
  setPlayoffFormat,
  divisionWinnersQualify,
  setDivisionWinnersQualify,
  simulationFlavor,
  setSimulationFlavor,
  playoffTeamChoices,
}: {
  playoffTeams: number;
  setPlayoffTeams: (n: number) => void;
  playoffFormat: string;
  setPlayoffFormat: (f: string) => void;
  divisionWinnersQualify: boolean;
  setDivisionWinnersQualify: (b: boolean) => void;
  simulationFlavor: SimulationFlavor;
  setSimulationFlavor: (f: SimulationFlavor) => void;
  playoffTeamChoices?: number[];
}) {
  const teamOptions = playoffTeamChoices ?? playoffTeamOptions(playoffTeams);

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
          {teamOptions.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "None" : `${n} teams`}
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
        Simulation
        <select
          className={inputClass}
          value={simulationFlavor}
          onChange={(e) => setSimulationFlavor(e.target.value as SimulationFlavor)}
          aria-label="Simulation flavor"
        >
          {SIMULATION_FLAVOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
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
  const [busy, setBusy] = useState(false);
  /** Name of the season just created; non-null switches the dialog to its success state. */
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setStartDate("");
    setEndDate("");
    setPlayoffTeams(8);
    setPlayoffFormat("single");
    setCreatedName(null);
    setCreatedId(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
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
      divisionWinnersQualify: false,
      simulationFlavor: DEFAULT_CREATE_SIMULATION_FLAVOR,
    });
    setBusy(false);
    if (res.ok) {
      setCreatedName(trimmed);
      setCreatedId(res.id);
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can add seasons." : res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New season
        </Button>
      </DialogTrigger>
      <DialogContent>
        {createdName === null ? (
          <>
            <DialogHeader>
              <DialogTitle>New season</DialogTitle>
              <DialogDescription>
                Add a season to unlock rosters, schedules, and player attributes.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="season-name">Season name</Label>
                <Input
                  id="season-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cobb Football 2028"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="season-start">Start date</Label>
                  <Input
                    id="season-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="season-end">End date</Label>
                  <Input
                    id="season-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="season-playoff-teams">Playoff teams</Label>
                  <Select
                    value={String(playoffTeams)}
                    onValueChange={(v) => setPlayoffTeams(Number(v))}
                  >
                    <SelectTrigger id="season-playoff-teams">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      {PLAYOFF_TEAM_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} teams
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="season-playoff-format">Playoff format</Label>
                  <Select
                    value={playoffFormat}
                    onValueChange={setPlayoffFormat}
                    disabled={playoffTeams === 0}
                  >
                    <SelectTrigger id="season-playoff-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single elimination</SelectItem>
                      <SelectItem value="double">Double elimination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy || name.trim() === ""}
                  data-testid="create-season-submit"
                >
                  {busy ? "Creating…" : "Create season"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Season created</DialogTitle>
              <DialogDescription>
                {createdName} is ready. Next, generate a schedule so teams have
                fixtures to play.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Created {createdName}. Rosters start empty (0/
                {DEFAULT_TARGET_ROSTER_SIZE}).
              </span>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
              <Button asChild data-testid="create-season-generate-schedule">
                <Link
                  href={createdId ? `/dashboard/seasons/${createdId}/schedule` : `/dashboard/leagues/${leagueId}/schedule`}
                >
                  Generate schedule
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      setConfirmOpen(false);
      return;
    }

    if ("needsConfirm" in res) {
      setConfirmOpen(true);
      return;
    }

    toast.error(
      res.error === "not_admin"
        ? "Only league admins can copy rosters."
        : res.error,
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void run(false)}
        aria-label={`Copy rosters from last season into ${season.name}`}
      >
        <Users className="mr-1 h-3.5 w-3.5" />
        {busy ? "…" : "Copy rosters"}
      </Button>
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace rosters?"
        description={`${season.name} already has rosters. Copying replaces them with the most recent prior season's rosters. This can't be undone.`}
        confirmLabel="Copy & replace"
        destructive
        pending={busy}
        onConfirm={() => void run(true)}
      />
    </>
  );
}

export function SeasonRowActions({
  season,
  championDecided = false,
  undersizedTeams = [],
}: {
  season: SeasonDto;
  championDecided?: boolean;
  undersizedTeams?: UndersizedTeam[];
}) {
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
  const [simulationFlavor, setSimulationFlavor] = useState<SimulationFlavor>(
    season.simulationFlavor ?? "balanced",
  );
  const [busy, setBusy] = useState(false);
  const [activateWarningOpen, setActivateWarningOpen] = useState(false);
  const [completeStep, setCompleteStep] = useState<"complete" | "force" | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isActive = season.status === "active";

  async function runActivate() {
    setBusy(true);
    const res = await activateSeasonAction(season.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`${season.name} is now the active season.`);
      setActivateWarningOpen(false);
      router.refresh();
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can do that." : res.error);
    }
  }

  function activate() {
    if (undersizedTeams.length > 0) {
      setActivateWarningOpen(true);
      return;
    }
    void runActivate();
  }

  async function runComplete(force = false) {
    setBusy(true);
    const res = await completeSeasonAction({
      seasonId: season.id,
      ...(force ? { force: true } : {}),
    });
    if (!res.ok && res.error === "no_champion" && !force) {
      setBusy(false);
      setCompleteStep("force");
      return;
    }
    setBusy(false);
    if (res.ok) {
      toast.success(`${season.name} completed.`, {
        description: "Start the next season from the league page.",
        action: {
          label: "League page",
          onClick: () =>
            router.push(`/dashboard/leagues/${season.leagueId}`),
        },
      });
      router.refresh();
      setCompleteStep(null);
    } else {
      toast.error(
        res.error === "not_admin" ? "Only league admins can do that." : res.error,
      );
    }
  }

  function complete() {
    setCompleteStep(championDecided ? "complete" : "force");
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
      simulationFlavor,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Season updated.");
      setEditing(false);
      router.refresh();
    } else if (res.error === "playoff_teams_locked") {
      toast.error("Playoff team count can't change after a bracket exists.");
    } else if (res.error === "invalid_playoff_teams") {
      toast.error("Playoff team count must be none, 4, 8, or 16.");
    } else {
      toast.error(res.error === "not_admin" ? "Only league admins can edit seasons." : res.error);
    }
  }

  async function remove() {
    setBusy(true);
    const res = await deleteSeasonAction(season.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`Deleted ${season.name}.`);
      router.refresh();
      setDeleteConfirmOpen(false);
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
          simulationFlavor={simulationFlavor}
          setSimulationFlavor={setSimulationFlavor}
          playoffTeamChoices={playoffTeamOptions(season.playoffTeams ?? 8)}
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
    <>
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
        {isActive && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={complete}
            aria-label={`Complete ${season.name}`}
          >
            <Trophy className="mr-1 h-3.5 w-3.5" />
            Complete
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
          onClick={() => setDeleteConfirmOpen(true)}
          aria-label={`Delete ${season.name}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <ActivateSeasonWarningDialog
        open={activateWarningOpen}
        seasonName={season.name}
        leagueId={season.leagueId}
        undersizedTeams={undersizedTeams}
        busy={busy}
        onCancel={() => setActivateWarningOpen(false)}
        onConfirm={() => void runActivate()}
      />
      <ActionConfirmDialog
        open={completeStep === "complete"}
        onOpenChange={(open) => {
          if (!open && !busy) setCompleteStep(null);
        }}
        title={`Complete ${season.name}?`}
        description="Schedule generation, result recording, and simulation will be locked for it."
        confirmLabel="Complete season"
        pending={busy}
        onConfirm={() => void runComplete(false)}
      />
      <ActionConfirmDialog
        open={completeStep === "force"}
        onOpenChange={(open) => {
          if (!open && !busy) setCompleteStep(null);
        }}
        title="Complete season anyway?"
        description={`No champion has been decided for ${season.name}. Completing locks schedule generation, result recording, and simulation. Complete anyway?`}
        confirmLabel="Complete anyway"
        destructive
        pending={busy}
        onConfirm={() => void runComplete(true)}
      />
      <ActionConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete ${season.name}?`}
        description="Delete this season and its schedule, results, and attributes? This can't be undone."
        confirmLabel="Delete season"
        destructive
        pending={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
