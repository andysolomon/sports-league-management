"use client";

import { useMemo, useState } from "react";
import type {
  PlayerDto,
  RosterAuditAction,
  RosterAuditLogDto,
} from "@sports-management/shared-types";

interface RosterAuditTimelineProps {
  entries: RosterAuditLogDto[];
  players: PlayerDto[];
}

const ACTION_FILTERS: Array<{
  value: "all" | RosterAuditAction;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "assign", label: "Assigned" },
  { value: "remove", label: "Removed" },
  { value: "status_change", label: "Status change" },
  { value: "depth_reorder", label: "Reorder" },
];

const ACTION_COLORS: Record<RosterAuditAction, string> = {
  assign: "bg-green-100 text-accent border-accent/30",
  remove: "bg-destructive/15 text-destructive border-destructive/30",
  status_change: "bg-amber-100 text-amber-800 border-amber-200",
  depth_reorder: "bg-blue-100 text-primary border-blue-200",
};

type AuditSnapshot = {
  playerId?: string;
  positionSlot?: string;
  status?: string;
  depthRank?: number;
};

function safeParse(json: string | null): AuditSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AuditSnapshot;
  } catch {
    return null;
  }
}

function extractPlayerId(entry: RosterAuditLogDto): string | null {
  const before = safeParse(entry.beforeJson);
  const after = safeParse(entry.afterJson);
  return after?.playerId ?? before?.playerId ?? null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function RosterAuditTimeline({
  entries,
  players,
}: RosterAuditTimelineProps) {
  const [actionFilter, setActionFilter] =
    useState<"all" | RosterAuditAction>("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerDto>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const playerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) {
      const id = extractPlayerId(entry);
      if (id) ids.add(id);
    }
    return Array.from(ids)
      .map((id) => ({
        id,
        name: playersById.get(id)?.name ?? "Unknown player",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, playersById]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (playerFilter !== "all") {
        const playerId = extractPlayerId(entry);
        if (playerId !== playerFilter) return false;
      }
      return true;
    });
  }, [entries, actionFilter, playerFilter]);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No roster activity yet for this season.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap rounded-md border p-0.5">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setActionFilter(f.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                actionFilter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {playerOptions.length > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Player:</span>
            <select
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">All players</option>
              {playerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No entries match the current filters.
        </div>
      ) : (
        <ol className="divide-y rounded-md border">
          {filtered.map((entry) => (
            <AuditRow
              key={entry.id}
              entry={entry}
              playersById={playersById}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function AuditRow({
  entry,
  playersById,
}: {
  entry: RosterAuditLogDto;
  playersById: Map<string, PlayerDto>;
}) {
  const before = safeParse(entry.beforeJson);
  const after = safeParse(entry.afterJson);
  const playerId = after?.playerId ?? before?.playerId ?? null;
  const playerName = playerId
    ? (playersById.get(playerId)?.name ?? "Unknown player")
    : null;

  const delta = describeDelta(entry.action, before, after);

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
      <span
        className={`rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${ACTION_COLORS[entry.action]}`}
      >
        {entry.action.replace("_", " ")}
      </span>
      <div className="min-w-0">
        <p className="truncate text-foreground">
          {playerName ? <strong>{playerName}</strong> : <em>—</em>}
          {delta ? <span className="text-muted-foreground"> · {delta}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          by {entry.actorUserId}
        </p>
      </div>
      <time
        dateTime={entry.createdAt}
        className="font-mono text-xs text-muted-foreground"
      >
        {formatTimestamp(entry.createdAt)}
      </time>
    </li>
  );
}

function describeDelta(
  action: RosterAuditAction,
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): string | null {
  if (action === "assign" && after) {
    return `${after.positionSlot ?? "—"} #${after.depthRank ?? "?"}`;
  }
  if (action === "remove" && before) {
    return `${before.positionSlot ?? "—"} #${before.depthRank ?? "?"}`;
  }
  if (action === "status_change" && before && after) {
    const from = before.status ?? "?";
    const to = after.status ?? "?";
    return `${from} → ${to}`;
  }
  if (action === "depth_reorder" && after) {
    return after.positionSlot ?? null;
  }
  return null;
}
