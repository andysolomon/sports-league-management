"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonDto } from "@sports-management/shared-types";
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
  /** Name of the season just created; non-null switches the dialog to its success state. */
  const [createdName, setCreatedName] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setStartDate("");
    setEndDate("");
    setPlayoffTeams(8);
    setPlayoffFormat("single");
    setDivisionWinnersQualify(false);
    setCreatedName(null);
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
      divisionWinnersQualify,
    });
    setBusy(false);
    if (res.ok) {
      setCreatedName(trimmed);
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
                Add a season to this league to unlock rosters, schedules, and
                player attributes.
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
                  placeholder="e.g. 2026"
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
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={divisionWinnersQualify}
                  onChange={(e) => setDivisionWinnersQualify(e.target.checked)}
                />
                Division winners automatically qualify for playoffs
              </label>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || name.trim() === ""}>
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
              <span>Created {createdName}.</span>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
              <Button asChild>
                <Link href={`/dashboard/leagues/${leagueId}/schedule`}>
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
        title="Replace existing rosters?"
        description={`${season.name} already has rosters. Copying replaces them with last season's rosters. This can't be undone. Continue?`}
        confirmLabel="Continue"
        destructive
        pending={busy}
        onConfirm={() => void run(true)}
      />
    </>
  );
}

export function SeasonRowActions({
  season,
  undersizedTeams = [],
}: {
  season: SeasonDto;
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
        description: "Run the dynasty rollover from the league page next.",
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
    setCompleteStep("complete");
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
        description="Schedule generation, result recording, and simulations will be locked for it."
        confirmLabel="Complete"
        pending={busy}
        onConfirm={() => void runComplete(false)}
      />
      <ActionConfirmDialog
        open={completeStep === "force"}
        onOpenChange={(open) => {
          if (!open && !busy) setCompleteStep(null);
        }}
        title="Complete without a champion?"
        description="No playoff champion has been decided for this season. Complete it anyway?"
        confirmLabel="Complete anyway"
        destructive
        pending={busy}
        onConfirm={() => void runComplete(true)}
      />
      <ActionConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete ${season.name}?`}
        description="This deletes its schedule, results, and attributes. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
