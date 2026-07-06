import type { StatGroupLeaders } from "@/lib/gamecast";
import {
  resolvePlayerLabel,
  type GamecastPlayerNameMap,
} from "@/lib/gamecast/player-names";

export interface PlayerLeadersTeam {
  abbr: string;
  color: string;
}

export interface PlayerLeadersProps {
  groups: StatGroupLeaders[];
  playerNameMap: GamecastPlayerNameMap;
  homeTeam: PlayerLeadersTeam;
  awayTeam: PlayerLeadersTeam;
}

function leaderName(
  playerId: string,
  map: GamecastPlayerNameMap,
): string {
  return resolvePlayerLabel(playerId, map) ?? `#${playerId.slice(-4)}`;
}

function LeaderRow({
  leader,
  team,
  map,
}: {
  leader: NonNullable<StatGroupLeaders["home"]>;
  team: PlayerLeadersTeam;
  map: GamecastPlayerNameMap;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span
        className="mt-1 inline-block size-2 shrink-0 rounded-full"
        style={{ backgroundColor: team.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-caption-12 font-bold" style={{ color: team.color }}>
          {team.abbr} · {leaderName(leader.playerId, map)}
        </p>
        <p className="font-mono text-[11px] tabular-nums text-text-muted">
          {leader.compactLine}
        </p>
      </div>
    </div>
  );
}

export default function PlayerLeaders({
  groups,
  playerNameMap,
  homeTeam,
  awayTeam,
}: PlayerLeadersProps) {
  if (groups.length === 0) {
    return (
      <p className="py-4 text-center text-caption-12 text-text-subtle">
        No player stats yet.
      </p>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      <p className="mb-3 text-caption-12 text-text-subtle">
        Stats reflect the revealed game state.
      </p>
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.group}>
            <h4 className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-text-subtle">
              {group.label}
            </h4>
            <div className="divide-y divide-border rounded-md border border-border bg-surface-2/50 px-2">
              {group.home ? (
                <LeaderRow
                  leader={group.home}
                  team={homeTeam}
                  map={playerNameMap}
                />
              ) : null}
              {group.away ? (
                <LeaderRow
                  leader={group.away}
                  team={awayTeam}
                  map={playerNameMap}
                />
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
