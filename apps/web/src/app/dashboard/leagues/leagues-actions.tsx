"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  createLeagueAction,
  createTeamInLeagueAction,
  deleteLeagueAction,
  renameLeagueAction,
} from "./actions";

function friendlyError(error: string): string {
  switch (error) {
    case "unauthorized":
      return "Please sign in.";
    case "not_admin":
      return "Only league admins can do that.";
    default:
      return error;
  }
}

const inputClass =
  "rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground";

export function CreateLeagueButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await createLeagueAction(trimmed);
    setBusy(false);
    if (res.ok) {
      toast.success(`Created ${trimmed}.`);
      setName("");
      setOpen(false);
      router.push(`/dashboard/leagues/${res.id}`);
    } else {
      toast.error(res.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New league
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="League name"
        className={inputClass}
      />
      <Button size="sm" disabled={busy} onClick={submit}>
        {busy ? "…" : "Create"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

export function DeleteLeagueButton({
  leagueId,
  leagueName,
  appearance = "icon",
}: {
  leagueId: string;
  leagueName: string;
  /**
   * "icon" is the compact trash button used in the leagues list;
   * "labeled" is the danger-zone button on the league manage page.
   */
  appearance?: "icon" | "labeled";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !window.confirm(
        `Delete "${leagueName}" and everything in it (teams, players, schedule)? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await deleteLeagueAction(leagueId);
    setBusy(false);
    if (res.ok) {
      toast.success(`Deleted ${leagueName}.`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (appearance === "labeled") {
    return (
      <Button
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={remove}
        aria-label={`Delete ${leagueName}`}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Delete league
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={remove}
      aria-label={`Delete ${leagueName}`}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}

export function RenameLeagueForm({
  leagueId,
  currentName,
}: {
  leagueId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await renameLeagueAction(leagueId, trimmed);
    setBusy(false);
    if (res.ok) {
      toast.success("League renamed.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (!editing) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditing(true)}
        aria-label="Rename league"
      >
        <Pencil className="mr-1 h-3.5 w-3.5" />
        Rename
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={inputClass}
      />
      <Button size="sm" disabled={busy} onClick={submit}>
        {busy ? "…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

/** Add a team to a league from the league screen (org-admin only). */
export function AddTeamForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stadium, setStadium] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setCity("");
    setStadium("");
    setOpen(false);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await createTeamInLeagueAction({
      leagueId,
      name: trimmed,
      city,
      stadium,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Added ${res.name}.`);
      reset();
      router.refresh();
    } else {
      toast.error(friendlyError(res.error));
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add team
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
        placeholder="Team name"
        className={inputClass}
      />
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") reset();
        }}
        placeholder="City (optional)"
        className={inputClass}
      />
      <input
        value={stadium}
        onChange={(e) => setStadium(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") reset();
        }}
        placeholder="Stadium (optional)"
        className={inputClass}
      />
      <Button size="sm" disabled={busy || !name.trim()} onClick={submit}>
        {busy ? "…" : "Add"}
      </Button>
      <Button size="sm" variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
