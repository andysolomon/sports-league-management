"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  createDivisionAction,
  renameDivisionAction,
  deleteDivisionAction,
} from "./division-actions";

const inputClass =
  "rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground";

function errorText(error: string): string {
  return error === "not_admin" ? "Only league admins can do that." : error;
}

export function CreateDivisionButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await createDivisionAction(leagueId, trimmed);
    setBusy(false);
    if (res.ok) {
      toast.success(`Added ${trimmed}.`);
      setName("");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(errorText(res.error));
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New division
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
        placeholder="Division name"
        className={inputClass}
      />
      <Button size="sm" disabled={busy} onClick={submit}>
        {busy ? "…" : "Add"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function DivisionRowActions({
  divisionId,
  currentName,
  teamCount = 0,
}: {
  divisionId: string;
  currentName: string;
  /** Teams currently in this division; they're moved to No Division on delete. */
  teamCount?: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await renameDivisionAction(divisionId, trimmed);
    setBusy(false);
    if (res.ok) {
      toast.success("Division renamed.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(errorText(res.error));
    }
  }

  async function remove() {
    const warning =
      teamCount > 0
        ? `Delete division "${currentName}"? Its ${teamCount} team${
            teamCount === 1 ? "" : "s"
          } will be moved to No Division.`
        : `Delete division "${currentName}"?`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    const res = await deleteDivisionAction(divisionId);
    setBusy(false);
    if (res.ok) {
      toast.success(
        res.teamCount > 0
          ? `Deleted ${currentName}. Moved ${res.teamCount} team${
              res.teamCount === 1 ? "" : "s"
            } to No Division.`
          : `Deleted ${currentName}.`,
      );
      router.refresh();
    } else {
      toast.error(errorText(res.error));
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
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
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${currentName}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={remove}
        aria-label={`Delete ${currentName}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
