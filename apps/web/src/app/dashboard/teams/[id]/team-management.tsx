"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamDto, PlayerDto } from "@sports-management/shared-types";
import PlayerForm from "../../_components/player-form";
import TeamEditForm from "../../_components/team-edit-form";
import DeleteConfirm from "../../_components/delete-confirm";
import { DataTable, type Column } from "@/components/data-table";
import { PositionGroupTabs } from "@/components/roster/PositionGroupTabs";
import { RosterStatusIndicator } from "@/components/roster/RosterStatusIndicator";
import { SyntheticRosterButton } from "@/components/roster/SyntheticRosterButton";
import { orderByDepth } from "@/lib/roster/depth-order";
import { abbreviateName } from "@/lib/position-group";
import { gradeToClassYear } from "@/lib/class-year";
import {
  lookupAttribute,
  presentHeadlineKeys,
  type PlayerSnapshot,
} from "@/lib/attributes/headline-columns";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Pencil, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

interface TeamManagementProps {
  team: TeamDto;
  players: PlayerDto[];
  /** Admin or coach: edit team, manage players/roster (WSM-000121). */
  canManage: boolean;
  /** Admin only: remove the whole team (WSM-000121). */
  canDelete?: boolean;
  /** WSM-000173: show the "Generate roster" (synthetic players) action. */
  canGenerateRoster?: boolean;
  /** Active season started — blocks synthetic roster/ratings generation. */
  seasonStarted?: boolean;
  /** WSM-000090: playerId → attribute snapshot; empty when Phase 2 is
      dark or the season has no ingested attributes. */
  attributeSnapshots?: Record<string, PlayerSnapshot>;
  /** WSM-000095: playerId → Madden overall; empty when none ingested. */
  maddenOveralls?: Record<string, number>;
}

type ModalState =
  | { type: "none" }
  | { type: "editTeam" }
  | { type: "deleteTeam" }
  | { type: "addPlayer" }
  | { type: "editPlayer"; player: PlayerDto }
  | { type: "deletePlayer"; player: PlayerDto };

