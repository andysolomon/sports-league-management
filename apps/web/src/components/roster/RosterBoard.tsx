"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PlayerDto,
  RosterAssignmentDto,
  SeasonDto,
  TeamDto,
} from "@sports-management/shared-types";
import AssignPlayerDialog from "./AssignPlayerDialog";
import RosterLimitBadge from "./RosterLimitBadge";
import RosterSlotGroup from "./RosterSlotGroup";
import RosterStatusList from "./RosterStatusList";

export interface RosterBoardProps {
  team: TeamDto;
  season: SeasonDto;
  players: PlayerDto[];
  assignments: RosterAssignmentDto[];
  limitStatus: {
    activeCount: number;
    rosterLimit: number | null;
    remaining: number | null;
  };
}

const NON_ACTIVE_STATUSES = ["ir", "suspended", "released"] as const;

export default function RosterBoard({
  team,
  season,
  players,
  assignments,
  limitStatus,
}: RosterBoardProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] =
    useState<"active" | "ir" | "suspended" | "released">("active");

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerDto>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status === "active"),
    [assignments],
  );

  const assignedPlayerIds = useMemo(
    () => new Set(activeAssignments.map((a) => a.playerId)),
    [activeAssignments],
  );

  const eligiblePlayers = useMemo(
    () =>
      players.filter(
        (p) => p.teamId === team.id && !assignedPlayerIds.has(p.id),
      ),
    [players, team.id, assignedPlayerIds],
  );

  const slotGroups = useMemo(() => {
    const grouped = new Map<string, RosterAssignmentDto[]>();
    for (const a of activeAssignments) {
      const list = grouped.get(a.positionSlot) ?? [];
      list.push(a);
      grouped.set(a.positionSlot, list);
    }
    for (const [slot, list] of grouped) {
      list.sort((a, b) => a.depthRank - b.depthRank);
      grouped.set(slot, list);
    }
    return Array.from(grouped.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [activeAssignments]);

  const filteredNonActive = useMemo(
    () => assignments.filter((a) => a.status === statusFilter),
    [assignments, statusFilter],
  );

  const atLimit =
    limitStatus.rosterLimit !== null &&
    limitStatus.activeCount >= limitStatus.rosterLimit;

  function handleMutated() {
    router.refresh();
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {team.name} — Roster
          </h2>
          <p className="text-sm text-muted-foreground">
            Season: {season.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RosterLimitBadge
            activeCount={limitStatus.activeCount}
            rosterLimit={limitStatus.rosterLimit}
          />
          <AssignPlayerDialog
            teamId={team.id}
            seasonId={season.id}
            leagueId={team.leagueId}
            eligiblePlayers={eligiblePlayers}
            onAssigned={handleMutated}
            disabled={atLimit || season.rosterLocked}
          />
        </div>
      </header>

      {season.rosterLocked ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          This season is locked. Roster changes are disabled until an admin
          unlocks it.
        </div>
      ) : null}

      <section aria-label="Active roster" className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active ({activeAssignments.length})
        </h3>
        {slotGroups.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No players on the active roster yet. Use{" "}
            <strong>Add to Roster</strong> to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {slotGroups.map(([positionSlot, rows]) => (
              <RosterSlotGroup
                key={positionSlot}
                positionSlot={positionSlot}
                assignments={rows}
                playersById={playersById}
                teamId={team.id}
                seasonId={season.id}
                leagueId={team.leagueId}
                disabled={season.rosterLocked}
                onChanged={handleMutated}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Non-active roster">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Non-active
          </h3>
          <div className="flex rounded-md border p-0.5">
            {NON_ACTIVE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                  statusFilter === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "ir" ? "IR" : s} (
                {assignments.filter((a) => a.status === s).length})
              </button>
            ))}
          </div>
        </div>
        <RosterStatusList
          assignments={filteredNonActive}
          playersById={playersById}
          teamId={team.id}
          seasonId={season.id}
          leagueId={team.leagueId}
          disabled={season.rosterLocked || atLimit}
          onChanged={handleMutated}
        />
      </section>
    </div>
  );
}
