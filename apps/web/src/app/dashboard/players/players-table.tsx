"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { TeamMark } from "@/components/team-mark";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterPlayers,
  paginatePlayers,
  PLAYERS_PAGE_SIZE,
  POSITION_SIDE_GROUPS,
  sortPlayers,
  type DirectoryPlayer,
  type PlayerSort,
  type PlayerSortKey,
  type PlayersViewMode,
  type PositionSideGroup,
} from "@/lib/players-directory";
import { UserCircle } from "lucide-react";

const VIEW_STORAGE_KEY = "sl-players-view";

function readStoredView(): PlayersViewMode {
  if (typeof window === "undefined") return "cards";
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "cards" || stored === "list") return stored;
  } catch {
    // ignore
  }
  return "cards";
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-control bg-surface-2 p-1"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-control px-3 py-1.5 text-label-14 font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-text-muted hover:bg-surface-3 hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  align = "left",
  defaultDir = "asc",
  sort,
  onToggle,
}: {
  label: string;
  sortKey: PlayerSortKey;
  align?: "left" | "right";
  defaultDir?: "asc" | "desc";
  sort: PlayerSort;
  onToggle: (key: PlayerSortKey, defaultDir: "asc" | "desc") => void;
}) {
  return (
    <th
      className={cn(
        "cursor-pointer select-none whitespace-nowrap px-4 py-2 text-label-12 font-medium uppercase tracking-wide text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={() => onToggle(sortKey, defaultDir)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <ChevronsUpDown
          className={cn(
            "h-3 w-3",
            sort.key === sortKey ? "text-accent" : "text-muted-foreground",
          )}
        />
      </span>
    </th>
  );
}

interface PlayersTableProps {
  players: DirectoryPlayer[];
  showOverall: boolean;
}

export function PlayersTable({ players, showOverall }: PlayersTableProps) {
  const router = useRouter();
  const [view, setView] = useState<PlayersViewMode>(readStoredView);
  const [group, setGroup] = useState<PositionSideGroup>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlayerSort>({
    key: showOverall ? "rating" : "name",
    dir: showOverall ? "desc" : "asc",
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const filtered = useMemo(
    () => filterPlayers(players, query, group),
    [players, query, group],
  );
  const sorted = useMemo(() => sortPlayers(filtered, sort), [filtered, sort]);
  const pageSize = PLAYERS_PAGE_SIZE[view];
  const { pageItems, total, totalPages, safePage, startIndex } = useMemo(
    () => paginatePlayers(sorted, page, pageSize),
    [sorted, page, pageSize],
  );

  function resetPage() {
    setPage(1);
  }

  function toggleSort(key: PlayerSortKey, defaultDir: "asc" | "desc") {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDir },
    );
    resetPage();
  }

  function openPlayer(playerId: string) {
    router.push(`/dashboard/players/${playerId}`);
  }

  if (players.length === 0) {
    return (
      <EmptyState
        icon={UserCircle}
        title="No players found"
        description="Rosters haven't been generated for this season yet."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="View mode"
          value={view}
          onChange={(next) => {
            setView(next);
            resetPage();
          }}
          options={[
            { value: "cards", label: "Cards" },
            { value: "list", label: "List" },
          ]}
        />
        <SegmentedControl
          label="Position group"
          value={group}
          onChange={(next) => {
            setGroup(next);
            resetPage();
          }}
          options={POSITION_SIDE_GROUPS}
        />
        <div className="flex-1" />
        <div className="relative w-full max-w-[340px] flex-[1_1_220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            placeholder="Search players or teams…"
            className="pl-9"
          />
        </div>
      </div>

      {total === 0 ? (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">No players found</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Try a different search or filter.
          </p>
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(244px,1fr))] gap-3.5">
          {pageItems.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => openPlayer(player.id)}
              className="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {player.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                    <span className="font-mono">{player.position}</span>
                    {" · "}
                    {player.teamName}
                  </p>
                </div>
                <TeamMark
                  name={player.teamName}
                  primaryColor={player.teamPrimaryColor}
                  size="lg"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showOverall && player.overallRating != null ? (
                  <span className="inline-flex items-baseline gap-1.5 rounded-md bg-accent/10 px-2.5 py-1.5">
                    <span className="font-mono text-base font-bold text-accent">
                      {Math.round(player.overallRating)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      OVR
                    </span>
                  </span>
                ) : null}
                {player.jerseyNumber != null ? (
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground">
                    #{player.jerseyNumber}
                  </span>
                ) : null}
                <StatusBadge status={player.status} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    defaultDir="asc"
                    sort={sort}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    label="Team"
                    sortKey="team"
                    defaultDir="asc"
                    sort={sort}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    label="Pos"
                    sortKey="pos"
                    defaultDir="asc"
                    sort={sort}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    label="#"
                    sortKey="num"
                    align="right"
                    defaultDir="asc"
                    sort={sort}
                    onToggle={toggleSort}
                  />
                  {showOverall ? (
                    <SortHeader
                      label="OVR"
                      sortKey="rating"
                      align="right"
                      defaultDir="desc"
                      sort={sort}
                      onToggle={toggleSort}
                    />
                  ) : null}
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    defaultDir="asc"
                    sort={sort}
                    onToggle={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((player) => (
                  <tr
                    key={player.id}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                    onClick={() => openPlayer(player.id)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      {player.name}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <TeamMark
                          name={player.teamName}
                          primaryColor={player.teamPrimaryColor}
                          size="sm"
                        />
                        <span className="truncate">{player.teamName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">
                      {player.position}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                      {player.jerseyNumber ?? "\u2014"}
                    </td>
                    {showOverall ? (
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-accent">
                        {player.overallRating != null
                          ? Math.round(player.overallRating)
                          : "\u2014"}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <StatusBadge status={player.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-mono">
              {startIndex + 1}–{Math.min(startIndex + pageSize, total)}
            </span>{" "}
            of <span className="font-mono">{total}</span>
          </span>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              aria-label="Previous page"
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              aria-label="Next page"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
