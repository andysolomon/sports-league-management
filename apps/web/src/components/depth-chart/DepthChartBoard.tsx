"use client";

import { useMemo, useState } from "react";
import type {
  DepthChartEntryDto,
  PlayerDto,
  SeasonDto,
} from "@sports-management/shared-types";
import LockBanner from "./LockBanner";
import PositionColumn from "./PositionColumn";

interface DepthChartBoardProps {
  teamId: string;
  teamName: string;
  leagueId: string;
  season: SeasonDto;
  players: PlayerDto[];
  entries: DepthChartEntryDto[];
  isAdmin: boolean;
}

export default function DepthChartBoard({
  teamId,
  teamName,
  leagueId,
  season,
  players,
  entries,
  isAdmin,
}: DepthChartBoardProps) {
  const [rosterLocked, setRosterLocked] = useState(season.rosterLocked);

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerDto>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const columns = useMemo(() => {
    const byPosition = new Map<string, PlayerDto[]>();

    const grouped = new Map<string, DepthChartEntryDto[]>();
    for (const e of entries) {
      const list = grouped.get(e.positionSlot) ?? [];
      list.push(e);
      grouped.set(e.positionSlot, list);
    }
    for (const [positionSlot, list] of grouped) {
      const ordered = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
      const resolved: PlayerDto[] = [];
      for (const entry of ordered) {
        const player = playersById.get(entry.playerId);
        if (player) resolved.push(player);
      }
      byPosition.set(positionSlot, resolved);
    }

    const coveredPlayerIds = new Set(
      Array.from(byPosition.values()).flatMap((list) => list.map((p) => p.id)),
    );
    for (const player of players) {
      if (coveredPlayerIds.has(player.id)) continue;
      const slot = player.position || "Unassigned";
      const list = byPosition.get(slot) ?? [];
      list.push(player);
      byPosition.set(slot, list);
    }

    return Array.from(byPosition.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [entries, players, playersById]);

  return (
    <div>
      <header className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">
          {teamName} — Depth Chart
        </h2>
        <p className="text-sm text-muted-foreground">Season: {season.name}</p>
      </header>

      <LockBanner
        seasonId={season.id}
        leagueId={leagueId}
        rosterLocked={rosterLocked}
        isAdmin={isAdmin}
        onToggle={setRosterLocked}
      />

      {columns.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No players on this team. Add players before editing the depth chart.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {columns.map(([positionSlot, slotPlayers]) => (
            <PositionColumn
              key={positionSlot}
              teamId={teamId}
              seasonId={season.id}
              leagueId={leagueId}
              positionSlot={positionSlot}
              players={slotPlayers}
              disabled={rosterLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
}
