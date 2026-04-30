"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/8bit/dialog";
import { Button } from "@/components/ui/8bit/button";
import { Label } from "@/components/ui/8bit/label";
import { Textarea } from "@/components/ui/8bit/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/8bit/select";
import {
  ingestPlayerAttributesAction,
  type AttributeSource,
} from "@/app/dashboard/players/[id]/development/actions";

export interface AttributesUploadDialogProps {
  playerId: string;
  /** Available seasons in the player's league. */
  seasons: Array<{ id: string; name: string }>;
}

const SOURCE_OPTIONS: Array<{ value: AttributeSource; label: string }> = [
  { value: "admin", label: "Admin (canonical JSON)" },
  { value: "pff", label: "PFF" },
  { value: "madden", label: "Madden" },
];

export default function AttributesUploadDialog({
  playerId,
  seasons,
}: AttributesUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<AttributeSource>("admin");
  const [seasonId, setSeasonId] = useState<string>("");
  const [rawJson, setRawJson] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!seasonId) {
      toast.error("Pick a season.");
      return;
    }
    if (!rawJson.trim()) {
      toast.error("Paste the source JSON.");
      return;
    }
    startTransition(async () => {
      const result = await ingestPlayerAttributesAction({
        playerId,
        seasonId,
        source,
        rawJson,
      });
      if (result.ok) {
        toast.success("Attributes ingested.");
        setOpen(false);
        setRawJson("");
      } else {
        toast.error(mapIngestError(result.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add attributes</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add player attributes</DialogTitle>
          <DialogDescription>
            Paste the source JSON for one season. The adapter normalizes
            it into the canonical attribute map and writes a row.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="attr-source">Source</Label>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as AttributeSource)}
            >
              <SelectTrigger id="attr-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="attr-season">Season</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger id="attr-season">
                <SelectValue placeholder="Select a season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    No seasons yet.
                  </div>
                ) : (
                  seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="attr-json">Raw JSON</Label>
            <Textarea
              id="attr-json"
              rows={10}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder='{ "positionGroup": "QB", "attributes": { "armStrength": 92, "accuracy": 88 } }'
              className="font-mono text-xs"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Ingesting…" : "Ingest"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapIngestError(code: string): string {
  switch (code) {
    case "flag_disabled":
      return "Player attributes feature is disabled.";
    case "unauthorized":
      return "Sign in required.";
    case "player_not_found":
      return "Player not found in your visible leagues.";
    case "league_not_found":
    case "league_not_owned":
      return "League access denied.";
    case "not_admin":
      return "Only org admins can ingest attributes.";
    case "invalid_json":
      return "JSON didn't parse — check the paste.";
    case "ingest_no_valid_source":
      return "The pasted payload didn't match the chosen source format.";
    default:
      return code;
  }
}
