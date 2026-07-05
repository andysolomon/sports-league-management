"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderedComponents } from "@/lib/ratings/component-labels";
import { updatePlayerAttributesAction } from "@/app/dashboard/players/[id]/actions";

export interface SprtRatingCardProps {
  playerId: string;
  weightedOverall: number | null;
  attributes: Record<string, number>;
  /** Server-resolved: admin or coach may edit (WSM-000121). */
  canEdit?: boolean;
}

export function SprtRatingCard({
  playerId,
  weightedOverall,
  attributes,
  canEdit = false,
}: SprtRatingCardProps) {
  const router = useRouter();
  const components = orderedComponents(attributes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function openEditor() {
    const next: Record<string, string> = {};
    for (const c of components) {
      next[c.key] = String(Math.round(c.value));
    }
    setDraft(next);
    setDialogOpen(true);
  }

  function handleSave() {
    const parsed: Record<string, number> = {};
    for (const c of components) {
      const raw = draft[c.key]?.trim() ?? "";
      const num = Number(raw);
      if (raw === "" || !Number.isFinite(num)) {
        toast.error(`Enter a valid number for ${c.label}.`);
        return;
      }
      parsed[c.key] = num;
    }

    startTransition(async () => {
      const result = await updatePlayerAttributesAction(playerId, parsed);
      if (result.ok) {
        toast.success("Ratings saved.");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(mapEditError(result.error));
      }
    });
  }

  return (
    <>
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              SPRT Rating
            </h3>
            <div className="flex items-baseline gap-2">
              {weightedOverall != null && (
                <span className="font-mono text-stat-30 tabular-nums text-accent">
                  {Math.round(weightedOverall)}
                  <span className="ml-1 text-caption-12 font-normal text-text-muted">
                    OVR
                  </span>
                </span>
              )}
              {canEdit && components.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={openEditor}
                  aria-label="Edit SPRT ratings"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {components.length > 0 && (
            <dl className="mt-4 space-y-2">
              {components.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-sm text-muted-foreground">
                    {c.label}
                  </dt>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    role="meter"
                    aria-valuenow={Math.round(c.value)}
                    aria-valuemin={0}
                    aria-valuemax={99}
                    aria-label={c.label}
                  >
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{
                        width: `${Math.min(100, (c.value / 99) * 100)}%`,
                      }}
                    />
                  </div>
                  <dd className="w-8 shrink-0 text-right font-mono text-sm text-foreground">
                    {Math.round(c.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            SPRT Rating is our own metric derived from open NFL performance
            data (nflverse).
          </p>
        </CardContent>
      </Card>

      {canEdit ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit SPRT ratings</DialogTitle>
              <DialogDescription>
                Adjust attribute values (0–99). Overall is recomputed on save.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[min(60vh,28rem)] gap-3 overflow-y-auto py-2">
              {components.map((c) => (
                <div key={c.key} className="grid grid-cols-[1fr_5rem] gap-3">
                  <Label htmlFor={`attr-${c.key}`} className="self-center">
                    {c.label}
                  </Label>
                  <Input
                    id={`attr-${c.key}`}
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={draft[c.key] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [c.key]: e.target.value }))
                    }
                    className="font-mono"
                    disabled={pending}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function mapEditError(code: string): string {
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
    case "not_authorized":
      return "Only coaches and admins can edit ratings.";
    case "empty_attributes":
      return "Provide at least one attribute.";
    case "no_season":
      return "No season found for this player's league.";
    default:
      if (code.startsWith("invalid_attribute_key:")) {
        return `Unknown attribute: ${code.slice("invalid_attribute_key:".length)}`;
      }
      if (code.startsWith("attribute_out_of_range:")) {
        return `Value must be 0–99 for ${code.slice("attribute_out_of_range:".length)}`;
      }
      if (code.startsWith("invalid_attribute_value:")) {
        return `Invalid number for ${code.slice("invalid_attribute_value:".length)}`;
      }
      return code;
  }
}
