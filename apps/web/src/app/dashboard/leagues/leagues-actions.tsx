"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  createLeagueAction,
  deleteLeagueAction,
  renameLeagueAction,
} from "./actions";

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
}: {
  leagueId: string;
  leagueName: string;
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
