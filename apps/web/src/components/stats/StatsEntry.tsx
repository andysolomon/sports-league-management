"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Check, Plus, Trash2 } from "lucide-react";
import type { PlayerGameStatLine } from "@sports-management/shared-types";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { abbreviateName, groupPlayersByPosition } from "@/lib/position-group";
import { STAT_GROUPS, STAT_GROUP_BY_KEY, defaultGroupsFor } from "@/lib/stat-groups";
import {
  savePlayerGameStatsAction,
  clearPlayerGameStatsAction,
} from "@/app/dashboard/teams/[id]/games/[gameId]/stats/actions";

interface EntryPlayer {
  id: string;
  name: string;
  position: string;
  positionGroup: string | null;
  jerseyNumber: number | null;
}

interface StatsEntryProps {
  teamId: string;
  fixtureId: string;
  players: EntryPlayer[];
  initial: Record<string, PlayerGameStatLine>;
}

// Working copy is loosely typed (group → field → number) for ergonomic dynamic
// editing; cast to the typed PlayerGameStatLine (structurally identical) on save.
type WorkingLine = Record<string, Record<string, number>>;

const ALL_GROUP_KEYS = STAT_GROUPS.map((g) => g.key as string);

export default function StatsEntry({
  teamId,
  fixtureId,
  players,
  initial,
}: StatsEntryProps) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, WorkingLine>>(
    () => ({ ...(initial as Record<string, WorkingLine>) }),
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(Object.keys(initial)),
  );
  const [extraGroups, setExtraGroups] = useState<Record<string, string[]>>({});
  const [clearTarget, setClearTarget] = useState<{ id: string; name: string } | null>(
    null,
  );

  const grouped = useMemo(() => groupPlayersByPosition(players), [players]);

  function setField(
    playerId: string,
    group: string,
    field: string,
    value: number | undefined,
  ) {
    setLines((prev) => {
      const line: WorkingLine = { ...(prev[playerId] ?? {}) };
      const g: Record<string, number> = { ...(line[group] ?? {}) };
      if (value === undefined || Number.isNaN(value)) delete g[field];
      else g[field] = value;
      if (Object.keys(g).length === 0) delete line[group];
      else line[group] = g;
      return { ...prev, [playerId]: line };
    });
  }

  function visibleGroups(p: EntryPlayer): string[] {
    const set = new Set<string>(defaultGroupsFor(p.positionGroup));
    Object.keys(lines[p.id] ?? {}).forEach((k) => set.add(k));
    (extraGroups[p.id] ?? []).forEach((k) => set.add(k));
    return ALL_GROUP_KEYS.filter((k) => set.has(k));
  }

  function addGroup(playerId: string, key: string) {
    setExtraGroups((prev) => ({
      ...prev,
      [playerId]: [...(prev[playerId] ?? []), key],
    }));
  }

  function save(playerId: string, name: string) {
    setSavingId(playerId);
    startSaving(async () => {
      const stats = (lines[playerId] ?? {}) as PlayerGameStatLine;
      const res = await savePlayerGameStatsAction({
        teamId,
        fixtureId,
        playerId,
        stats,
      });
      setSavingId(null);
      if (res.ok) {
        setSavedIds((s) => new Set(s).add(playerId));
        toast.success(`Saved ${name}`);
        router.refresh();
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  function clear() {
    if (!clearTarget) return;
    const { id: playerId, name } = clearTarget;
    setSavingId(playerId);
    startSaving(async () => {
      const res = await clearPlayerGameStatsAction({ teamId, fixtureId, playerId });
      setSavingId(null);
      if (res.ok) {
        setLines((prev) => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
        setSavedIds((s) => {
          const next = new Set(s);
          next.delete(playerId);
          return next;
        });
        toast.success(`Cleared ${name}`);
        router.refresh();
        setClearTarget(null);
      } else {
        toast.error(errorLabel(res.error));
      }
    });
  }

  const enteredCount = savedIds.size;

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This team has no players yet — add a roster before entering stats.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">{enteredCount}</span> of{" "}
        {players.length} player{players.length === 1 ? "" : "s"} entered. Tap a
        player to enter their line; save as you go.
      </p>

      {grouped.map(({ group, players: groupPlayers }) => (
        <div key={group}>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group}
          </h3>
          <div className="space-y-2">
            {groupPlayers.map((p) => {
              const isOpen = expanded === p.id;
              const isSaved = savedIds.has(p.id);
              const isBusy = saving && savingId === p.id;
              return (
                <Card key={p.id}>
                  <CardContent className="p-0">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="w-7 text-right font-mono text-sm text-muted-foreground">
                        {p.jerseyNumber ?? "—"}
                      </span>
                      <span className="flex-1 truncate font-medium text-foreground">
                        {abbreviateName(p.name)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {p.position}
                        </span>
                      </span>
                      {isSaved && (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" /> Entered
                        </Badge>
                      )}
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t border-border px-4 py-4">
                        {visibleGroups(p).map((groupKey) => {
                          const def = STAT_GROUP_BY_KEY[groupKey];
                          if (!def) return null;
                          return (
                            <div key={groupKey}>
                              <p className="mb-1.5 text-caption-12 font-semibold uppercase tracking-wide text-foreground">
                                {def.label}
                              </p>
                              <div className="flex flex-wrap gap-3">
                                {def.fields.map((f) => {
                                  const val =
                                    lines[p.id]?.[groupKey]?.[f.key];
                                  return (
                                    <label
                                      key={f.key}
                                      className="flex flex-col gap-1"
                                    >
                                      <span className="text-caption-12 uppercase tracking-wide text-muted-foreground">
                                        {f.label}
                                      </span>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={val ?? ""}
                                        onChange={(e) =>
                                          setField(
                                            p.id,
                                            groupKey,
                                            f.key,
                                            e.target.value === ""
                                              ? undefined
                                              : Number(e.target.value),
                                          )
                                        }
                                        className="h-10 w-16 rounded-md border border-input bg-background px-2 text-center font-mono text-sm tabular-nums outline-none focus:border-primary"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add other stat groups */}
                        {(() => {
                          const hidden = ALL_GROUP_KEYS.filter(
                            (k) => !visibleGroups(p).includes(k),
                          );
                          if (hidden.length === 0) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                              <span className="text-xs text-muted-foreground">
                                Add:
                              </span>
                              {hidden.map((k) => (
                                <Button
                                  key={k}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addGroup(p.id, k)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  {STAT_GROUP_BY_KEY[k]?.label}
                                </Button>
                              ))}
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-2 border-t border-border pt-3">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => save(p.id, p.name)}
                          >
                            {isBusy ? "Saving…" : "Save"}
                          </Button>
                          {isSaved && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setClearTarget({ id: p.id, name: p.name })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="mr-1 h-4 w-4" /> Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      <ActionConfirmDialog
        open={clearTarget !== null}
        onOpenChange={(open) => {
          if (!open) setClearTarget(null);
        }}
        title={clearTarget ? `Clear ${clearTarget.name}'s stats?` : "Clear stats?"}
        description="This removes all entered stats for this game."
        confirmLabel="Clear"
        destructive
        pending={saving}
        onConfirm={clear}
      />
    </div>
  );
}

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Stat-keeping isn't enabled yet.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "Only a coach or admin of this team can enter stats.";
    case "team_not_in_fixture":
    case "fixture_not_found":
      return "Game not found.";
    default:
      return error;
  }
}