export default function TeamManagement({
  team,
  players,
  canManage,
  canDelete = false,
  canGenerateRoster = false,
  seasonStarted = false,
  attributeSnapshots = {},
  maddenOveralls = {},
}: TeamManagementProps) {
  const snapshots = new Map(Object.entries(attributeSnapshots));
  const madden = new Map(Object.entries(maddenOveralls));
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isDeleting, setIsDeleting] = useState(false);

  function handleSuccess() {
    setModal({ type: "none" });
    router.refresh();
  }

  async function handleDeletePlayer(playerId: string) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete player");
      }
      toast.success("Player deleted successfully");
      handleSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete player";
      toast.error(message);
      setIsDeleting(false);
    }
  }

  async function handleDeleteTeam() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to remove team");
      }
      toast.success(`${team.name} removed`);
      // The team no longer exists — return to its league rather than refresh.
      router.push(`/dashboard/leagues/${team.leagueId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove team";
      toast.error(message);
      setIsDeleting(false);
    }
  }

  // Madden-style compact depth chart columns (WSM-000088). `slot` is the
  // player's depth-order index within the active position-group tab \u2014
  // attached to the row before render so it survives user re-sorting.
  type RosterRow = PlayerDto & { slot?: number } & Record<string, unknown>;

  // Headline attribute columns render only for keys at least one
  // player on the team actually has (WSM-000090).
  const statKeys = presentHeadlineKeys(
    snapshots,
    players.map((p) => p.id),
  );

  // Depth order for a position group (slot 1 = starter) keyed off SPRT OVR.
  const depthOvr = (p: PlayerDto) =>
    snapshots.get(p.id)?.weightedOverall ?? null;

  function buildColumns(withSlot: boolean): Column<RosterRow>[] {
    return [
      ...(withSlot
        ? [
            {
              key: "slot",
              header: "Slot",
              sortable: true,
              render: (p: RosterRow) => (
                <span className="font-mono text-muted-foreground">
                  {p.slot}.
                </span>
              ),
            } satisfies Column<RosterRow>,
          ]
        : []),
      {
        key: "name",
        header: "Player",
        sortable: true,
        render: (p) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium">{abbreviateName(p.name)}</span>
            <RosterStatusIndicator status={p.status} />
          </span>
        ),
      },
      { key: "position", header: "Pos", sortable: true },
      {
        key: "classYear",
        header: "Class",
        sortable: true,
        accessor: (p: RosterRow) => gradeToClassYear(p.grade),
        render: (p) => gradeToClassYear(p.grade) ?? "\u2014",
      },
      {
        key: "jerseyNumber",
        header: "#",
        sortable: true,
        render: (p) => p.jerseyNumber ?? "\u2014",
      },
      // Madden stat columns (WSM-000090) — only when snapshots exist.
      ...(snapshots.size > 0
        ? [
            {
              key: "ovr",
              header: "SPRT",
              sortable: true,
              accessor: (p: RosterRow) =>
                snapshots.get(p.id as string)?.weightedOverall ?? null,
              render: (p: RosterRow) => {
                const ovr = snapshots.get(p.id as string)?.weightedOverall;
                return ovr != null ? (
                  <span className="font-mono font-semibold text-accent">
                    {Math.round(ovr)}
                  </span>
                ) : (
                  "—"
                );
              },
            } satisfies Column<RosterRow>,
            ...statKeys.map(
              (key) =>
                ({
                  key: `attr_${key}`,
                  header: key,
                  sortable: true,
                  accessor: (p: RosterRow) =>
                    lookupAttribute(snapshots.get(p.id as string), key),
                  render: (p: RosterRow) => {
                    const value = lookupAttribute(
                      snapshots.get(p.id as string),
                      key,
                    );
                    return value != null ? (
                      <span className="font-mono">{Math.round(value)}</span>
                    ) : (
                      "—"
                    );
                  },
                }) satisfies Column<RosterRow>,
            ),
          ]
        : []),
      // Madden overall (WSM-000095) — independent of SPRT, shown side by side.
      ...(madden.size > 0
        ? [
            {
              key: "mad",
              header: "MAD",
              sortable: true,
              accessor: (p: RosterRow) => madden.get(p.id as string) ?? null,
              render: (p: RosterRow) => {
                const ovr = madden.get(p.id as string);
                return ovr != null ? (
                  <span className="font-mono font-semibold text-primary">
                    {ovr}
                  </span>
                ) : (
                  "—"
                );
              },
            } satisfies Column<RosterRow>,
          ]
        : []),
      // Status column dropped for now (WSM-000097 follow-up) — it ate width for
      // little signal. A future story will surface injury/inactive state as an
      // icon/asterisk with a popover for the designation, not a full column.
    ];
  }

  return (
    <>
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {team.logoUrl ? (
                // Arbitrary user-pasted host; next/image would need an allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logoUrl}
                  alt={`${team.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-md bg-muted object-contain"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted"
                  style={
                    team.primaryColor
                      ? { backgroundColor: team.primaryColor }
                      : undefined
                  }
                >
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="min-w-0 break-words text-2xl font-bold text-foreground">
                  {team.name}
                  {team.teamName ? (
                    <span className="text-muted-foreground">
                      {" "}
                      &mdash; {team.teamName}
                    </span>
                  ) : null}
                </h2>
                {team.primaryColor || team.secondaryColor ? (
                  <div className="mt-1 flex gap-1" aria-hidden>
                    {team.primaryColor ? (
                      <span
                        className="h-2 w-8 rounded-full"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                    ) : null}
                    {team.secondaryColor ? (
                      <span
                        className="h-2 w-8 rounded-full"
                        style={{ backgroundColor: team.secondaryColor }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {(canManage || canDelete) && (
              <div className="flex shrink-0 flex-wrap gap-2">
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModal({ type: "editTeam" })}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit Team
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setModal({ type: "deleteTeam" })}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove Team
                  </Button>
                )}
              </div>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {team.city && (
              <div>
                <dt className="font-medium text-muted-foreground">City</dt>
                <dd className="mt-1 text-foreground">{team.city}</dd>
              </div>
            )}
            {team.stadium && (
              <div>
                <dt className="font-medium text-muted-foreground">Stadium</dt>
                <dd className="mt-1 text-foreground">{team.stadium}</dd>
              </div>
            )}
            {team.foundedYear && (
              <div>
                <dt className="font-medium text-muted-foreground">Founded</dt>
                <dd className="mt-1 text-foreground">{team.foundedYear}</dd>
              </div>
            )}
            {team.location && (
              <div>
                <dt className="font-medium text-muted-foreground">Location</dt>
                <dd className="mt-1 text-foreground">{team.location}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Wraps on a phone: the h3 + up to four action buttons exceed a 375px
          viewport in a single no-wrap row, scrolling the whole page sideways
          (WSM-000188/#419). flex-wrap drops the button group to its own line,
          and the inner group wraps its buttons rather than overflowing. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Player Roster ({players.length})
        </h3>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {canGenerateRoster && (
              <>
                <SyntheticRosterButton
                  kind="team"
                  id={team.id}
                  seasonStarted={seasonStarted}
                />
                <SyntheticRosterButton
                  kind="team"
                  id={team.id}
                  action="attributes"
                  seasonStarted={seasonStarted}
                />
                <SyntheticRosterButton kind="team" id={team.id} action="clear" />
              </>
            )}
            <Button onClick={() => setModal({ type: "addPlayer" })}>
              Add Player
            </Button>
          </div>
        )}
      </div>

      {(snapshots.size > 0 || madden.size > 0) && (
        <p className="mb-3 text-xs text-muted-foreground">
          SPRT is our own rating from open NFL data (nflverse); MAD is the
          Madden NFL 26 overall (EA Sports). Players without enough recent
          snaps are unrated.
        </p>
      )}

      {players.length > 0 ? (
        <PositionGroupTabs players={players}>
          {(groupPlayers, activeTab) => (
            <DataTable
              data={
                (activeTab === "All"
                  ? groupPlayers
                  : orderByDepth(groupPlayers, depthOvr).map((p, i) => ({
                      ...p,
                      slot: i + 1,
                    }))) as RosterRow[]
              }
              columns={buildColumns(activeTab !== "All")}
              searchPlaceholder="Search players..."
              searchKeys={["name", "position", "status"]}
              onRowClick={(p) =>
                router.push(
                  `/dashboard/players/${(p as RosterRow).id}?from=team-${team.id}`,
                )
              }
              actions={
                canManage
                  ? (player) => (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${player.name}`}
                          onClick={() =>
                            setModal({
                              type: "editPlayer",
                              player: player as unknown as PlayerDto,
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${player.name}`}
                          onClick={() =>
                            setModal({
                              type: "deletePlayer",
                              player: player as unknown as PlayerDto,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  : undefined
              }
            />
          )}
        </PositionGroupTabs>
      ) : (
        <EmptyState
          icon={UserCircle}
          title="No players on this team"
          description="Add players to build the team roster."
          action={
            canManage ? (
              <Button onClick={() => setModal({ type: "addPlayer" })}>
                Add Player
              </Button>
            ) : undefined
          }
        />
      )}

      <TeamEditForm
        team={team}
        open={modal.type === "editTeam"}
        onOpenChange={(open) => !open && setModal({ type: "none" })}
        onSuccess={handleSuccess}
      />

      <PlayerForm
        mode="create"
        teamId={team.id}
        existingJerseyNumbers={players
          .map((p) => p.jerseyNumber)
          .filter((n): n is number => n != null)}
        allowDuplicateJerseys={team.allowDuplicateJerseys}
        open={modal.type === "addPlayer"}
        onOpenChange={(open) => !open && setModal({ type: "none" })}
        onSuccess={handleSuccess}
      />

      {modal.type === "editPlayer" && (
        <PlayerForm
          mode="edit"
          teamId={team.id}
          player={modal.player}
          existingJerseyNumbers={players
            .filter((p) => p.id !== modal.player.id)
            .map((p) => p.jerseyNumber)
            .filter((n): n is number => n != null)}
          allowDuplicateJerseys={team.allowDuplicateJerseys}
          open
          onOpenChange={(open) => !open && setModal({ type: "none" })}
          onSuccess={handleSuccess}
        />
      )}

      {modal.type === "deletePlayer" && (
        <DeleteConfirm
          title="Delete Player"
          message={`Are you sure you want to delete ${modal.player.name}? This action cannot be undone.`}
          isOpen
          isDeleting={isDeleting}
          onConfirm={() => handleDeletePlayer(modal.player.id)}
          onCancel={() => setModal({ type: "none" })}
        />
      )}

      {modal.type === "deleteTeam" && (
        <DeleteConfirm
          title="Remove Team"
          message={`Remove ${team.name} and its ${players.length} player${
            players.length === 1 ? "" : "s"
          } from this league? This also deletes the team's depth charts and schedule. This action cannot be undone.`}
          isOpen
          isDeleting={isDeleting}
          onConfirm={handleDeleteTeam}
          onCancel={() => setModal({ type: "none" })}
        />
      )}
    </>
  );
}
